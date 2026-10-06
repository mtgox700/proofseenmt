import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { visibility, type WaveRecord } from "../src/visibility";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const stage = (successes: number) => ({ successes });

const wave = (reference: string, waveId: string, cited: number): WaveRecord => ({
  waveId,
  reference,
  measuredAt: new Date(`2026-10-0${waveId.endsWith("2") ? 5 : 1}T10:00:00Z`),
  draws: 240,
  costCents: 628,
  currency: "USD",
  funnel: [
    { engine: "anthropic", draws: 80, retrieved: stage(cited), named: stage(cited), top5: stage(cited), cited: stage(cited) },
    { engine: "openai", draws: 80, retrieved: stage(0), named: stage(0), top5: stage(0), cited: stage(0) },
  ],
});

describe("visibilité mesurée", () => {
  it("rattache une vague au profil de même référence, et ne la montre qu'à lui", async () => {
    const me = await createUser(t.db);
    const profileId = await createProfile(t.db, me);
    const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } });

    expect(await visibility(t.db).record(wave(reference, "AUDIT-1", 5))).toEqual({ linked: true });
    await visibility(t.db).record(wave(reference, "AUDIT-2", 9));
    const mine = await visibility(t.db).mine({ userId: me });
    expect(mine.map((w) => w.waveId)).toEqual(["AUDIT-2", "AUDIT-1"]);
    expect(mine[0]?.engines).toEqual([
      { engine: "anthropic", draws: 80, retrieved: 9, named: 9, top5: 9, cited: 9 },
      { engine: "openai", draws: 80, retrieved: 0, named: 0, top5: 0, cited: 0 },
    ]);
    expect(await visibility(t.db).mine({ userId: await createUser(t.db) })).toEqual([]);
  });

  it("réimporter une vague remplace ses chiffres sans les dupliquer", async () => {
    const me = await createUser(t.db);
    const profileId = await createProfile(t.db, me);
    const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } });
    await visibility(t.db).record(wave(reference, "AUDIT-R", 3));
    await visibility(t.db).record(wave(reference, "AUDIT-R", 4));
    const [only] = await visibility(t.db).mine({ userId: me });
    expect(only?.engines.find((e) => e.engine === "anthropic")?.cited).toBe(4);
    expect(await t.db.visibilityResult.count({ where: { wave: { waveId: "AUDIT-R" } } })).toBe(2);
  });

  it("garde une vague sans profil correspondant, et refuse des comptes incohérents", async () => {
    expect(await visibility(t.db).record(wave("FR-ZZZZZ", "AUDIT-ORPHAN", 1))).toEqual({ linked: false });
    const broken = wave("FR-ZZZZZ", "AUDIT-BAD", 1);
    await expect(visibility(t.db).record({ ...broken, funnel: [{ ...broken.funnel[0]!, cited: stage(81) }] })).rejects.toThrow(/plus de succès/);
  });
});
