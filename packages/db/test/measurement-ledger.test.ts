import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gdpr } from "../src/gdpr";
import { MEASUREMENT_LEASE_MS, type ClaimPlan } from "../src/measurement-queue";
import { MEASUREMENT_QUEUE_MAX, measurements, MEASUREMENTS_PER_WINDOW, type Completion } from "../src/measurements";
import { retention } from "../src/retention";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Revue de sécurité C13 : ce qui protège la dépense de la plateforme ne doit pas tenir à des lignes que l'utilisateur
 * peut faire disparaître (effacement du compte), ni se laisser contourner par des comptes jetables ou une exécution
 * périmée. Chaque test travaille sur son propre jour, loin des autres, pour que les fenêtres glissantes ne se mêlent pas.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-14T10:00:00Z");
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const at = (ms: number): Date => new Date(NOW.getTime() + ms);

const PLAN: ClaimPlan = { engines: ["anthropic"], reserveCents: 600, dailyCapCents: 1_000_000, monthlyCapCents: 1_000_000 };

const completion = (costCents: number): Completion => ({
  measuredAt: NOW,
  draws: 20,
  engines: ["anthropic"],
  funnel: [{ engine: "anthropic", draws: 20, retrieved: { successes: 6 }, named: { successes: 4 }, top5: { successes: 3 }, cited: { successes: 2 } }],
  costCents,
  stoppedEarly: false,
});

let sequence = 0;

/** Un freelance publié, compte créé il y a deux jours, qui prouve `url` (une adresse neuve par défaut). */
const freelancer = async (url?: string, createdAt: Date = new Date(NOW.getTime() - 2 * DAY)): Promise<{ userId: string; profileId: string }> => {
  sequence += 1;
  const userId = await createUser(t.db);
  await t.db.user.update({ where: { id: userId }, data: { createdAt } });
  const profileId = await createProfile(t.db, userId);
  const proven = url ?? `https://ledger-${sequence}.example.fr/`;
  await t.db.ownedUrl.create({ data: { profileId, url: proven, urlKey: proven.replace(/\/$/, ""), proofMethod: "well_known_file", verifiedAt: NOW } });
  return { userId, profileId };
};

const drain = async (): Promise<void> => {
  await t.db.measurementRequest.updateMany({ where: { status: { in: ["queued", "running"] } }, data: { status: "failed", finishedAt: NOW, leasedUntil: null, errorCode: "test_drain" } });
};

/** Demande, prise en charge et fin d'une mesure, au jour `when`. */
const measured = async (userId: string, when: Date, costCents: number): Promise<string> => {
  const repo = measurements(t.db);
  const queued = await repo.request({ userId }, when);
  if (queued.kind !== "queued") throw new Error(`refusée : ${queued.reason}`);
  const { claimed } = await repo.claim(1, when, PLAN);
  const run = claimed[0];
  if (run === undefined) throw new Error("non prise en charge");
  expect(await repo.complete(run, completion(costCents), when)).toBe("done");
  return queued.id;
};

describe("le registre de dépense survit à l'effacement du compte", () => {
  it("une dépense terminée reste comptée sur les plafonds après l'effacement de celui qui l'a demandée", async () => {
    await drain();
    const day = at(600 * DAY);
    const spender = await freelancer();
    await measured(spender.userId, day, 300);
    expect(await gdpr(t.db).eraseUser(spender.userId)).toBe("erased");

    const next = await freelancer();
    await measurements(t.db).request({ userId: next.userId }, day);
    // 300 déjà dépensés : il ne reste pas de quoi réserver 600 sous 800.
    expect(await measurements(t.db).claim(1, day, { ...PLAN, dailyCapCents: 800 })).toEqual({ claimed: [], held: "daily_cap" });
    expect((await measurements(t.db).claim(1, day, { ...PLAN, dailyCapCents: 900 })).claimed).toHaveLength(1);
  });

  it("un effacement pendant la mesure laisse sa réserve comptée au pire cas, puis la fin réelle la règle", async () => {
    await drain();
    const day = at(620 * DAY);
    const runner = await freelancer();
    const repo = measurements(t.db);
    await repo.request({ userId: runner.userId }, day);
    const { claimed } = await repo.claim(1, day, PLAN);
    const run = claimed[0];
    if (run === undefined) throw new Error("non prise en charge");
    expect(await gdpr(t.db).eraseUser(runner.userId)).toBe("erased");

    const next = await freelancer();
    await repo.request({ userId: next.userId }, day);
    expect(await repo.claim(1, day, { ...PLAN, dailyCapCents: 1_000 })).toEqual({ claimed: [], held: "daily_cap" });
    // La mesure se termine malgré tout : la demande a disparu, mais sa dépense réelle est inscrite au registre.
    expect(await repo.complete(run, completion(250), at(620 * DAY + MINUTE))).toBe("not_running");
    expect(await t.db.measurementSpend.findFirstOrThrow({ where: { requestId: run.id } })).toMatchObject({ reservedCents: 600, actualCents: 250 });
    expect((await repo.claim(1, at(620 * DAY + MINUTE), { ...PLAN, dailyCapCents: 1_000 })).claimed).toHaveLength(1);
  });

  it("une réserve orpheline expire au pire cas : elle ne bloque pas les plafonds au-delà de sa fenêtre", async () => {
    await drain();
    const day = at(640 * DAY);
    const runner = await freelancer();
    const repo = measurements(t.db);
    await repo.request({ userId: runner.userId }, day);
    const { claimed } = await repo.claim(1, day, PLAN);
    expect(await gdpr(t.db).eraseUser(runner.userId)).toBe("erased");
    // Passé le bail, la réserve est réglée au pire cas…
    await repo.claim(1, at(640 * DAY + MEASUREMENT_LEASE_MS + MINUTE), PLAN);
    expect(await t.db.measurementSpend.findFirstOrThrow({ where: { requestId: claimed[0]?.id ?? "" } })).toMatchObject({ actualCents: 600 });
    // … et sort de la fenêtre de 24 heures comme n'importe quelle dépense.
    const next = await freelancer();
    await repo.request({ userId: next.userId }, at(642 * DAY));
    expect((await repo.claim(1, at(642 * DAY), { ...PLAN, dailyCapCents: 600 })).claimed).toHaveLength(1);
  });

  it("la limite par profil survit à l'effacement : la même adresse prouvée sur un compte neuf reste au compteur", async () => {
    await drain();
    const site = "https://revenant.example.fr/";
    const first = await freelancer(site);
    for (let i = 0; i < MEASUREMENTS_PER_WINDOW; i += 1) await measured(first.userId, at(660 * DAY + i * HOUR), 80);
    expect(await gdpr(t.db).eraseUser(first.userId)).toBe("erased");

    // Même domaine, prouvé sur un autre chemin, par un compte neuf : la place ne se libère qu'à la date prévue.
    const again = await freelancer("https://www.revenant.example.fr/a-propos");
    expect(await measurements(t.db).request({ userId: again.userId }, at(661 * DAY))).toEqual({ kind: "refused", reason: "monthly_limit", availableAt: at(690 * DAY) });
    expect(await measurements(t.db).request({ userId: again.userId }, at(690 * DAY + MINUTE))).toMatchObject({ kind: "queued" });
  });

  it("le registre ne garde que 60 jours", async () => {
    const report = await retention(t.db).purge(at(1_000 * DAY));
    expect(report.measurementSpend).toBeGreaterThan(0);
    expect(await t.db.measurementSpend.count({ where: { startedAt: { lt: at(940 * DAY) } } })).toBe(0);
  });
});

