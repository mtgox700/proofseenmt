import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import type { Db } from "../../src/client";
import { PrismaClient } from "../../src/generated/client";
import { payments, type PaymentGateway } from "../../src/payments";

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

/**
 * Prestataire de paiement simulé : identifiants stables par clé d'idempotence (comme Stripe), virements retrouvables
 * par contrat, compteur d'appels. `failNextTransfer` simule une panne au moment du virement.
 */
export const fakeGateway = () => {
  const calls = { intents: 0, transfers: 0, refunds: 0, accounts: 0 };
  const byKey = new Map<string, string>();
  const transfersByContract = new Map<string, string>();
  const amounts: number[] = [];
  const state = { failNextTransfer: false };
  const stable = (prefix: string, key: string): string => {
    const known = byKey.get(key);
    if (known !== undefined) return known;
    const id = `${prefix}_${byKey.size + 1}${Math.random().toString(36).slice(2, 8)}`;
    byKey.set(key, id);
    return id;
  };
  const gateway: PaymentGateway = {
    async createIntent({ idempotencyKey }) {
      calls.intents += 1;
      const intentId = stable("pi", idempotencyKey);
      return { intentId, clientSecret: `${intentId}_secret` };
    },
    async intentSecret(intentId) {
      return `${intentId}_secret`;
    },
    async transfer({ idempotencyKey, contractId, amountCents }) {
      if (state.failNextTransfer) {
        state.failNextTransfer = false;
        throw new TypeError("fetch failed");
      }
      calls.transfers += 1;
      amounts.push(amountCents);
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
  };
  return { gateway, calls, amounts, state };
};

/** Ouvre le paiement d'un contrat actif et le fait confirmer par le prestataire : les fonds sont bloqués. */
export const payAndHold = async (db: Db, adminUserId: string, contractId: string, gateway: PaymentGateway = fakeGateway().gateway): Promise<string> => {
  const opened = await payments(db).open({ userId: adminUserId }, contractId, gateway, 1000);
  if (opened.kind !== "opened" && opened.kind !== "resumed") throw new Error(`paiement non ouvert : ${opened.kind}`);
  const { stripeIntentId } = await db.payment.findUniqueOrThrow({ where: { id: opened.paymentId }, select: { stripeIntentId: true } });
  await payments(db).applyEvent({ id: `evt_hold_${opened.paymentId}`, type: "payment.succeeded", intentId: stripeIntentId }, new Date());
  return stripeIntentId;
};
