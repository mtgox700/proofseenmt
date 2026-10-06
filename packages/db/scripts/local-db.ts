import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "../src/generated/client";
import { missionAlerts } from "../src/mission-alerts";
import { missions } from "../src/missions";
import { organisations } from "../src/organisations";
import { profiles } from "../src/profiles";
import { users } from "../src/users";

/*
 * Base Postgres locale et jetable, pour exécuter le site de bout en bout sans base distante.
 *
 * Postgres embarqué (PGlite), la migration de production jouée telle quelle, exposé sur le vrai protocole réseau de
 * Postgres : le site s'y connecte avec son pilote de production (`@prisma/adapter-pg`), sans rien savoir de PGlite.
 * Les données de départ sont créées par les dépôts eux-mêmes et sont **visiblement des données de test** : rien ici
 * ne doit pouvoir passer pour une vraie entreprise ou un vrai freelance.
 *
 *   npx tsx packages/db/scripts/local-db.ts            → postgresql://postgres@127.0.0.1:5433/postgres
 */

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(resolve(here, "../prisma/migrations/20261005000000_init/migration.sql"), "utf8");

const pg = new PGlite();
await pg.exec(MIGRATION);
const db = new PrismaClient({ adapter: new PrismaPGlite(pg) });

const { userId: recruiter } = await users(db).ensure({ clerkId: "local_test_recruiter", email: "recruteur.test@example.invalid", displayName: "Recruteur de test" });
const org = await organisations(db).create({ userId: recruiter }, { name: "Entreprise de test (données locales)", kind: "pme" });
const created = await missions(db).create({ userId: recruiter }, org.id, {
  title: "Mission de test — développeur TypeScript",
  description: "Mission fictive créée par la base locale de développement.\n\nElle n'existe pas : elle sert à vérifier le parcours.",
  skills: ["TypeScript", "PostgreSQL"],
  durationMonths: 3,
  dailyRateMinCents: 50_000,
  dailyRateMaxCents: 60_000,
  workMode: "remote",
});
if (created === null) throw new Error("mission de test non créée");

// L'alerte du freelance de test existe avant la publication : le premier passage du traitement périodique la signale.
const { userId: freelance } = await users(db).ensure({ clerkId: "local_test_freelance", email: "freelance.test@example.invalid", displayName: "Freelance de test" });
await missionAlerts(db).create({ userId: freelance }, { skills: ["TypeScript"] }, new Date(Date.now() - 60_000));
await missions(db).publish({ userId: recruiter }, created.id, new Date());
let drawn = 0;
await profiles(db).create(
  { userId: freelance },
  { headline: "Profil de test", summary: "Profil fictif de la base locale.", city: "Paris", workMode: "remote", skills: ["TypeScript"] },
  () => `FR-TEST${"ABCDEFGH"[drawn++ % 8]}`,
);
await profiles(db).setVisibility({ userId: freelance }, "pseudonymous");
await db.$disconnect();

const server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`base locale prête : postgresql://postgres@127.0.0.1:${PORT}/postgres`);
console.log(`mission de test ouverte : ${created.id}`);

const stop = async (): Promise<void> => {
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
