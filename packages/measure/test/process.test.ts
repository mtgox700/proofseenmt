import { measurements, measurementWaveId, visibility } from "@proofseen/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../db/test/support/database";
import { capsFromEnv, DEFAULT_DAILY_USD, DEFAULT_MONTHLY_USD, measurementKit, processNextMeasurement, toCents, type MeasurementKit } from "../src/index";
import { scriptedTransport } from "./support/transport";

/*
 * La tâche planifiée de bout en bout, contre la vraie base (PGlite, migrations de production) et un transport simulé :
 * demande → prise en charge → mesure en mémoire → vague enregistrée. Aucun appel réseau, aucune clé réelle.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-14T10:00:00Z");
const noSleep = async (): Promise<void> => undefined;
const WIDE = { dailyUsd: 100, monthlyUsd: 1000 };

let sequence = 0;

/** Un freelance publié, avec ses compétences et une adresse prouvée ; rend aussi son nom, pour le transport simulé. */
const freelancer = async (): Promise<{ userId: string; profileId: string; client: { name: string; url: string } }> => {
  sequence += 1;
  const userId = await createUser(t.db);
  // Un compte de moins de 24 heures ne peut pas encore demander de mesure.
  await t.db.user.update({ where: { id: userId }, data: { createdAt: new Date(NOW.getTime() - 2 * 86_400_000) } });
  const profileId = await createProfile(t.db, userId);
  const url = `https://freelance-${sequence}.example.fr/`;
  await t.db.ownedUrl.create({ data: { profileId, url, urlKey: url.slice(0, -1), proofMethod: "well_known_file", verifiedAt: NOW } });
  const skill = await t.db.skill.upsert({ where: { key: "typescript" }, create: { key: "typescript", label: "TypeScript" }, update: {}, select: { id: true } });
  await t.db.freelanceSkill.create({ data: { profileId, skillId: skill.id } });
  const { displayName } = await t.db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
  return { userId, profileId, client: { name: displayName, url } };
};

const kitFor = (client: { name: string; url: string }): { kit: MeasurementKit; calls: Record<string, number> } => {
  const sim = scriptedTransport(client);
  const kit = measurementKit({ ANTHROPIC_API_KEY: "test-key-not-real" }, sim.transport, noSleep);
  if (kit === null) throw new Error("kit absent");
  return { kit, calls: sim.calls };
};

describe("plafonds de la plateforme", () => {
  it("lit les plafonds de l'environnement, avec des défauts prudents ; zéro met en pause", () => {
    expect(capsFromEnv({})).toEqual({ dailyUsd: DEFAULT_DAILY_USD, monthlyUsd: DEFAULT_MONTHLY_USD });
    expect(capsFromEnv({ PROOFSEEN_MEASURE_DAILY_USD: "12.5", PROOFSEEN_MEASURE_MONTHLY_USD: "abc" })).toEqual({ dailyUsd: 12.5, monthlyUsd: DEFAULT_MONTHLY_USD });
    expect(capsFromEnv({ PROOFSEEN_MEASURE_DAILY_USD: "0" }).dailyUsd).toBe(0);
    expect(capsFromEnv({ PROOFSEEN_MEASURE_DAILY_USD: "-3" }).dailyUsd).toBe(DEFAULT_DAILY_USD);
    expect(toCents(5.89)).toBe(589);
    expect(toCents(0.520001)).toBe(53);
  });
});

describe("tâche planifiée des mesures", () => {
  it("mesure une demande et enregistre sa vague ; le passage suivant n'a plus rien à faire", async () => {
    const { userId, client } = await freelancer();
    const queued = await measurements(t.db).request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error(queued.reason);
    const { kit, calls } = kitFor(client);

    const report = await processNextMeasurement({ db: t.db, kit, caps: WIDE, now: () => NOW });
    expect(report).toEqual({ kind: "done", requestId: queued.id, code: null, costCents: 52 });
    expect(calls.anthropic).toBe(20);

    const [wave] = await visibility(t.db).mine({ userId });
    expect(wave).toMatchObject({ waveId: measurementWaveId(queued.id), draws: 20 });
    expect(wave?.engines).toEqual([{ engine: "anthropic", draws: 20, retrieved: 15, named: 10, top5: 5, cited: 5 }]);
    const [mine] = await measurements(t.db).listMine({ userId });
    expect(mine).toMatchObject({ status: "done", engines: ["anthropic"], errorCode: null });

    expect(await processNextMeasurement({ db: t.db, kit, caps: WIDE, now: () => NOW })).toEqual({ kind: "idle" });
    expect(calls.anthropic).toBe(20);
  });

  it("plafond atteint : la demande reste en file et rien n'est dépensé", async () => {
    const { userId, client } = await freelancer();
    await measurements(t.db).request({ userId }, NOW);
    const { kit, calls } = kitFor(client);
    expect(await processNextMeasurement({ db: t.db, kit, caps: { dailyUsd: 0, monthlyUsd: 1000 }, now: () => NOW })).toEqual({ kind: "held", cap: "daily_cap" });
    expect(await processNextMeasurement({ db: t.db, kit, caps: { dailyUsd: 100, monthlyUsd: 5 }, now: () => NOW })).toEqual({ kind: "held", cap: "monthly_cap" });
    expect(calls.anthropic).toBe(0);
    const [mine] = await measurements(t.db).listMine({ userId });
    expect(mine?.status).toBe("queued");
    // Plafonds relevés : elle part.
    expect(await processNextMeasurement({ db: t.db, kit, caps: WIDE, now: () => NOW })).toMatchObject({ kind: "done" });
  });

  it("un profil dépublié entre la demande et la mesure : refus sans dépense", async () => {
    const { userId, profileId, client } = await freelancer();
    const queued = await measurements(t.db).request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error(queued.reason);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "private" } });
    const { kit, calls } = kitFor(client);
    expect(await processNextMeasurement({ db: t.db, kit, caps: WIDE, now: () => NOW })).toEqual({ kind: "refused", requestId: queued.id, code: "not_published", costCents: 0 });
    expect(calls.anthropic).toBe(0);
  });
});
