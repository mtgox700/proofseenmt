import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { commissionTermsFromEnv, DEFAULT_REPEAT_COMMISSION_BP, type CommissionTerms } from "../src/commission-terms";
import { contracts } from "../src/contracts";
import { payments } from "../src/payments";
import { activeContract } from "./support/active-contract";
import { DB_STARTUP_MS, fakeGateway, openTestDatabase, TEST_COMMISSION_BP, type TestDatabase } from "./support/database";

/*
 * K3 : le taux de commission est une condition du contrat, écrite à sa création et figée. Le paiement la lit sur le
 * contrat, jamais dans la configuration du moment : le freelance ne paie pas un taux qu'il n'a pas signé. Le paquet db
 * ne lit pas l'environnement : l'appelant fournit les conditions (`commissionTerms`).
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const rateOf = (id: string) => t.db.contract.findUniqueOrThrow({ where: { id }, select: { commissionBp: true, feePayer: true } });
const terms = (commissionBp: number, repeatCommissionBp = 500): { commissionTerms: () => CommissionTerms } => ({ commissionTerms: () => ({ commissionBp, repeatCommissionBp }) });

/** Comme en production quand aucun taux n'est fourni : pas de défaut en base (celui de la base de test est retiré le temps de l'appel). */
const withoutDefault = async <T>(run: () => Promise<T>): Promise<T> => {
  await t.pg.exec(`ALTER TABLE "Contract" ALTER COLUMN "commissionBp" DROP DEFAULT`);
  try {
    return await run();
  } finally {
    await t.pg.exec(`ALTER TABLE "Contract" ALTER COLUMN "commissionBp" SET DEFAULT ${TEST_COMMISSION_BP}`);
  }
};

describe("lecture de la configuration (frontière de l'application)", () => {
  it.each([
    [{ PROOFSEEN_COMMISSION_BP: "1000" }, { commissionBp: 1000, repeatCommissionBp: DEFAULT_REPEAT_COMMISSION_BP }],
    [{ PROOFSEEN_COMMISSION_BP: " 1200 ", PROOFSEEN_REPEAT_COMMISSION_BP: "300" }, { commissionBp: 1200, repeatCommissionBp: 300 }],
    // Une faute de frappe sur la fidélité ne retire pas la remise publiée : repli sur le taux par défaut.
    [{ PROOFSEEN_COMMISSION_BP: "1000", PROOFSEEN_REPEAT_COMMISSION_BP: "abc" }, { commissionBp: 1000, repeatCommissionBp: DEFAULT_REPEAT_COMMISSION_BP }],
    [{}, null],
    [{ PROOFSEEN_COMMISSION_BP: "" }, null],
    [{ PROOFSEEN_COMMISSION_BP: "0" }, null],
    [{ PROOFSEEN_COMMISSION_BP: "5001" }, null],
    [{ PROOFSEEN_COMMISSION_BP: "10.5" }, null],
    [{ PROOFSEEN_COMMISSION_BP: "dix" }, null],
  ])("%j → %j", (env, expected) => {
    expect(commissionTermsFromEnv(env)).toEqual(expected);
  });
});

