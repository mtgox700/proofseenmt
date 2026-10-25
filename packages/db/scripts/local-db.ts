import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { allMigrationsSql } from "../prisma/migrations";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { PrismaClient } from "../src/generated/client";
import { messaging } from "../src/messaging";
import { missionAlerts } from "../src/mission-alerts";
import { missions } from "../src/missions";
import { organisations } from "../src/organisations";
import { payments, type PaymentGateway } from "../src/payments";
import { profiles } from "../src/profiles";
import { quotes } from "../src/quotes";
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
const MIGRATION = allMigrationsSql();

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

// Un contrat signé avec un paiement en attente, pour exécuter le webhook de paiement sans prestataire réel. Le
// prestataire est simulé ici, et seulement ici : l'intention porte un identifiant fixe et visiblement de test.
const TEST_ADDRESS = { line1: "Adresse de test", postalCode: "75000", city: "Paris", country: "FR" };
await billing(db).setFreelanceIdentity({ userId: freelance }, { acceptInvoicingMandate: true, legalName: "Freelance de test EI", siret: "00000000000000", address: TEST_ADDRESS });
await billing(db).setOrganisationIdentity({ userId: recruiter }, org.id, { legalName: "Entreprise de test (données locales)", address: TEST_ADDRESS });
const testProfile = await profiles(db).findMine({ userId: freelance });
const contact = await messaging(db).contact({ userId: recruiter }, org.id, testProfile?.id ?? "", "Bonjour, mission de test.");
if (contact.kind !== "opened") throw new Error(`fil de test non ouvert : ${contact.kind}`);
await messaging(db).decide({ userId: freelance }, contact.conversation.id, "accepted", new Date());
const quote = await quotes(db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 50_000, days: 3 });
await quotes(db).send({ userId: freelance }, quote?.id ?? "");
await quotes(db).decide({ userId: recruiter }, quote?.id ?? "", "accepted");
// Taux d'essai local (10 %, fidélité 5 %) : le vrai taux est une décision du founder et vient de la configuration de l'application.
const contract = await contracts(db, { commissionTerms: () => ({ commissionBp: 1000, repeatCommissionBp: 500 }) }).createFromQuote({ userId: recruiter }, quote?.id ?? "", { startsOn: "2026-11-02" });
if (contract.kind !== "created") throw new Error(`contrat de test non créé : ${contract.kind}`);
await contracts(db).sign({ userId: recruiter }, contract.contract.id, new Date());
await contracts(db).sign({ userId: freelance }, contract.contract.id, new Date());
const simulated: PaymentGateway = {
  createIntent: async () => ({ intentId: "pi_local_test", clientSecret: "pi_local_test_secret" }),
  transfer: async () => ({ transferId: "tr_local_test" }),
  refund: async () => ({ refundId: "re_local_test" }),
  intentSecret: async () => "pi_local_test_secret",
  findTransfer: async () => null,
  createAccount: async () => ({ accountId: "acct_localtest" }),
  onboardingLink: async () => ({ url: "https://connect.example.invalid/acct_localtest" }),
  payoutAccountReady: async () => false,
  readIntent: async (intentId) => ({ intentId, status: "requires_payment_method", charge: null }),
  readCharge: async () => {
    throw new Error("charge inconnue : aucun prestataire réel en local");
  },
};
await payments(db).open({ userId: recruiter }, contract.contract.id, simulated);
await db.$disconnect();

const server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`base locale prête : postgresql://postgres@127.0.0.1:${PORT}/postgres`);
console.log(`mission de test ouverte : ${created.id}`);
console.log(`paiement de test en attente : intention pi_local_test, contrat ${contract.contract.id}`);

const stop = async (): Promise<void> => {
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
