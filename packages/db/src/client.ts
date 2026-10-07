import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/*
 * Accès à la base. Une seule façon de l'ouvrir, pour qu'aucun module ne se retrouve avec sa propre connexion, ses
 * propres réglages et sa propre façon d'échouer.
 *
 * L'URL absente est une erreur explicite et immédiate. La laisser vide ferait échouer plus loin, à la première requête,
 * avec un message qui parle de réseau au lieu de configuration.
 */

export type Db = PrismaClient;

export const createDb = (connectionString: string): Db => {
  if (connectionString.trim() === "") throw new Error("DATABASE_URL vide : la base ne peut pas être ouverte");
  // Railway expose deux URL. L'interne n'existe qu'à l'intérieur de Railway : la refuser ici évite une heure à
  // chercher pourquoi le réseau « ne répond pas » depuis un poste ou depuis Vercel.
  if (/\.railway\.internal\b/.test(connectionString) && process.env.RAILWAY_ENVIRONMENT === undefined) {
    throw new Error("DATABASE_URL pointe vers l'adresse interne de Railway, injoignable d'ici : utiliser DATABASE_PUBLIC_URL");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: poolSize() }), transactionOptions: TRANSACTION_OPTIONS });
};

/*
 * Délais des transactions. Ceux de Prisma par défaut (2 s pour obtenir une connexion, 5 s pour la transaction) ont été
 * dépassés en conditions réelles : une connexion neuve vers Railway coûte plusieurs secondes, et une transaction de
 * quatre requêtes depuis un poste a pris 7 s. Une transaction expirée est annulée en entier, donc sans dégât, mais
 * l'action échoue pour rien. Les verrous pris restent courts : aucune transaction n'attend un service extérieur.
 */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

const DEFAULT_POOL_SIZE = 5;

/*
 * Connexions par processus. Petit par défaut : chaque instance du site ouvre son propre pool, et une base Railway
 * accepte une centaine de connexions au total. Réglable par `DATABASE_POOL_MAX` pour un processus long (CLI, worker).
 */
const poolSize = (): number => {
  const raw = Number(process.env.DATABASE_POOL_MAX ?? DEFAULT_POOL_SIZE);
  return Number.isInteger(raw) && raw >= 1 && raw <= 50 ? raw : DEFAULT_POOL_SIZE;
};

let shared: Db | undefined;

/** La connexion partagée du processus, ouverte au premier usage depuis `DATABASE_URL`. */
export const getDb = (): Db => {
  if (shared !== undefined) return shared;
  const url = process.env.DATABASE_URL;
  if (url === undefined) throw new Error("DATABASE_URL absente de l'environnement : la base ne peut pas être ouverte");
  shared = createDb(url);
  return shared;
};