describe("écrit à la création", () => {
  it("le contrat reçoit le taux fourni par l'appelant et le payeur actuel (le freelance, décision D5 en attente)", async () => {
    const c = await activeContract(t.db, { contracts: terms(1200) });
    expect(await rateOf(c.id)).toEqual({ commissionBp: 1200, feePayer: "freelance" });
  });

  it("est montré dans le contrat rendu aux parties, avant qu'elles signent", async () => {
    const c = await activeContract(t.db, { contracts: terms(900) });
    expect(await contracts(t.db).find({ userId: c.recruiter }, c.id)).toMatchObject({ commissionBp: 900, feePayer: "freelance" });
    expect(await contracts(t.db).find({ userId: c.freelanceUser }, c.id)).toMatchObject({ commissionBp: 900, feePayer: "freelance" });
  });

  it("sans conditions fournies, le contrat naît sans taux et aucun paiement ne s'ouvre dessus", async () => {
    const c = await withoutDefault(() => activeContract(t.db));
    expect(await rateOf(c.id)).toEqual({ commissionBp: null, feePayer: "freelance" });
    const { gateway, calls } = fakeGateway();
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, gateway)).toEqual({ kind: "rate_missing" });
    expect(calls.intents).toBe(0);
  });

  it("ne lit jamais l'environnement : une variable posée n'entre pas dans le contrat", async () => {
    vi.stubEnv("PROOFSEEN_COMMISSION_BP", "2500");
    try {
      const c = await withoutDefault(() => activeContract(t.db));
      expect(await rateOf(c.id)).toMatchObject({ commissionBp: null });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("changer la configuration ne change pas un contrat existant", () => {
  it("le paiement ouvert après un changement de taux prélève le taux du contrat", async () => {
    let today: CommissionTerms = { commissionBp: 1000, repeatCommissionBp: 500 };
    const c = await activeContract(t.db, { contracts: { commissionTerms: () => today } });
    // Le founder change le taux (ou une faute de frappe) entre la signature et le paiement.
    today = { commissionBp: 2500, repeatCommissionBp: 500 };
    const opened = await payments(t.db).open({ userId: c.recruiter }, c.id, fakeGateway().gateway);
    // 10 jours à 600 € HT = 6 000 € : 10 %, pas 25 %.
    expect(opened).toMatchObject({ kind: "opened", amountCents: 720_000, commissionCents: 60_000 });
    expect(await rateOf(c.id)).toMatchObject({ commissionBp: 1000 });
  });

  it("même si la configuration disparaît", async () => {
    let today: CommissionTerms | null = { commissionBp: 1000, repeatCommissionBp: 500 };
    const c = await activeContract(t.db, { contracts: { commissionTerms: () => today } });
    today = null;
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, fakeGateway().gateway)).toMatchObject({ kind: "opened", commissionCents: 60_000 });
  });
});

describe("la base fige le taux et le payeur", () => {
  it("refuse une mise à jour du taux", async () => {
    const c = await activeContract(t.db, { contracts: terms(1000) });
    await expect(t.db.contract.update({ where: { id: c.id }, data: { commissionBp: 1 } })).rejects.toThrow(/taux de commission figé/);
    expect(await rateOf(c.id)).toMatchObject({ commissionBp: 1000 });
  });

  it("un contrat né sans taux peut en recevoir un, une seule fois (nul vers valeur), puis il est figé ; le payeur ne change jamais", async () => {
    const c = await withoutDefault(() => activeContract(t.db));
    await t.db.contract.update({ where: { id: c.id }, data: { commissionBp: 1000 } });
    expect(await rateOf(c.id)).toMatchObject({ commissionBp: 1000 });
    await expect(t.db.contract.update({ where: { id: c.id }, data: { commissionBp: 1100 } })).rejects.toThrow(/taux de commission figé/);
    await expect(t.db.contract.update({ where: { id: c.id }, data: { commissionBp: null } })).rejects.toThrow(/taux de commission figé/);
    await expect(t.db.contract.update({ where: { id: c.id }, data: { feePayer: "company" } })).rejects.toThrow(/payeur de la commission figé/);
    // Ce contrat est maintenant payable : le taux posé est celui que le paiement lit.
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, fakeGateway().gateway)).toMatchObject({ kind: "opened", commissionCents: 60_000 });
  });

  it("refuse un taux hors bornes à l'insertion", async () => {
    const c = await activeContract(t.db, { contracts: terms(1000) });
    const snapshots = await t.db.contract.findUniqueOrThrow({ where: { id: c.id }, select: { sellerSnapshot: true, buyerSnapshot: true } });
    const base = { organisationId: c.org, profileId: c.profile, dailyRateCents: 100, days: 1, totalCents: 100, currency: "EUR", sellerSnapshot: snapshots.sellerSnapshot ?? {}, buyerSnapshot: snapshots.buyerSnapshot ?? {}, startsOn: new Date("2026-11-02") };
    await expect(t.db.contract.create({ data: { ...base, commissionBp: 0 } })).rejects.toThrow();
    await expect(t.db.contract.create({ data: { ...base, commissionBp: 5001 } })).rejects.toThrow();
  });
});
