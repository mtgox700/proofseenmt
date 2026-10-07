import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Toutes les migrations de production, dans l'ordre où Prisma les applique (nom du dossier, préfixé par sa date). Les
 * tests et la base locale jouent exactement cette suite : jamais un schéma que la production n'aurait pas.
 */
const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export const allMigrationsSql = (): string =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
    .join("\n");
