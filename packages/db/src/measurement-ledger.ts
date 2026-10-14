import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "./generated/client";
import type { ProofMethod } from "./generated/enums";

/*
 * Registre de dépense des mesures (`MeasurementSpend`) : une ligne par essai pris en charge, sans aucune relation vers
 * un compte ou un profil.
 *
 * Pourquoi un registre à part : les plafonds de la plateforme et la limite par profil se calculaient sur les demandes
 * elles-mêmes, qui partent par cascade avec le compte. Effacer son compte remettait donc à zéro la dépense comptée —
 * de quoi relancer des mesures payées par la plateforme sans limite, en recréant un compte. Le registre, lui, reste.
 *
 * Cycle d'une ligne : réserve au pire cas à la prise en charge ; règlement à la dépense réelle à la fin, à l'échec ou
 * au refus de l'essai ; règlement au pire cas quand le bail expire sans bilan (exécution morte, ou demande effacée en
 * cours de route). Tant qu'elle n'est pas réglée, une ligne compte pour sa réserve.
 *
 * Les empreintes d'adresses (`hostKeys`) relient un essai aux adresses prouvées du profil mesuré sans les garder en
 * clair : un compte neuf qui prouve le même domaine retrouve le même compteur. Ce sont des pseudonymes, pas des
 * données anonymes (une adresse connue se recalcule) : d'où la finalité unique (limiter la dépense) et 60 jours.
 */

/** Conservation du registre : deux fois la plus longue fenêtre qui le lit (30 jours). */
export const MEASUREMENT_SPEND_RETENTION_DAYS = 60;
const HOST_KEY_LABEL = "proofseen:measurement-host:v1:";
const MAX_HOST_KEYS = 20;

export interface ProvenAddress {
  readonly url: string;
  readonly urlKey: string;
  readonly proofMethod: ProofMethod;
}

/** La référence d'un essai : une fin ne vaut que pour l'essai qu'elle termine, jamais pour le suivant. */
export interface RunRef {
  readonly id: string;
  readonly attempts: number;
}

/**
 * Ce qu'une preuve établit : un fichier à la racine ou un TXT prouvent le domaine entier (sans `www.`) ; une balise ou
 * une preuve manuelle, une seule page. Une page prouvée sur une plateforme partagée ne doit pas lier tous ses usagers.
 */
const scopeOf = (address: ProvenAddress): string => {
  if (address.proofMethod !== "well_known_file" && address.proofMethod !== "dns_txt") return address.urlKey;
  try {
    return new URL(address.url).hostname.toLowerCase().replace(/[.]$/, "").replace(/^www[.]/, "");
  } catch {
    return address.urlKey;
  }
};

/** Empreintes SHA-256 des adresses prouvées, triées et dédoublonnées. */
export const measurementHostKeys = (addresses: readonly ProvenAddress[]): string[] =>
  [...new Set(addresses.map((address) => createHash("sha256").update(`${HOST_KEY_LABEL}${scopeOf(address)}`).digest("hex")))].sort().slice(0, MAX_HOST_KEYS);

/** Réserve le pire cas de chaque essai pris en charge, avec les empreintes des adresses prouvées du profil. */
export const reserveSpend = async (tx: Prisma.TransactionClient, ids: readonly string[], reservedCents: number, now: Date): Promise<void> => {
  const rows = await tx.measurementRequest.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, attempts: true, profile: { select: { ownedUrls: { where: { verifiedAt: { not: null } }, select: { url: true, urlKey: true, proofMethod: true } } } } },
  });
  await tx.measurementSpend.createMany({
    data: rows.map((row) => ({ requestId: row.id, attempt: row.attempts, reservedCents, hostKeys: measurementHostKeys(row.profile.ownedUrls), startedAt: now })),
    skipDuplicates: true,
  });
};

/** Règle un essai à sa dépense réelle. Sans effet sur un essai déjà réglé (bail expiré compté au pire cas). */
export const settleSpend = async (client: Prisma.TransactionClient, run: RunRef, actualCents: number, now: Date): Promise<void> => {
  await client.measurementSpend.updateMany({
    where: { requestId: run.id, attempt: run.attempts, settledAt: null },
    data: { actualCents: Math.max(0, Math.round(actualCents)), settledAt: now },
  });
};

/** Les essais commencés avant `startedBefore` et jamais réglés : bail expiré, dépense inconnue, comptée au pire cas. */
export const settleExpiredSpend = async (tx: Prisma.TransactionClient, startedBefore: Date, now: Date): Promise<void> => {
  await tx.$executeRaw`
    UPDATE "MeasurementSpend" SET "actualCents" = "reservedCents", "settledAt" = ${now}
    WHERE "settledAt" IS NULL AND "startedAt" <= ${startedBefore}`;
};

const SpentRow = z.object({ spent: z.number() });

/**
 * Dépense comptée depuis `from` : le réel (ou la réserve, tant qu'il n'est pas réglé) des essais commencés depuis,
 * plus la réserve de ce qui tourne encore. Une seule requête, donc un seul instantané.
 */
export const spentSince = async (tx: Prisma.TransactionClient, from: Date): Promise<number> => {
  const [row] = await tx.$queryRaw<unknown[]>`
    SELECT (COALESCE(SUM(CASE WHEN "startedAt" >= ${from} THEN COALESCE("actualCents", "reservedCents") END), 0)
          + COALESCE(SUM(CASE WHEN "settledAt" IS NULL AND "startedAt" < ${from} THEN "reservedCents" END), 0))::float8 AS "spent"
    FROM "MeasurementSpend"`;
  return SpentRow.parse(row).spent;
};

/** Les essais qui ont coûté (ou tournent encore) depuis `since` sur l'une de ces adresses, même d'un compte effacé. */
export const priorRuns = async (client: Prisma.TransactionClient, hostKeys: readonly string[], since: Date): Promise<readonly { readonly requestId: string; readonly startedAt: Date }[]> =>
  hostKeys.length === 0
    ? []
    : client.measurementSpend.findMany({
        where: { hostKeys: { hasSome: [...hostKeys] }, startedAt: { gte: since }, OR: [{ actualCents: null }, { actualCents: { gt: 0 } }] },
        select: { requestId: true, startedAt: true },
      });
