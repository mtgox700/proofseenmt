import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { allMigrationsSql } from "../../prisma/migrations";
import type { Db } from "../../src/client";
import { PrismaClient } from "../../src/generated/client";
import { payments, type ChargeFacts, type PaymentGateway } from "../../src/payments";
import { SourceChargeMissingError } from "../../src/payment-errors";

/*
 * Le taux de commission est fourni par l'appelant à la création d'un contrat (`commissionTerms`) puis figé ; ce paquet ne
 * lit pas l'environnement. Les tests qui ne s'en occupent pas créent leurs contrats sans conditions : la base de test
 * (et elle seule, aucune migration ne pose ce défaut) leur donne le taux d'essai de 10 %, comme si la configuration en
 * avait un. Le vrai taux est une décision du founder.
 */
export const TEST_COMMISSION_BP = 1000;
export const TEST_TERMS = { commissionBp: TEST_COMMISSION_BP, repeatCommissionBp: 500 } as const;

/*
 * Une vraie base Postgres par fichier de test, en mémoire (PGlite), avec la migration de production appliquée telle
 * quelle. Les dépôts sont donc testés contre les mêmes contraintes et les mêmes déclencheurs qu'en production, et non
 * contre un faux qui accepterait tout.
 */
const MIGRATION = allMigrationsSql();

/** Démarrer Postgres en WebAssembly et jouer la migration prend quelques secondes, et bien plus sous la charge de toute la suite. */
export const DB_STARTUP_MS = 180_000;

export interface TestDatabase {
  readonly pg: PGlite;
  readonly db: Db;
  close(): Promise<void>;
}

/*
 * La migration est jouée une seule fois, puis la base obtenue est gardée en image dans le dossier temporaire, sous
 * l'empreinte de la migration : chaque fichier de test charge cette image au lieu de rejouer 1 200 lignes de SQL. Sous
 * la charge de toute la suite, rejouer la migration dans huit processus à la fois dépassait le délai de démarrage.
 * Une migration modifiée change l'empreinte, donc l'image : jamais de base périmée.
 */
const TEMPLATE = join(tmpdir(), `proofseen-pglite-${createHash("sha256").update(MIGRATION).digest("hex").slice(0, 16)}.tar.gz`);

