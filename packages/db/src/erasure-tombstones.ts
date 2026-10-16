import { createHmac } from "node:crypto";
import type { Prisma } from "./generated/client";

/*
 * Trace d'un compte suspendu puis effacé (revue de sécurité vague 3, L11). Sans elle, une personne suspendue effacerait
 * son compte et se réinscrirait aussitôt avec la même adresse, sans plus aucune suspension.
 *
 * Ce qui est gardé : l'empreinte de l'adresse normalisée (HMAC-SHA256 sous une clé dérivée du secret du serveur, que la
 * base ne connaît pas : la table seule ne permet pas de retrouver une adresse, même en essayant une liste d'adresses
 * connues), le motif et la date de la suspension. Rien d'autre : ni nom, ni identifiant, ni contenu. Base légale :
 * l'intérêt légitime de la plateforme à faire respecter une suspension ; durée : TOMBSTONE_RETENTION_YEARS ans.
 *
 * La trace sert une fois : à la réinscription, la suspension est reposée sur le nouveau compte et la trace part. Si un
 * opérateur lève ensuite la suspension, rien ne la repose derrière lui.
 */

export const TOMBSTONE_RETENTION_YEARS = 3;
/** Une réinscription est un compte tout neuf : au-delà, `users.ensure` ne cherche plus de trace. */
export const FRESH_ACCOUNT_MS = 24 * 60 * 60 * 1000;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * L'adresse telle qu'un fournisseur la livre : en minuscules, sans alias « +… », et pour Gmail sans les points de la
 * partie locale (ils n'y changent rien). Une variante de la même boîte donne la même empreinte.
 */
export const normalisedEmail = (raw: string): string => {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const domain = email.slice(at + 1);
  const local = email.slice(0, at).split("+")[0] ?? "";
  if (GMAIL_DOMAINS.has(domain)) return `${local.replace(/\./g, "")}@gmail.com`;
  return `${local}@${domain}`;
};

/** L'empreinte d'une adresse sous la clé du serveur : 43 caractères base64url, jamais l'adresse. */
export const tombstoneHash = (email: string, key: string): string =>
  createHmac("sha256", `proofseen:erasure-tombstone:v1:${key}`).update(normalisedEmail(email)).digest("base64url");

/** Début de la période de conservation à la date `now`. */
export const tombstoneCutoff = (now: Date): Date => {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - TOMBSTONE_RETENTION_YEARS);
  return cutoff;
};

/** Écrit la trace d'un compte suspendu, dans la transaction de son effacement. */
export const leaveTombstone = async (
  tx: Prisma.TransactionClient,
  email: string,
  key: string,
  suspension: { readonly at: Date; readonly reason: string },
): Promise<void> => {
  const emailHash = tombstoneHash(email, key);
  const data = { suspendedAt: suspension.at, suspensionReason: suspension.reason, createdAt: new Date() };
  await tx.erasureTombstone.upsert({ where: { emailHash }, create: { emailHash, ...data }, update: data });
};
