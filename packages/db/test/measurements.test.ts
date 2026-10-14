import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gdpr } from "../src/gdpr";
import { MEASUREMENT_LEASE_MS, MEASUREMENT_MAX_ATTEMPTS, type ClaimPlan } from "../src/measurement-queue";
import { measurements, MEASUREMENTS_PER_WINDOW, measurementWaveId, type Completion } from "../src/measurements";
import { retention } from "../src/retention";
import { visibility } from "../src/visibility";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-14T10:00:00Z");
const MINUTE = 60_000;
const DAY = 86_400_000;
const at = (ms: number): Date => new Date(NOW.getTime() + ms);

/** Plafonds larges : la file n'est retenue que par les tests qui le demandent. */
const PLAN: ClaimPlan = { engines: ["anthropic"], reserveCents: 600, dailyCapCents: 1_000_000, monthlyCapCents: 1_000_000 };

let urlSequence = 0;
const proveUrl = async (profileId: string, verified = true): Promise<void> => {
  urlSequence += 1;
  const url = `https://site-${urlSequence}.example.fr/`;
  await t.db.ownedUrl.create({ data: { profileId, url, urlKey: url.slice(0, -1), proofMethod: "well_known_file", verifiedAt: verified ? NOW : null } });
};

/** Un compte créé avant NOW : un compte de moins de 24 heures ne peut pas encore demander de mesure. */
const settledAccount = async (): Promise<string> => {
  const userId = await createUser(t.db);
  await t.db.user.update({ where: { id: userId }, data: { createdAt: new Date(NOW.getTime() - 2 * DAY) } });
  return userId;
};

/** Un freelance publié avec une adresse prouvée : le seul cas où une mesure est acceptée. */
const eligibleFreelancer = async (): Promise<{ userId: string; profileId: string }> => {
  const userId = await settledAccount();
  const profileId = await createProfile(t.db, userId);
  await proveUrl(profileId);
  return { userId, profileId };
};

/** La référence d'un premier essai : fin, échec et refus ne valent que pour l'essai en cours. */
const firstRun = (id: string): { id: string; attempts: number } => ({ id, attempts: 1 });

const stage = (successes: number) => ({ successes });
const completion = (costCents: number): Completion => ({
  measuredAt: NOW,
  draws: 20,
  engines: ["anthropic"],
  funnel: [{ engine: "anthropic", draws: 20, retrieved: stage(6), named: stage(4), top5: stage(3), cited: stage(2) }],
  costCents,
  stoppedEarly: false,
});

/** Vide la file pour qu'un test ne prenne pas les demandes laissées par un autre. */
const drain = async (): Promise<void> => {
  await t.db.measurementRequest.updateMany({
    where: { status: { in: ["queued", "running"] } },
    data: { status: "failed", finishedAt: NOW, leasedUntil: null, errorCode: "test_drain" },
  });
};

