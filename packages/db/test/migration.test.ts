import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * La migration est exécutée telle quelle dans un vrai Postgres (PGlite, Postgres compilé en WebAssembly), puis chaque
 * règle est attaquée. Un CHECK ou un déclencheur qui n'est jamais exécuté n'est qu'un commentaire.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(resolve(here, "../prisma/migrations/20261005000000_init/migration.sql"), "utf8");

let db: PGlite;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<T>(sql, params);
  const [row] = rows;
  if (row === undefined) throw new Error(`aucune ligne : ${sql}`);
  return row;
}

async function id(sql: string, params: unknown[] = []): Promise<string> {
  return (await one<{ id: string }>(`${sql} RETURNING "id"`, params)).id;
}

async function rejects(sql: string, params: unknown[], reason: RegExp): Promise<void> {
  await expect(db.query(sql, params)).rejects.toThrow(reason);
}

const SNAPSHOT = JSON.stringify({ legalName: "Test", country: "FR" });

async function user(email: string): Promise<string> {
  return id(`INSERT INTO "User" ("id","clerkId","email","displayName") VALUES (gen_random_uuid(), $1, $1, 'x')`, [email]);
}

async function profile(userId: string, reference: string): Promise<string> {
  return id(
    `INSERT INTO "FreelanceProfile" ("id","userId","reference","visibility","slug","headline","summary","city","workMode")
     VALUES (gen_random_uuid(), $1, $2, 'pseudonymous', lower($2), 'Dev', 'Résumé', 'Paris', 'remote')`,
    [userId, reference],
  );
}

async function organisation(memberId: string): Promise<string> {
  const org = await id(`INSERT INTO "Organisation" ("id","name","kind") VALUES (gen_random_uuid(), 'Acme', 'pme')`);
  await db.query(`INSERT INTO "Membership" ("organisationId","userId","role") VALUES ($1, $2, 'owner')`, [org, memberId]);
  return org;
}

async function contract(org: string, prof: string, status = "pending_signatures"): Promise<string> {
  const signed = status === "pending_signatures" ? null : new Date().toISOString();
  return id(
    `INSERT INTO "Contract" ("id","organisationId","profileId","dailyRateCents","days","totalCents","currency",
       "sellerSnapshot","buyerSnapshot","startsOn","acceptedByFreelanceAt","acceptedByOrgAt","status")
     VALUES (gen_random_uuid(), $1, $2, 60000, 10, 600000, 'EUR', $3, $3, '2026-11-01', $4, $4, $5)`,
    [org, prof, SNAPSHOT, signed, status],
  );
}

/** Un paiement déjà versé pour ce contrat : sans lui, aucun avis n'est accepté. */
async function paid(contractId: string, intent: string): Promise<void> {
  await db.query(
    `INSERT INTO "Payment" ("id","contractId","amountCents","commissionCents","currency","stripeIntentId","status","transferId","releasedAt")
     VALUES (gen_random_uuid(), $1, 600000, 60000, 'EUR', $2, 'released', $3, now())`,
    [contractId, intent, `tr_${intent}`],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(MIGRATION);
}, 180_000);

afterAll(async () => {
  await db.close();
});