const template = async (): Promise<Blob> => {
  if (existsSync(TEMPLATE)) return new Blob([readFileSync(TEMPLATE)]);
  const pg = new PGlite();
  await pg.exec(MIGRATION);
  const dump = await pg.dumpDataDir("gzip");
  await pg.close();
  // Écrire à côté puis renommer : deux processus qui construisent l'image en même temps ne laissent jamais un fichier
  // à moitié écrit, le dernier renommage gagne et les deux images sont identiques.
  const partial = `${TEMPLATE}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(partial, Buffer.from(await dump.arrayBuffer()));
  renameSync(partial, TEMPLATE);
  return dump;
};

export const openTestDatabase = async (): Promise<TestDatabase> => {
  const pg = new PGlite({ loadDataDir: await template() });
  await pg.waitReady;
  // Comme le serveur de production (UTC) : PGlite prend sinon le fuseau du poste (Etc/GMT-1 à Paris l'hiver), et l'adaptateur
  // décale alors les instants envoyés, ce qui fausse tout test près de minuit.
  await pg.exec("SET TIME ZONE 'UTC'");
  await pg.exec(`ALTER TABLE "Contract" ALTER COLUMN "commissionBp" SET DEFAULT ${TEST_COMMISSION_BP}`);
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

let siretSequence = 0;

/**
 * Un SIRET neuf pour un SIREN donné : un SIRET n'appartient qu'à une seule partie de la plateforme, et des tests qui
 * créent plusieurs freelances ou entreprises ont besoin d'établissements distincts. Le SIREN reste celui demandé.
 */
export const nextSiret = (siren: string): string => {
  siretSequence += 1;
  return `${siren}${String(siretSequence).padStart(5, "0")}`;
};

/**
 * Une attestation de vigilance URSSAF vérifiée, délivrée aujourd'hui : sans elle, aucun contrat d'au moins 5 000 € HT
 * ne peut naître ni être signé.
 */
export const verifiedVigilance = async (db: Db, profileId: string): Promise<void> => {
  const data = { issuedOn: new Date(new Date().toISOString().slice(0, 10)), securityCode: "TESTCODE1", verifiedAt: new Date() };
  await db.vigilanceAttestation.upsert({ where: { profileId }, create: { profileId, ...data }, update: data });
};

/** Une entreprise dont `ownerId` est membre. */
export const createOrganisation = async (db: Db, ownerId: string): Promise<string> => {
  const { id } = await db.organisation.create({
    data: { name: "Acme", kind: "pme", members: { create: { userId: ownerId, role: "owner" } } },
    select: { id: true },
  });
  return id;
};

/**
 * Prestataire de paiement simulé : identifiants stables par clé d'idempotence (comme Stripe), virements retrouvables
 * par contrat, compteur d'appels. `failNextTransfer` simule une panne au moment du virement ; `payoutReady` est l'état
 * du compte de versement chez le prestataire (prêt par défaut).
 */
export const fakeGateway = () => {
  const calls = { intents: 0, transfers: 0, refunds: 0, accounts: 0, readiness: 0, reads: 0 };
  /** Ce que Stripe sait d'une intention encaissée (`collect`), par intention ; les charges, par identifiant. */
  const collected = new Map<string, ChargeFacts>();
  const charges = new Map<string, ChargeFacts>();
  const byKey = new Map<string, string>();
  const transfersByContract = new Map<string, string>();
  const amounts: number[] = [];
  /** La charge source de chaque virement, dans l'ordre : le prestataire réel refuse un virement sans elle. */
  const sources: string[] = [];
  const state = { failNextTransfer: false, payoutReady: true, failReads: false };
  const stable = (prefix: string, key: string): string => {
    const known = byKey.get(key);
    if (known !== undefined) return known;
    const id = `${prefix}_${byKey.size + 1}${Math.random().toString(36).slice(2, 8)}`;
    byKey.set(key, id);
    return id;
  };
  const gateway: PaymentGateway = {
    async createIntent({ idempotencyKey, amountCents, currency }) {
      calls.intents += 1;
      const intentId = stable("pi", idempotencyKey);
      INTENTS.set(intentId, { amountCents, currency: currency.toUpperCase() });
      return { intentId, clientSecret: `${intentId}_secret` };
    },
    async intentSecret(intentId) {
      return `${intentId}_secret`;
    },
    async transfer({ idempotencyKey, contractId, amountCents, sourceTransaction }) {
      if (state.failNextTransfer) {
        state.failNextTransfer = false;
        throw new TypeError("fetch failed");
      }
      if (!/^(ch|py)_[A-Za-z0-9]+$/.test(sourceTransaction ?? "")) throw new SourceChargeMissingError();
      calls.transfers += 1;
      amounts.push(amountCents);
      sources.push(sourceTransaction);
      const transferId = stable("tr", idempotencyKey);
      transfersByContract.set(contractId, transferId);
      return { transferId };
    },
    async findTransfer(contractId) {
      return transfersByContract.get(contractId) ?? null;
    },
    async refund({ idempotencyKey }) {
      calls.refunds += 1;
      return { refundId: stable("re", idempotencyKey) };
    },
    async createAccount({ idempotencyKey }) {
      calls.accounts += 1;
      return { accountId: `acct_${stable("x", idempotencyKey).replace(/[^A-Za-z0-9]/g, "")}` };
    },
    async onboardingLink({ accountId }) {
      return { url: `https://connect.example.invalid/${accountId}` };
    },
    async payoutAccountReady() {
      calls.readiness += 1;
      return state.payoutReady;
    },
    async readIntent(intentId) {
      calls.reads += 1;
      if (state.failReads) throw new TypeError("fetch failed");
      const charge = collected.get(intentId) ?? null;
      return { intentId, status: charge === null ? "requires_payment_method" : "succeeded", charge };
    },
    async readCharge(chargeId) {
      calls.reads += 1;
      if (state.failReads) throw new TypeError("fetch failed");
      const known = charges.get(chargeId);
      if (known !== undefined) return known;
      // Une charge par convention (`chargeOf`) d'une intention créée dans ce fichier de test : payée, jamais remboursée.
      for (const [intentId, intent] of INTENTS) {
        if (chargeOf(intentId) === chargeId) return { chargeId, intentId, currency: intent.currency, amountCents: intent.amountCents, refundedCents: 0, paid: true, createdAt: null };
      }
      throw new Error("charge inconnue");
    },
  };
  /**
   * Stripe encaisse l'intention : sa charge existe désormais (lue par `readIntent`), avec les faits que le test veut
   * contredire s'il le veut (`override`).
   */
  const collect = (intentId: string, override: Partial<ChargeFacts> = {}): ChargeFacts => {
    const intent = INTENTS.get(intentId);
    if (intent === undefined) throw new Error("intention inconnue");
    const facts: ChargeFacts = { chargeId: chargeOf(intentId), intentId, currency: intent.currency, amountCents: intent.amountCents, refundedCents: 0, paid: true, createdAt: PAID_AT, ...override };
    collected.set(intentId, facts);
    charges.set(facts.chargeId, facts);
    return facts;
  };
  return { gateway, calls, amounts, sources, state, collect };
};

/** Les intentions créées par les passerelles simulées de ce fichier de test : montant et devise, pour recouper les charges. */
const INTENTS = new Map<string, { amountCents: number; currency: string }>();

/** Le jour où `payAndHold` fait encaisser le paiement : avant les dates d'émission des factures des tests. */
export const PAID_AT = new Date("2026-11-18T09:30:00Z");

/** La charge que Stripe associe à une intention : une par intention, lisible, jamais partagée. */
export const chargeOf = (intentId: string): string => `ch_${intentId.replace(/^pi_/, "")}`;

/** Ouvre le paiement d'un contrat actif et le fait confirmer par le prestataire : les fonds sont bloqués. */
export const payAndHold = async (db: Db, adminUserId: string, contractId: string, gateway: PaymentGateway = fakeGateway().gateway): Promise<string> => {
  const opened = await payments(db).open({ userId: adminUserId }, contractId, gateway);
  if (opened.kind !== "opened" && opened.kind !== "resumed") throw new Error(`paiement non ouvert : ${opened.kind}`);
  const { stripeIntentId } = await db.payment.findUniqueOrThrow({ where: { id: opened.paymentId }, select: { stripeIntentId: true } });
  await payments(db).applyEvent({ id: `evt_hold_${opened.paymentId}`, type: "payment.succeeded", intentId: stripeIntentId, chargeId: chargeOf(stripeIntentId) }, PAID_AT);
  return stripeIntentId;
};