describe("demander une mesure", () => {
  it("refuse sans profil, sans profil publié, sans adresse prouvée — une adresse non prouvée ne compte pas", async () => {
    const repo = measurements(t.db);
    const nobody = await createUser(t.db);
    expect(await repo.request({ userId: nobody }, NOW)).toMatchObject({ kind: "refused", reason: "no_profile" });

    const draft = await createUser(t.db);
    const draftProfile = await createProfile(t.db, draft, "private");
    await proveUrl(draftProfile);
    expect(await repo.request({ userId: draft }, NOW)).toMatchObject({ kind: "refused", reason: "not_published" });

    const unproven = await createUser(t.db);
    await proveUrl(await createProfile(t.db, unproven), false);
    expect(await repo.request({ userId: unproven }, NOW)).toMatchObject({ kind: "refused", reason: "no_proven_url" });
    expect(await t.db.measurementRequest.count({ where: { requestedByUserId: { in: [nobody, draft, unproven] } } })).toBe(0);
  });

  it("une seule demande active par profil, même sur deux clics simultanés", async () => {
    const { userId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    const results = await Promise.all([repo.request({ userId }, NOW), repo.request({ userId }, NOW)]);
    expect(results.filter((r) => r.kind === "queued")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "refused" && r.reason === "already_active")).toHaveLength(1);
    expect(await repo.eligibility({ userId }, NOW)).toMatchObject({ kind: "refused", reason: "already_active" });
  });

  it(`au plus ${MEASUREMENTS_PER_WINDOW} mesures par profil sur 30 jours ; un échec ne consomme pas de place`, async () => {
    await drain();
    const { userId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    for (let i = 0; i < MEASUREMENTS_PER_WINDOW; i += 1) {
      const queued = await repo.request({ userId }, at(i * DAY));
      if (queued.kind !== "queued") throw new Error(`demande ${i} refusée`);
      const { claimed } = await repo.claim(1, at(i * DAY), PLAN);
      expect(claimed.map((c) => c.id)).toEqual([queued.id]);
      expect(await repo.complete(firstRun(queued.id), completion(80), at(i * DAY))).toBe("done");
    }
    const refused = await repo.request({ userId }, at(5 * DAY));
    expect(refused).toEqual({ kind: "refused", reason: "monthly_limit", availableAt: at(30 * DAY) });
    // La place se libère quand la plus ancienne sort de la fenêtre.
    expect(await repo.request({ userId }, at(30 * DAY + MINUTE))).toMatchObject({ kind: "queued" });

    const other = await eligibleFreelancer();
    const first = await repo.request({ userId: other.userId }, NOW);
    if (first.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    await repo.fail(firstRun(first.id), { code: "engine_down", costCents: 0, retry: false }, NOW);
    expect(await repo.eligibility({ userId: other.userId }, NOW)).toEqual({ kind: "allowed", remaining: MEASUREMENTS_PER_WINDOW });

    // Un échec qui a coûté, lui, compte : redemander en boucle ne ferait pas payer la plateforme sans limite.
    const second = await repo.request({ userId: other.userId }, NOW);
    if (second.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    await repo.fail(firstRun(second.id), { code: "record_failed", costCents: 90, retry: false }, NOW);
    expect(await repo.eligibility({ userId: other.userId }, NOW)).toEqual({ kind: "allowed", remaining: MEASUREMENTS_PER_WINDOW - 1 });
  });

  it("un bail expiré ne rouvre jamais une demande terminée entre-temps", async () => {
    await drain();
    const { userId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    const queued = await repo.request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    // Fin tardive, après l'échéance du bail mais avant le passage suivant : elle fait foi.
    expect(await repo.complete(firstRun(queued.id), completion(70), at(MEASUREMENT_LEASE_MS + MINUTE))).toBe("done");
    expect((await repo.claim(1, at(MEASUREMENT_LEASE_MS + 2 * MINUTE), PLAN)).claimed).toEqual([]);
    expect(await t.db.measurementRequest.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: "done", costCents: 70 });
  });
});

describe("file des mesures", () => {
  it("prend en charge sous bail : deux exécutions qui se chevauchent ne prennent jamais la même demande", async () => {
    await drain();
    const a = await eligibleFreelancer();
    const b = await eligibleFreelancer();
    const repo = measurements(t.db);
    await repo.request({ userId: a.userId }, NOW);
    await repo.request({ userId: b.userId }, NOW);

    const [first, second] = await Promise.all([repo.claim(1, NOW, PLAN), repo.claim(1, NOW, PLAN)]);
    const ids = [...first.claimed, ...second.claimed].map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    // Plus rien à prendre tant que les baux courent.
    expect((await repo.claim(5, at(MINUTE), PLAN)).claimed).toEqual([]);

    const claimed = first.claimed[0];
    expect(claimed).toMatchObject({ attempts: 1, published: true, headline: "Dev", city: "Paris", workMode: "remote" });
    expect(claimed?.verifiedUrls).toHaveLength(1);
    const row = await t.db.measurementRequest.findUniqueOrThrow({ where: { id: claimed?.id ?? "" } });
    expect(row).toMatchObject({ status: "running", estimatedCostCents: 600, engines: ["anthropic"], leasedUntil: at(MEASUREMENT_LEASE_MS) });
  });

  it("un bail expiré rend la demande, sa dépense inconnue comptée au pire cas ; abandon après le dernier essai", async () => {
    await drain();
    const { userId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    const queued = await repo.request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error("refusée");
    let clock = NOW;
    for (let attempt = 1; attempt <= MEASUREMENT_MAX_ATTEMPTS; attempt += 1) {
      const { claimed } = await repo.claim(1, clock, PLAN);
      expect(claimed.map((c) => [c.id, c.attempts])).toEqual([[queued.id, attempt]]);
      clock = new Date(clock.getTime() + MEASUREMENT_LEASE_MS + MINUTE);
    }
    expect((await repo.claim(1, clock, PLAN)).claimed).toEqual([]);
    const row = await t.db.measurementRequest.findUniqueOrThrow({ where: { id: queued.id } });
    expect(row).toMatchObject({ status: "failed", errorCode: "lease_expired", costCents: 600 * MEASUREMENT_MAX_ATTEMPTS });
  });

  it("les plafonds de la plateforme retiennent la file, en comptant la dépense réelle et la réserve de ce qui tourne", async () => {
    await drain();
    const a = await eligibleFreelancer();
    const b = await eligibleFreelancer();
    const repo = measurements(t.db);
    const day = at(200 * DAY);
    await repo.request({ userId: a.userId }, day);
    await repo.request({ userId: b.userId }, day);

    // 600 réservés pour la première : il ne reste pas de quoi réserver la seconde sous 1 000.
    const tight = { ...PLAN, dailyCapCents: 1_000 };
    expect((await repo.claim(2, day, tight)).claimed).toHaveLength(1);
    expect(await repo.claim(1, day, tight)).toEqual({ claimed: [], held: "daily_cap" });

    // Terminée pour 300 réels : 700 restent sur 1 000, la seconde passe ; le plafond mensuel, lui, la retient.
    const running = await t.db.measurementRequest.findFirstOrThrow({ where: { status: "running" }, select: { id: true, attempts: true } });
    await repo.complete(running, completion(300), day);
    expect(await repo.claim(1, day, { ...tight, monthlyCapCents: 800 })).toEqual({ claimed: [], held: "monthly_cap" });
    expect((await repo.claim(1, day, tight)).claimed).toHaveLength(1);
  });

  it("enregistre la vague par le chemin des vagues : le freelance la voit, la demande la référence avec son coût", async () => {
    await drain();
    const { userId, profileId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    const queued = await repo.request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    expect(await repo.complete(firstRun(queued.id), { ...completion(123), stoppedEarly: true }, at(MINUTE))).toBe("done");
    // Rejouer une fin déjà enregistrée ne crée rien.
    expect(await repo.complete(firstRun(queued.id), completion(123), at(MINUTE))).toBe("not_running");

    const wave = await t.db.wave.findUniqueOrThrow({ where: { waveId: measurementWaveId(queued.id) } });
    expect(wave).toMatchObject({ profileId, draws: 20, costCents: 123, currency: "USD" });
    const [view] = await visibility(t.db).mine({ userId });
    expect(view?.engines).toEqual([{ engine: "anthropic", draws: 20, retrieved: 6, named: 4, top5: 3, cited: 2 }]);
    const [mine] = await repo.listMine({ userId });
    expect(mine).toMatchObject({ id: queued.id, status: "done", engines: ["anthropic"], errorCode: "budget_stopped", waveId: measurementWaveId(queued.id) });
  });

  it("un échec réessaie plus tard en cumulant la dépense ; un refus est définitif", async () => {
    await drain();
    const a = await eligibleFreelancer();
    const repo = measurements(t.db);
    const queued = await repo.request({ userId: a.userId }, NOW);
    if (queued.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    await repo.fail(firstRun(queued.id), { code: "unexpected", costCents: 40, retry: true }, NOW);
    expect(await t.db.measurementRequest.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: "queued", costCents: 40, runAfter: at(15 * MINUTE) });
    expect((await repo.claim(1, at(MINUTE), PLAN)).claimed).toEqual([]);
    expect((await repo.claim(1, at(16 * MINUTE), PLAN)).claimed).toHaveLength(1);
    await repo.refuse({ id: queued.id, attempts: 2 }, { code: "not_published", costCents: 0 }, at(16 * MINUTE));
    expect(await t.db.measurementRequest.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: "refused", costCents: 40, errorCode: "not_published" });
  });
});

describe("accès, RGPD et conservation", () => {
  it("chacun ne voit que ses demandes", async () => {
    const owner = await eligibleFreelancer();
    const stranger = await eligibleFreelancer();
    const repo = measurements(t.db);
    await repo.request({ userId: owner.userId }, at(400 * DAY));
    expect(await repo.listMine({ userId: stranger.userId })).toEqual([]);
    expect(await repo.listMine({ userId: owner.userId })).toHaveLength(1);
  });

  it("l'export rend vagues et demandes ; l'effacement emporte les deux", async () => {
    await drain();
    const { userId, profileId } = await eligibleFreelancer();
    const repo = measurements(t.db);
    const queued = await repo.request({ userId }, NOW);
    if (queued.kind !== "queued") throw new Error("refusée");
    await repo.claim(1, NOW, PLAN);
    await repo.complete(firstRun(queued.id), completion(50), NOW);

    const exported = await gdpr(t.db).exportUser(userId, NOW);
    expect(JSON.stringify(exported?.freelanceProfile)).toContain(measurementWaveId(queued.id));
    expect(exported?.freelanceProfile).toMatchObject({ measurements: [{ status: "done", engines: ["anthropic"] }] });

    expect(await gdpr(t.db).eraseUser(userId)).toBe("erased");
    expect(await t.db.wave.count({ where: { waveId: measurementWaveId(queued.id) } })).toBe(0);
    expect(await t.db.measurementRequest.count({ where: { profileId } })).toBe(0);
  });

  it("les demandes terminées depuis plus d'un an sont purgées, pas celles en file", async () => {
    await drain();
    const { userId } = await eligibleFreelancer();
    await measurements(t.db).request({ userId }, NOW);
    const report = await retention(t.db).purge(at(366 * DAY));
    expect(report.measurementRequests).toBeGreaterThan(0);
    expect(await t.db.measurementRequest.count({ where: { status: "queued", requestedByUserId: userId } })).toBe(1);
    expect(await t.db.measurementRequest.count({ where: { status: { in: ["done", "failed", "refused"] }, finishedAt: { lt: at(DAY) } } })).toBe(0);
  });
});
