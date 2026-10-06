import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import type { Db } from "../../src/client";
import { PrismaClient } from "../../src/generated/client";

/*
 * Une vraie base Postgres par fichier de test, en mémoire (PGlite), avec la migration de production appliquée telle
 * quelle. Les dépôts sont donc testés contre les mêmes contraintes et les mêmes déclencheurs qu'en production, et non
 * contre un faux qui accepterait tout.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(resolve(here, "../../prisma/migrations/20261005000000_init/migration.sql"), "utf8");

/** Démarrer Postgres en WebAssembly et jouer la migration prend quelques secondes, et bien plus sous la charge de toute la suite. */
export const DB_STARTUP_MS = 180_000;

export interface TestDatabase {
  readonly pg: PGlite;
  readonly db: Db;
  close(): Promise<void>;
}

export const openTestDatabase = async (): Promise<TestDatabase> => {
  const pg = new PGlite();
  await pg.exec(MIGRATION);
  const db: Db = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return {
    pg,
    db,
    async close() {
      await db.$disconnect();
      await pg.close();
    },
  };
};

let sequence = 0;

/** Un utilisateur neuf, d'adresse unique. */
export const createUser = async (db: Db): Promise<string> => {
  sequence += 1;
  const email = `user${sequence}@test.fr`;
  const { id } = await db.user.create({ data: { clerkId: `clerk_${sequence}`, email, displayName: `User ${sequence}` }, select: { id: true } });
  return id;
};

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Un profil freelance publié (pseudonyme) ou privé. */
export const createProfile = async (db: Db, userId: string, visibility: "pseudonymous" | "private" = "pseudonymous"): Promise<string> => {
  sequence += 1;
  // La séquence écrite en base 31 : une référence unique par profil, quel que soit le nombre de profils du fichier.
  const reference = `FR-${Array.from({ length: 5 }, (_, i) => REF_ALPHABET[Math.floor(sequence / REF_ALPHABET.length ** i) % REF_ALPHABET.length]).join("")}`;
  const published = visibility === "private" ? {} : { slug: `profil-${sequence}`, headline: "Dev", summary: "Résumé", city: "Paris" };
  const { id } = await db.freelanceProfile.create({
    data: { userId, reference, visibility, workMode: "remote", ...published },
    select: { id: true },
  });
  return id;
};

/** Une entreprise dont `ownerId` est membre. */
export const createOrganisation = async (db: Db, ownerId: string): Promise<string> => {
  const { id } = await db.organisation.create({
    data: { name: "Acme", kind: "pme", members: { create: { userId: ownerId, role: "owner" } } },
    select: { id: true },
  });
  return id;
};