describe("garde-fous de la file", () => {
  it("un compte de moins de 24 heures attend", async () => {
    const fresh = await freelancer(undefined, at(700 * DAY));
    expect(await measurements(t.db).request({ userId: fresh.userId }, at(700 * DAY + HOUR))).toEqual({ kind: "refused", reason: "too_recent", availableAt: at(701 * DAY) });
    expect(await measurements(t.db).request({ userId: fresh.userId }, at(701 * DAY))).toMatchObject({ kind: "queued" });
  });

  it(`au-delà de ${MEASUREMENT_QUEUE_MAX} demandes en file sur la plateforme, une nouvelle demande est refusée`, async () => {
    await drain();
    const repo = measurements(t.db);
    for (let i = 0; i < MEASUREMENT_QUEUE_MAX; i += 1) {
      const { userId } = await freelancer();
      expect(await repo.request({ userId }, at(720 * DAY))).toMatchObject({ kind: "queued" });
    }
    const late = await freelancer();
    expect(await repo.request({ userId: late.userId }, at(720 * DAY))).toEqual({ kind: "refused", reason: "platform_busy", availableAt: null });
    expect(await repo.eligibility({ userId: late.userId }, at(720 * DAY))).toMatchObject({ kind: "refused", reason: "platform_busy" });
    await drain();
  });

  it("toute demande qui a coûté compte, quel que soit son état (un refus payé aussi)", async () => {
    await drain();
    const { userId } = await freelancer();
    const repo = measurements(t.db);
    const day = at(740 * DAY);
    for (let i = 0; i < MEASUREMENTS_PER_WINDOW; i += 1) {
      const queued = await repo.request({ userId }, day);
      if (queued.kind !== "queued") throw new Error(queued.reason);
      const { claimed } = await repo.claim(1, day, PLAN);
      await repo.refuse(claimed[0] ?? { id: queued.id, attempts: 1 }, { code: "not_published", costCents: 15 }, day);
    }
    expect(await repo.eligibility({ userId }, day)).toMatchObject({ kind: "refused", reason: "monthly_limit" });
  });

  it("une exécution périmée ne clôt jamais l'essai suivant de la même demande", async () => {
    await drain();
    const { userId } = await freelancer();
    const repo = measurements(t.db);
    const day = at(760 * DAY);
    const queued = await repo.request({ userId }, day);
    if (queued.kind !== "queued") throw new Error(queued.reason);
    const stale = (await repo.claim(1, day, PLAN)).claimed[0];
    const later = at(760 * DAY + MEASUREMENT_LEASE_MS + MINUTE);
    const fresh = (await repo.claim(1, later, PLAN)).claimed[0];
    if (stale === undefined || fresh === undefined) throw new Error("non prise en charge");
    expect([stale.attempts, fresh.attempts]).toEqual([1, 2]);

    expect(await repo.complete(stale, completion(10), later)).toBe("not_running");
    await repo.fail(stale, { code: "unexpected", costCents: 5, retry: false }, later);
    await repo.refuse(stale, { code: "not_published", costCents: 0 }, later);
    expect(await t.db.measurementRequest.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: "running", attempts: 2 });
    expect(await repo.complete(fresh, completion(20), later)).toBe("done");
  });
});
