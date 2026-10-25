import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_STARTUP_MS } from "./support/database";

/*
 * Migration 20261024100000_money_debts, jouée sur des données d'avant elle : les contrats existants reçoivent le taux
 * qui leur aurait été appliqué (celui du paiement quand il existe, sinon la règle de la logique d'avant), aucune date
 * d'encaissement n'est devinée, et les factures déjà émises ne sont pas touchées. Puis chaque règle nouvelle est attaquée.
 */

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, "../prisma/migrations");
const THIS_MIGRATION = "20261024100000_money_debts";

const migrationsSql = (keep: (name: string) => boolean): string =>
  readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && keep(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"))
    .join("\n");

const SNAPSHOT = JSON.stringify({ legalName: "Test", country: "FR" });
let pg: PGlite;
let org = "";
let prof = "";
let seq = 0;

const id = async (sql: string, params: unknown[] = []): Promise<string> => {
  const { rows } = await pg.query<{ id: string }>(`${sql} RETURNING "id"`, params);
  return rows[0]?.id ?? "";
};

/** Un contrat actif ; `repeat` = freelance déjà payé par l'entreprise à sa création. */
const contract = (total: number, repeat: boolean): Promise<string> =>
  id(
    `INSERT INTO "Contract" ("id","organisationId","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn","acceptedByFreelanceAt","acceptedByOrgAt","status","repeatClient")
     VALUES (gen_random_uuid(), $1, $2, $3, 1, $3, 'EUR', $4, $4, '2026-11-01', now(), now(), 'active', $5)`,
    [org, prof, total, SNAPSHOT, repeat],
  );

const payment = async (contractId: string, total: number, commission: number, status = "held", createdAt = "2026-11-10T10:00:00Z"): Promise<string> => {
  seq += 1;
  return id(
    `INSERT INTO "Payment" ("id","contractId","amountCents","commissionCents","currency","stripeIntentId","status","createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, 'EUR', $4, $5, $6)`,
    [contractId, total, commission, `pi_mig${seq}`, status, createdAt],
  );
};

const invoice = async (contractId: string, kind: "mission" | "commission", issuedAt: string, dueOn: string, paidOn: string | null = null): Promise<void> => {
  seq += 1;
  await pg.query(
    `INSERT INTO "Invoice" ("id","number","kind","issuer","contractId","label","netCents","vatCents","vatRateBp","totalCents","currency","sellerSnapshot","buyerSnapshot","issuedAt","dueOn"${paidOn === null ? "" : ',"paidOn"'})
     VALUES (gen_random_uuid(), $1, $2, 'proofseen', $3, 'Prestation', 100, 20, 2000, 120, 'EUR', $4, $4, $5, $6${paidOn === null ? "" : ", $7"})`,
    paidOn === null ? [`T-${seq}`, kind, contractId, SNAPSHOT, issuedAt, dueOn] : [`T-${seq}`, kind, contractId, SNAPSHOT, issuedAt, dueOn, paidOn],
  );
};

const seeded: Record<string, string> = {};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(migrationsSql((name) => name < THIS_MIGRATION));
  const user = await id(`INSERT INTO "User" ("id","clerkId","email","displayName") VALUES (gen_random_uuid(), 'mig', 'mig@test.fr', 'x')`);
  prof = await id(
    `INSERT INTO "FreelanceProfile" ("id","userId","reference","visibility","slug","headline","summary","city","workMode")
     VALUES (gen_random_uuid(), $1, 'FR-MIGRA', 'pseudonymous', 'mig', 'Dev', 'Résumé', 'Paris', 'remote')`,
    [user],
  );
  org = await id(`INSERT INTO "Organisation" ("id","name","kind") VALUES (gen_random_uuid(), 'Acme', 'pme')`);
  await pg.query(`INSERT INTO "Membership" ("organisationId","userId","role") VALUES ($1, $2, 'owner')`, [org, user]);

  seeded.plain = await contract(600_000, false);
  seeded.repeat = await contract(600_000, true);
  // Le paiement ouvert à 12 % fait foi, même si la règle d'avant aurait donné 10 %.
  seeded.paidTwelve = await contract(600_000, false);
  await payment(seeded.paidTwelve, 720_000, 72_000);
  // Fidélité mais payé au taux plein : le paiement fait foi sur la règle.
  seeded.repeatPaidFull = await contract(600_000, true);
  await payment(seeded.repeatPaidFull, 720_000, 60_000);
  // 10 % de 333 centimes = 33 : relire le taux à partir de 33 donnerait 991 pb ; on retrouve 1000.
  seeded.rounding = await contract(333, false);
  await payment(seeded.rounding, 333, 33);
  // Un paiement annulé n'est pas un fait de prélèvement : la règle s'applique.
  seeded.canceledOnly = await contract(600_000, true);
  await payment(seeded.canceledOnly, 720_000, 99_999, "canceled");
  // Très petit total : le taux relu (10 000 pb) sort des bornes et est écrêté à 5 000.
  seeded.tiny = await contract(1, false);
  await payment(seeded.tiny, 1, 1);
  // Deux paiements : l'abandonné, plus ancien, ne compte pas ; le bloqué, plus récent, fait foi.
  seeded.twoPayments = await contract(600_000, false);
  await payment(seeded.twoPayments, 720_000, 99_999, "canceled", "2026-11-01T10:00:00Z");
  await payment(seeded.twoPayments, 720_000, 72_000, "held", "2026-11-02T10:00:00Z");
  // Le paiement échoué, plus récent, ne compte pas non plus.
  seeded.failedAfter = await contract(600_000, false);
  await payment(seeded.failedAfter, 720_000, 72_000, "held", "2026-11-01T10:00:00Z");
  await payment(seeded.failedAfter, 720_000, 99_999, "failed", "2026-11-02T10:00:00Z");
  // Remboursé.
  seeded.refunded = await contract(600_000, false);
  const refunded = await payment(seeded.refunded, 720_000, 72_000);
  await pg.query(`UPDATE "Payment" SET "status" = 'refunded', "refundedCents" = 720000 WHERE "id" = $1`, [refunded]);
  // Terminé et versé, avec ses deux factures d'avant (échéance à trente jours) : le rétro-remplissage met à jour un contrat
  // « completed », donc passe par ses déclencheurs ; les factures immuables ne bougent pas.
  seeded.completed = await contract(600_000, false);
  const released = await payment(seeded.completed, 720_000, 72_000);
  await pg.query(`UPDATE "Contract" SET "status" = 'completed' WHERE "id" = $1`, [seeded.completed]);
  await pg.query(`UPDATE "Payment" SET "status" = 'releasing', "claimedAt" = now() WHERE "id" = $1`, [released]);
  await pg.query(`UPDATE "Payment" SET "status" = 'released', "transferId" = 'tr_mig', "releasedAt" = now() WHERE "id" = $1`, [released]);
  await invoice(seeded.completed, "mission", "2026-11-20T10:00:00Z", "2026-12-20");
  await invoice(seeded.completed, "commission", "2026-11-20T10:00:00Z", "2026-12-20");

  await pg.exec(readFileSync(join(MIGRATIONS, THIS_MIGRATION, "migration.sql"), "utf8"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await pg.close();
});

const paymentOf = async (key: string): Promise<string> => {
  const { rows } = await pg.query<{ id: string }>(`SELECT "id" FROM "Payment" WHERE "contractId" = $1 AND "status" NOT IN ('canceled','failed') ORDER BY "createdAt" DESC LIMIT 1`, [seeded[key]]);
  return rows[0]?.id ?? "";
};

const rate = async (key: string): Promise<{ commissionBp: number; feePayer: string }> => {
  const { rows } = await pg.query<{ commissionBp: number; feePayer: string }>(`SELECT "commissionBp", "feePayer"::text FROM "Contract" WHERE "id" = $1`, [seeded[key]]);
  const [row] = rows;
  if (row === undefined) throw new Error(key);
  return row;
};

describe("rétro-remplissage du taux des contrats existants", () => {
  it.each([
    ["plain", 1000, "sans paiement : le taux standard de la décision du 2026-10-07"],
    ["repeat", 500, "sans paiement, fidélité : le taux de fidélité, plus bas"],
    ["paidTwelve", 1200, "le taux réellement appliqué au paiement"],
    ["repeatPaidFull", 1000, "le paiement fait foi sur la règle"],
    ["rounding", 1000, "un taux rond est retrouvé malgré l'arrondi au centime"],
    ["canceledOnly", 500, "un paiement annulé ne compte pas : règle de fidélité"],
    ["tiny", 5000, "un taux relu hors bornes est écrêté"],
    ["twoPayments", 1200, "deux paiements : le plus récent non abandonné fait foi"],
    ["failedAfter", 1200, "un paiement échoué, plus récent, ne compte pas"],
    ["refunded", 1200, "un paiement remboursé garde son taux"],
    ["completed", 1200, "un contrat terminé et versé est rétro-rempli malgré ses déclencheurs"],
  ])("%s → %i pb (%s)", async (key, expected) => {
    expect(await rate(key)).toEqual({ commissionBp: expected, feePayer: "freelance" });
  });

  it("le payeur actuel (le freelance) est écrit sur tous les contrats existants, et aucun n'est resté sans taux", async () => {
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Contract" WHERE "feePayer" <> 'freelance' OR "commissionBp" IS NULL`);
    expect(rows[0]?.n).toBe(0);
  });
});

describe("paiements et factures déjà là", () => {
  it("aucune date d'encaissement ni charge n'est devinée : tout reste nul (H3)", async () => {
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Payment" WHERE "paidAt" IS NOT NULL OR "chargeId" IS NOT NULL`);
    expect(rows[0]?.n).toBe(0);
  });

  it("les factures déjà émises ne sont pas touchées : ni acquittement, ni échéance", async () => {
    const { rows } = await pg.query<{ paidOn: Date | null; dueOn: Date }>(`SELECT "paidOn","dueOn" FROM "Invoice" WHERE "contractId" = $1`, [seeded.completed]);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.paidOn).toBeNull();
      expect(row.dueOn.toISOString().slice(0, 10)).toBe("2026-12-20");
    }
  });
});

