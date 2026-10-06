import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

/*
 * Le `.env` vit à la racine du dépôt, pas dans ce paquet : on le charge par un chemin explicite, sinon les commandes
 * lancées depuis `packages/db` ne le trouveraient pas et partiraient sans URL.
 *
 * L'URL n'est fournie que si elle existe. Générer le client et valider le schéma n'en ont pas besoin ; migrer, si. Une
 * URL de remplacement aurait permis de « réussir » une migration contre une base qui n'est pas la bonne.
 */
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env"), quiet: true });

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url === undefined || url === "" ? {} : { datasource: { url } }),
});
