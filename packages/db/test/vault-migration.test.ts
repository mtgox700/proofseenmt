import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_STARTUP_MS } from "./support/database";

/*
 * Migration 20261024150000_vault, jouée sur des données d'avant elle : les contrats existants n'ont ni objet ni livrables
 * (rien n'est deviné), puis le retour arrière documenté est exécuté sur la base migrée.
 */

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, "../prisma/migrations");
const THIS_MIGRATION = "20261024150000_vault";

const migrationsSql = (keep: (name: string) => boolean): string =>
  readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && keep(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"))
    .join("\n");

const SNAPSHOT = JSON.stringify({ legalName: "Test", country: "FR" });

describe("données d'avant le coffre", () => {
  let pg: PGlite;
  let legacy = "";

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(migrationsSql((name) => name < THIS_MIGRATION));
    const user = (await pg.query<{ id: string }>(`INSERT INTO "User" ("id","clerkId","email","displayName") VALUES (gen_random_uuid(), 'v', 'v@test.fr', 'x') RETURNING "id"`)).rows[0]?.id ?? "";
    const profile = (
      await pg.query<{ id: string }>(
        `INSERT INTO "FreelanceProfile" ("id","userId","reference","visibility","slug","headline","summary","city","workMode")
         VALUES (gen_random_uuid(), $1, 'FR-VAULT', 'pseudonymous', 'vault', 'Dev', 'Résumé', 'Paris', 'remote') RETURNING "id"`,
        [user],
      )
    ).rows[0]?.id ?? "";
    const org = (await pg.query<{ id: string }>(`INSERT INTO "Organisation" ("id","name","kind") VALUES (gen_random_uuid(), 'Acme', 'pme') RETURNING "id"`)).rows[0]?.id ?? "";
    await pg.query(`INSERT INTO "Membership" ("organisationId","userId","role") VALUES ($1, $2, 'owner')`, [org, user]);
    legacy =
      (
        await pg.query<{ id: string }>(
          `INSERT INTO "Contract" ("id","organisationId","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn","acceptedByFreelanceAt","acceptedByOrgAt","status")
           VALUES (gen_random_uuid(), $1, $2, 60000, 1, 60000, 'EUR', $3, $3, '2026-10-21', now(), now(), 'active') RETURNING "id"`,
          [org, profile, SNAPSHOT],
        )
      ).rows[0]?.id ?? "";
    await pg.exec(readFileSync(join(MIGRATIONS, THIS_MIGRATION, "migration.sql"), "utf8"));
  }, DB_STARTUP_MS);

  afterAll(async () => {
    await pg.close();
  });

  it("un contrat accepté en deux clics reste sans objet ni livrables : rien n'est inventé", async () => {
    const { rows } = await pg.query<{ scope: string | null; deliverables: string[] }>(`SELECT "scope","deliverables" FROM "Contract" WHERE "id" = $1`, [legacy]);
    expect(rows[0]).toEqual({ scope: null, deliverables: [] });
  });

  it("la contrainte d'objet refuse un objet vide ou trop long, et plus de 30 livrables, à l'insertion", async () => {
    const copy = async (scope: string | null, deliverables: string[]) =>
      pg.query(
        `INSERT INTO "Contract" ("id","organisationId","profileId","dailyRateCents","days","totalCents","currency","sellerSnapshot","buyerSnapshot","startsOn","scope","deliverables")
         SELECT gen_random_uuid(), "organisationId", "profileId", 60000, 1, 60000, 'EUR', $2::jsonb, $2::jsonb, '2026-10-21', $3, $4 FROM "Contract" WHERE "id" = $1`,
        [legacy, SNAPSHOT, scope, deliverables],
      );
    await expect(copy("", [])).rejects.toThrow(/Contract_scope_chk/);
    await expect(copy("x".repeat(6001), [])).rejects.toThrow(/Contract_scope_chk/);
    await expect(copy("Objet", Array.from({ length: 31 }, (_, i) => `l${i}`))).rejects.toThrow(/Contract_scope_chk/);
    await expect(copy("Objet", ["a", "b"])).resolves.toBeDefined();
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

  it("retire les tables, les types, les colonnes et les déclencheurs du coffre", async () => {
    const tables = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('Document','DocumentVersion','DocumentAccess')`);
    expect(tables.rows[0]?.n).toBe(0);
    const columns = await back.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE (table_name = 'Quote' AND column_name IN ('scope','deliverables','validUntil','acceptedAt')) OR (table_name = 'Contract' AND column_name IN ('scope','deliverables'))`,
    );
    expect(columns.rows[0]?.n).toBe(0);
    const types = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_type WHERE typname IN ('DocumentType','DocumentAction')`);
    expect(types.rows[0]?.n).toBe(0);
    const triggers = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname IN ('Quote_terms_frozen','Quote_accepted_at','Contract_scope_frozen','Document_guard','Document_keep','DocumentVersion_guard','DocumentAccess_guard')`);
    expect(triggers.rows[0]?.n).toBe(0);
  });

  it("laisse la migration précédente intacte (l'argent : charge, taux, factures acquittées)", async () => {
    const columns = await back.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.columns WHERE (table_name = 'Payment' AND column_name = 'chargeId') OR (table_name = 'Contract' AND column_name = 'commissionBp') OR (table_name = 'Invoice' AND column_name = 'paidOn')`);
    expect(columns.rows[0]?.n).toBe(3);
  });
});