describe("migration init", () => {
  it("s'applique sur une base vide", async () => {
    const tables = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(tables.n).toBe(27);
  });

  it("refuse l'argent incohérent et les devises hors liste", async () => {
    const u = await user("money@x.fr");
    const p = await profile(u, "FR-MNY23");
    const org = await organisation(await user("money-org@x.fr"));
    const conv = await id(`INSERT INTO "Conversation" ("id","organisationId","profileId","direct") VALUES (gen_random_uuid(), $1, $2, true)`, [org, p]);
    await db.query(`UPDATE "Conversation" SET "status" = 'accepted', "decidedAt" = now() WHERE "id" = $1`, [conv]);
    const quote = `INSERT INTO "Quote" ("id","conversationId","dailyRateCents","days","totalCents","currency")
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`;
    await rejects(quote, [conv, 60000, 10, 599999, "EUR"], /Quote_amounts_chk/);
    await rejects(quote, [conv, 60000, 10, 600000, "XYZ"], /Quote_currency_chk/);
    await rejects(quote, [conv, 60000, 0, 0, "EUR"], /Quote_amounts_chk/);
    await db.query(quote, [conv, 60000, 10, 600000, "EUR"]);
  });

  it("n'accepte un profil public que complet, et des formes normalisées", async () => {
    const u = await user("draft@x.fr");
    await rejects(
      `INSERT INTO "FreelanceProfile" ("id","userId","reference","visibility","workMode") VALUES (gen_random_uuid(), $1, 'FR-DRF23', 'named', 'remote')`,
      [u],
      /FreelanceProfile_publishable_chk/,
    );
    await db.query(
      `INSERT INTO "FreelanceProfile" ("id","userId","reference","workMode") VALUES (gen_random_uuid(), $1, 'FR-DRF23', 'remote')`,
      [u],
    );
    await rejects(`INSERT INTO "User" ("id","clerkId","email","displayName") VALUES (gen_random_uuid(), 'c', 'A@x.fr', 'x')`, [], /User_email_lower_chk/);
    await rejects(
      `UPDATE "FreelanceProfile" SET "availability" = 'available_from' WHERE "userId" = $1`,
      [u],
      /FreelanceProfile_availability_chk/,
    );
  });

  it("ne prend un paiement que sur un contrat signé, dans sa devise", async () => {
    const org = await organisation(await user("pay-org@x.fr"));
    const p = await profile(await user("pay@x.fr"), "FR-PAY23");
    const pending = await contract(org, p);
    const payment = `INSERT INTO "Payment" ("id","contractId","amountCents","commissionCents","currency","stripeIntentId")
                     VALUES (gen_random_uuid(), $1, 600000, 60000, $2, $3)`;
    await rejects(payment, [pending, "EUR", "pi_1"], /n'est pas signé/);
    await rejects(`UPDATE "Contract" SET "status" = 'active' WHERE "id" = $1`, [pending], /Contract_signed_chk/);

    const active = await contract(org, p, "active");
    await rejects(payment, [active, "GBP", "pi_2"], /Payment_contractId_currency_fkey/);
    await db.query(payment, [active, "EUR", "pi_3"]);
    await rejects(
      `INSERT INTO "Contract" ("id","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn")
       VALUES (gen_random_uuid(), $1, 1, 1, 1, 'EUR', '{}', '{}', '2026-11-01')`,
      [p],
      /deux parties/,
    );
  });

  it("rend une facture émise immuable", async () => {
    const org = await organisation(await user("inv-org@x.fr"));
    const c = await contract(org, await profile(await user("inv@x.fr"), "FR-INV23"), "active");
    const invoice = await id(
      `INSERT INTO "Invoice" ("id","number","kind","issuer","label","dueOn","contractId","netCents","vatCents","vatRateBp","totalCents","currency","sellerSnapshot","buyerSnapshot")
       VALUES (gen_random_uuid(), '2026-000001', 'commission', 'proofseen', 'Commission', '2099-01-01', $1, 600000, 120000, 2000, 720000, 'EUR', $2, $2)`,
      [c, SNAPSHOT],
    );
    await rejects(`UPDATE "Invoice" SET "netCents" = 1 WHERE "id" = $1`, [invoice], /immuable/);
    await rejects(`DELETE FROM "Invoice" WHERE "id" = $1`, [invoice], /immuable/);
  });

  it("n'accepte qu'un avis par contrat terminé, écrit par un membre de l'entreprise sur le bon freelance", async () => {
    const author = await user("rev-org@x.fr");
    const outsider = await user("rev-out@x.fr");
    const org = await organisation(author);
    const p = await profile(await user("rev@x.fr"), "FR-REV23");
    const other = await profile(await user("rev-other@x.fr"), "FR-REV24");
    const review = `INSERT INTO "Review" ("id","contractId","authorUserId","targetProfileId","rating","body")
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Bien')`;

    const running = await contract(org, p, "active");
    await rejects(review, [running, author, p, 5], /pas terminée/);

    const done = await contract(org, p, "completed");
    await rejects(review, [done, author, p, 5], /pas été payée/);
    await paid(done, "pi_rev_paid");
    await rejects(review, [done, outsider, p, 5], /pas membre/);
    await rejects(review, [done, author, other, 5], /pas le freelance/);
    await rejects(review, [done, author, p, 6], /Review_chk/);
    await db.query(review, [done, author, p, 5]);
    await rejects(review, [done, author, p, 4], /Review_contractId_key/);
  });

  it("garde une conversation cohérente avec sa candidature, et date son dernier message", async () => {
    const orgUser = await user("conv-org@x.fr");
    const org = await organisation(orgUser);
    const p = await profile(await user("conv@x.fr"), "FR-CNV23");
    const intruder = await profile(await user("conv-x@x.fr"), "FR-CNV24");
    const job = await id(
      `INSERT INTO "JobPost" ("id","organisationId","title","description","currency","workMode","status","publishedAt")
       VALUES (gen_random_uuid(), $1, 'Mission', 'Détail', 'EUR', 'remote', 'open', now())`,
      [org],
    );
    const app = await id(`INSERT INTO "Application" ("id","jobPostId","profileId","coverNote") VALUES (gen_random_uuid(), $1, $2, 'Bonjour')`, [job, p]);
    await rejects(
      `INSERT INTO "Conversation" ("id","organisationId","profileId","applicationId","status","decidedAt") VALUES (gen_random_uuid(), $1, $2, $3, 'accepted', now())`,
      [org, intruder, app],
      /incohérente/,
    );
    const conv = await id(
      `INSERT INTO "Conversation" ("id","organisationId","profileId","applicationId","lastMessageAt","status","decidedAt") VALUES (gen_random_uuid(), $1, $2, $3, '2020-01-01', 'accepted', now())`,
      [org, p, app],
    );
    await db.query(`INSERT INTO "Message" ("id","conversationId","senderUserId","body") VALUES (gen_random_uuid(), $1, $2, 'Salut')`, [conv, orgUser]);
    const { lastMessageAt } = await one<{ lastMessageAt: Date }>(`SELECT "lastMessageAt" FROM "Conversation" WHERE "id" = $1`, [conv]);
    expect(lastMessageAt.getFullYear()).toBeGreaterThan(2020);
    await rejects(`INSERT INTO "Message" ("id","conversationId","senderUserId","body") VALUES (gen_random_uuid(), $1, $2, '')`, [conv, orgUser], /Message_body_chk/);
    await rejects(`UPDATE "Conversation" SET "profileId" = $2 WHERE "id" = $1`, [conv, intruder], /ne changent pas/);
    await rejects(
      `INSERT INTO "Conversation" ("id","organisationId","profileId") VALUES (gen_random_uuid(), $1, $2)`,
      [org, intruder],
      /directe ou rattachée/,
    );
  });

  it("supprime un compte sans perdre les contrats, paiements et factures que la loi impose de garder", async () => {
    const orgUser = await user("gdpr-org@x.fr");
    const org = await organisation(orgUser);
    const freelance = await user("gdpr@x.fr");
    const p = await profile(freelance, "FR-GDP23");
    const job = await id(
      `INSERT INTO "JobPost" ("id","organisationId","title","description","currency","workMode","status","publishedAt")
       VALUES (gen_random_uuid(), $1, 'Mission', 'Détail', 'EUR', 'remote', 'open', now())`,
      [org],
    );
    const app = await id(`INSERT INTO "Application" ("id","jobPostId","profileId","coverNote") VALUES (gen_random_uuid(), $1, $2, 'x')`, [job, p]);
    await db.query(`INSERT INTO "Conversation" ("id","organisationId","profileId","direct") VALUES (gen_random_uuid(), $1, $2, true)`, [org, p]);
    await db.query(`INSERT INTO "Conversation" ("id","organisationId","profileId","applicationId","status","decidedAt") VALUES (gen_random_uuid(), $1, $2, $3, 'accepted', now())`, [org, p, app]);
    const c = await contract(org, p, "completed");
    await db.query(
      `INSERT INTO "Payment" ("id","contractId","amountCents","commissionCents","currency","stripeIntentId","status","transferId","releasedAt")
       VALUES (gen_random_uuid(), $1, 600000, 60000, 'EUR', 'pi_gdpr', 'released', 'tr_gdpr', now())`,
      [c],
    );
    await db.query(
      `INSERT INTO "Invoice" ("id","number","kind","issuer","label","dueOn","contractId","netCents","vatCents","vatRateBp","totalCents","currency","sellerSnapshot","buyerSnapshot")
       VALUES (gen_random_uuid(), '2026-000002', 'commission', 'proofseen', 'Commission', '2099-01-01', $1, 600000, 120000, 2000, 720000, 'EUR', $2, $2)`,
      [c, SNAPSHOT],
    );
    await db.query(`INSERT INTO "Review" ("id","contractId","authorUserId","targetProfileId","rating","body") VALUES (gen_random_uuid(), $1, $2, $3, 5, 'Bien')`, [c, orgUser, p]);

    await db.query(`DELETE FROM "User" WHERE "id" = $1`, [freelance]);
    await db.query(`DELETE FROM "User" WHERE "id" = $1`, [orgUser]);

    const kept = await one<{ profileId: string | null; payments: number; invoices: number }>(
      `SELECT c."profileId",
              (SELECT count(*)::int FROM "Payment" WHERE "contractId" = c."id") AS payments,
              (SELECT count(*)::int FROM "Invoice" WHERE "contractId" = c."id") AS invoices
       FROM "Contract" c WHERE c."id" = $1`,
      [c],
    );
    expect(kept).toEqual({ profileId: null, payments: 1, invoices: 1 });
    const left = await one<{ n: number }>(
      `SELECT (SELECT count(*) FROM "FreelanceProfile" WHERE "id" = $1) + (SELECT count(*) FROM "Conversation" WHERE "profileId" = $1)
              + (SELECT count(*) FROM "Membership" WHERE "userId" = $2) AS n`,
      [p, orgUser],
    );
    expect(Number(left.n)).toBe(0);
  });

  it("ne laisse réécrire ni un avis, ni un paiement, ni un contrat signé, ni un message", async () => {
    const author = await user("rw-org@x.fr");
    const org = await organisation(author);
    const p = await profile(await user("rw@x.fr"), "FR-RWA23");
    const other = await profile(await user("rw-other@x.fr"), "FR-RWA24");
    const done = await contract(org, p, "completed");
    await paid(done, "pi_rw_paid");
    const pending = await contract(org, p);
    const review = await id(
      `INSERT INTO "Review" ("id","contractId","authorUserId","targetProfileId","rating","body") VALUES (gen_random_uuid(), $1, $2, $3, 5, 'Bien')`,
      [done, author, p],
    );
    await rejects(`UPDATE "Review" SET "targetProfileId" = $2, "rating" = 1 WHERE "id" = $1`, [review, other], /ne se modifie pas/);
    await rejects(`UPDATE "Review" SET "contractId" = $2 WHERE "id" = $1`, [review, pending], /ne se modifie pas|Review_contractId_key/);

    const payment = await id(
      `INSERT INTO "Payment" ("id","contractId","amountCents","commissionCents","currency","stripeIntentId") VALUES (gen_random_uuid(), $1, 600000, 60000, 'EUR', 'pi_rw')`,
      [done],
    );
    await rejects(`UPDATE "Payment" SET "contractId" = $2 WHERE "id" = $1`, [payment, pending], /ne change ni de contrat/);
    await db.query(`UPDATE "Payment" SET "status" = 'held' WHERE "id" = $1`, [payment]);
    await db.query(`UPDATE "Payment" SET "refundedCents" = 1000, "status" = 'refunded' WHERE "id" = $1`, [payment]);
    await rejects(`UPDATE "Payment" SET "status" = 'held' WHERE "id" = $1`, [payment], /statut refusé/);
    await rejects(`UPDATE "Payment" SET "refundedCents" = 0 WHERE "id" = $1`, [payment], /ne s'annule pas/);

    await rejects(`UPDATE "Contract" SET "status" = 'pending_signatures' WHERE "id" = $1`, [done], /passage de statut refusé/);
    await rejects(`UPDATE "Contract" SET "dailyRateCents" = 1, "totalCents" = 10 WHERE "id" = $1`, [done], /ne changent pas/);
    await rejects(`UPDATE "Contract" SET "sellerSnapshot" = '{}' WHERE "id" = $1`, [done], /ne changent pas/);
    await rejects(`UPDATE "Contract" SET "currency" = 'GBP' WHERE "id" = $1`, [done], /ne changent pas/);
    await rejects(`UPDATE "Contract" SET "profileId" = $2 WHERE "id" = $1`, [done, other], /parties/);

    const conv = await id(`INSERT INTO "Conversation" ("id","organisationId","profileId","direct") VALUES (gen_random_uuid(), $1, $2, true)`, [org, p]);
    const message = await id(`INSERT INTO "Message" ("id","conversationId","senderUserId","body") VALUES (gen_random_uuid(), $1, $2, 'Original')`, [conv, author]);
    await rejects(`UPDATE "Message" SET "body" = 'Falsifié' WHERE "id" = $1`, [message], /ne se modifie pas/);
    await rejects(`TRUNCATE "Invoice" CASCADE`, [], /immuable/);
  });

  it("ne crée un contrat depuis un devis que s'il est accepté et repris à l'identique", async () => {
    const org = await organisation(await user("q-org@x.fr"));
    const p = await profile(await user("q@x.fr"), "FR-QTE23");
    const conv = await id(`INSERT INTO "Conversation" ("id","organisationId","profileId","direct") VALUES (gen_random_uuid(), $1, $2, true)`, [org, p]);
    await db.query(`UPDATE "Conversation" SET "status" = 'accepted', "decidedAt" = now() WHERE "id" = $1`, [conv]);
    const quote = await id(
      `INSERT INTO "Quote" ("id","conversationId","dailyRateCents","days","totalCents","currency","status") VALUES (gen_random_uuid(), $1, 60000, 10, 600000, 'EUR', 'sent')`,
      [conv],
    );
    const fromQuote = `INSERT INTO "Contract" ("id","quoteId","organisationId","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn")
                       VALUES (gen_random_uuid(), $1, $2, $3, $4, 10, $4 * 10, 'EUR', '{}', '{}', '2026-11-01')`;
    await rejects(fromQuote, [quote, org, p, 60000], /incohérent avec son devis/);
    await db.query(`UPDATE "Quote" SET "status" = 'accepted' WHERE "id" = $1`, [quote]);
    await rejects(fromQuote, [quote, org, p, 50000], /incohérent avec son devis/);
    await db.query(fromQuote, [quote, org, p, 60000]);
  });

  it("laisse une entreprise supprimer une mission même si le freelance a déjà un fil direct avec elle", async () => {
    const org = await organisation(await user("del-org@x.fr"));
    const p = await profile(await user("del@x.fr"), "FR-DEL23");
    const job = await id(
      `INSERT INTO "JobPost" ("id","organisationId","title","description","currency","workMode","status","publishedAt") VALUES (gen_random_uuid(), $1, 'M', 'D', 'EUR', 'remote', 'open', now())`,
      [org],
    );
    const app = await id(`INSERT INTO "Application" ("id","jobPostId","profileId","coverNote") VALUES (gen_random_uuid(), $1, $2, 'x')`, [job, p]);
    await db.query(`INSERT INTO "Conversation" ("id","organisationId","profileId","direct") VALUES (gen_random_uuid(), $1, $2, true)`, [org, p]);
    await db.query(`INSERT INTO "Conversation" ("id","organisationId","profileId","applicationId","status","decidedAt") VALUES (gen_random_uuid(), $1, $2, $3, 'accepted', now())`, [org, p, app]);
    await db.query(`DELETE FROM "JobPost" WHERE "id" = $1`, [job]);
    const threads = await one<{ n: number }>(`SELECT count(*)::int AS n FROM "Conversation" WHERE "profileId" = $1`, [p]);
    expect(threads.n).toBe(2);
  });
});