describe("la charge d'un paiement", () => {
  it("peut être posée une fois sur un paiement qui n'en avait pas, jamais réécrite ni effacée", async () => {
    const paymentId = await paymentOf("paidTwelve");
    await pg.query(`UPDATE "Payment" SET "chargeId" = 'ch_une' WHERE "id" = $1`, [paymentId]);
    await expect(pg.query(`UPDATE "Payment" SET "chargeId" = 'ch_autre' WHERE "id" = $1`, [paymentId])).rejects.toThrow(/charge/);
    await expect(pg.query(`UPDATE "Payment" SET "chargeId" = NULL WHERE "id" = $1`, [paymentId])).rejects.toThrow(/charge/);
  });

  it("ne finance qu'un seul paiement (unicité)", async () => {
    const first = await paymentOf("rounding");
    const second = await paymentOf("repeatPaidFull");
    await pg.query(`UPDATE "Payment" SET "chargeId" = 'ch_partagee' WHERE "id" = $1`, [first]);
    await expect(pg.query(`UPDATE "Payment" SET "chargeId" = 'ch_partagee' WHERE "id" = $1`, [second])).rejects.toThrow(/unique|duplicate/i);
  });
});

describe("la date d'encaissement d'un paiement (M4)", () => {
  it("se pose une fois (nul vers valeur) et ne se réécrit ni ne s'efface", async () => {
    const paymentId = await paymentOf("tiny");
    await pg.query(`UPDATE "Payment" SET "paidAt" = '2026-11-18T09:30:00Z' WHERE "id" = $1`, [paymentId]);
    await expect(pg.query(`UPDATE "Payment" SET "paidAt" = '2026-11-19T09:30:00Z' WHERE "id" = $1`, [paymentId])).rejects.toThrow(/date d'encaissement/);
    await expect(pg.query(`UPDATE "Payment" SET "paidAt" = NULL WHERE "id" = $1`, [paymentId])).rejects.toThrow(/date d'encaissement/);
  });
});

describe("le taux et le payeur du contrat (H1)", () => {
  it("un contrat sans taux peut en recevoir un, une seule fois : nul vers 1000 passe, 1000 vers 1100 échoue, 1000 vers nul échoue", async () => {
    const withoutRate = await id(
      `INSERT INTO "Contract" ("id","organisationId","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn")
       VALUES (gen_random_uuid(), $1, $2, 60000, 1, 60000, 'EUR', $3, $3, '2026-11-01')`,
      [org, prof, SNAPSHOT],
    );
    const { rows } = await pg.query<{ commissionBp: number | null }>(`SELECT "commissionBp" FROM "Contract" WHERE "id" = $1`, [withoutRate]);
    expect(rows[0]?.commissionBp).toBeNull();
    await pg.query(`UPDATE "Contract" SET "commissionBp" = 1000 WHERE "id" = $1`, [withoutRate]);
    await expect(pg.query(`UPDATE "Contract" SET "commissionBp" = 1100 WHERE "id" = $1`, [withoutRate])).rejects.toThrow(/taux de commission figé/);
    await expect(pg.query(`UPDATE "Contract" SET "commissionBp" = NULL WHERE "id" = $1`, [withoutRate])).rejects.toThrow(/taux de commission figé/);
  });

  it("le payeur de la commission ne change jamais", async () => {
    await expect(pg.query(`UPDATE "Contract" SET "feePayer" = 'company' WHERE "id" = $1`, [seeded.plain])).rejects.toThrow(/payeur de la commission figé/);
  });

  it("refuse un taux hors bornes", async () => {
    await expect(pg.query(`UPDATE "Contract" SET "commissionBp" = 5001 WHERE "id" = $1`, [seeded.plain])).rejects.toThrow();
  });
});

describe("l'échéance d'une facture acquittée (CHECK Invoice_due_chk)", () => {
  const fresh = (): Promise<string> => contract(60_000, false);

  it("accepte une facture acquittée dont l'échéance est le jour du paiement, au plus tard le jour d'émission", async () => {
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-11-18", "2026-11-18")).resolves.toBeUndefined();
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-11-20", "2026-11-20")).resolves.toBeUndefined();
  });

  it("accepte toujours une facture non acquittée dont l'échéance suit l'émission, et refuse celle qui la précède", async () => {
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-12-20")).resolves.toBeUndefined();
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-11-10")).rejects.toThrow(/Invoice_due_chk/);
  });

  it("refuse une facture acquittée dont l'échéance n'est pas le jour du paiement", async () => {
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-12-18", "2026-11-18")).rejects.toThrow(/Invoice_due_chk/);
  });

  it("compte les jours à l'heure de Paris, comme l'année du numéro : émise le 31 décembre à 23 h 30 UTC, c'est le 1er janvier", async () => {
    await expect(invoice(await fresh(), "mission", "2026-12-31T23:30:00Z", "2027-01-01", "2027-01-01")).resolves.toBeUndefined();
    await expect(invoice(await fresh(), "mission", "2026-12-31T23:30:00Z", "2027-01-02", "2027-01-02")).rejects.toThrow(/Invoice_due_chk/);
  });

  it("refuse une facture acquittée après son émission", async () => {
    await expect(invoice(await fresh(), "mission", "2026-11-20T10:00:00Z", "2026-11-25", "2026-11-25")).rejects.toThrow(/Invoice_due_chk/);
  });
});

describe("retour arrière documenté (prisma/rollback)", () => {
  let back: PGlite;

  beforeAll(async () => {
    back = new PGlite();
    await back.exec(migrationsSql((name) => name <= THIS_MIGRATION));
    await back.exec(readFileSync(resolve(here, "../prisma/rollback", `${THIS_MIGRATION}.down.sql`), "utf8"));
  }, DB_STARTUP_MS);

  afterAll(async () => {
    await back.close();
  });

  it("retire les colonnes, le type, les déclencheurs et les contraintes ajoutés", async () => {
    const { rows } = await back.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE (table_name = 'Contract' AND column_name IN ('commissionBp','feePayer'))
          OR (table_name = 'Payment' AND column_name IN ('chargeId','paidAt'))
          OR (table_name = 'Invoice' AND column_name IN ('paidOn','settlesNumber'))`,
    );
    expect(rows[0]?.n).toBe(0);
    const types = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_type WHERE typname = 'FeePayer'`);
    expect(types.rows[0]?.n).toBe(0);
    const triggers = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'Contract_commission_frozen'`);
    expect(triggers.rows[0]?.n).toBe(0);
  });

  it("rétablit le déclencheur de paiement et la contrainte d'échéance d'origine", async () => {
    const fn = await back.query<{ src: string }>(`SELECT prosrc AS src FROM pg_proc WHERE proname = 'proofseen_payment_update'`);
    expect(fn.rows[0]?.src).not.toContain("chargeId");
    expect(fn.rows[0]?.src).toContain("un versement ne se réécrit pas");
    const check = await back.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'Invoice_due_chk'`);
    expect(check.rows[0]?.def).not.toContain("paidOn");
    expect(check.rows[0]?.def).toContain("dueOn");
  });
});
