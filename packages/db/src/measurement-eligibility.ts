import type { Prisma } from "./generated/client";
import type { MeasurementStatus } from "./generated/enums";
import { measurementHostKeys, priorRuns } from "./measurement-ledger";

/*
 * Qui peut demander une mesure, et sinon pourquoi. Chaque mesure est payée par la plateforme : les limites ci-dessous
 * bornent ce qu'un compte, et une flotte de comptes jetables, peuvent lui faire dépenser.
 *
 * - un profil publié avec au moins une adresse prouvée (sans elle, la mesure dépenserait pour un zéro certain) ;
 * - un compte d'au moins 24 heures : créer des comptes à la chaîne ne lance pas des mesures à la chaîne ;
 * - une seule demande active par profil (garanti aussi par un index unique partiel) ;
 * - au plus `MEASUREMENTS_PER_WINDOW` demandes par période glissante, comptées sur le profil ET sur les adresses qu'il
 *   a prouvées (registre de dépense) : effacer son compte puis prouver le même domaine sur un compte neuf ne libère
 *   aucune place ;
 * - au plus `MEASUREMENT_QUEUE_MAX` demandes en file sur toute la plateforme.
 */

/** Demandes acceptées par profil sur la période glissante. */
export const MEASUREMENTS_PER_WINDOW = 2;
export const MEASUREMENT_WINDOW_DAYS = 30;
/** Demandes en file sur toute la plateforme au-delà desquelles une nouvelle demande est refusée. */
export const MEASUREMENT_QUEUE_MAX = 20;
/** Ancienneté minimale du compte avant la première demande. */
export const MEASUREMENT_MIN_ACCOUNT_AGE_HOURS = 24;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const COUNTED: readonly MeasurementStatus[] = ["queued", "running", "done"];

export type MeasurementRefusal = "no_profile" | "not_published" | "no_proven_url" | "too_recent" | "already_active" | "monthly_limit" | "platform_busy";

export type Eligibility =
  | { readonly kind: "allowed"; readonly remaining: number }
  | { readonly kind: "refused"; readonly reason: MeasurementRefusal; readonly availableAt: Date | null };

export const refused = (reason: MeasurementRefusal, availableAt: Date | null = null): Extract<Eligibility, { kind: "refused" }> => ({ kind: "refused", reason, availableAt });

/**
 * Les demandes comptées sur la fenêtre, chacune à sa première date connue : celles du profil (toute demande qui a
 * coûté compte, quel que soit son état) et celles du registre sur les mêmes adresses, même d'un compte effacé.
 */
const countedSince = async (
  client: Prisma.TransactionClient,
  profileId: string,
  hostKeys: readonly string[],
  since: Date,
): Promise<readonly number[]> => {
  const [recent, prior] = await Promise.all([
    client.measurementRequest.findMany({
      where: { profileId, createdAt: { gte: since }, OR: [{ status: { in: [...COUNTED] } }, { costCents: { gt: 0 } }] },
      select: { id: true, createdAt: true },
    }),
    priorRuns(client, hostKeys, since),
  ]);
  const firstSeen = new Map<string, number>();
  const note = (id: string, at: Date): void => {
    firstSeen.set(id, Math.min(firstSeen.get(id) ?? Number.POSITIVE_INFINITY, at.getTime()));
  };
  for (const row of recent) note(row.id, row.createdAt);
  for (const run of prior) note(run.requestId, run.startedAt);
  return [...firstSeen.values()].sort((a, b) => a - b);
};

export const checkEligibility = async (client: Prisma.TransactionClient, userId: string, now: Date): Promise<Eligibility & { readonly profileId?: string }> => {
  const profile = await client.freelanceProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      visibility: true,
      user: { select: { createdAt: true } },
      ownedUrls: { where: { verifiedAt: { not: null } }, select: { url: true, urlKey: true, proofMethod: true } },
    },
  });
  if (profile === null) return refused("no_profile");
  if (profile.visibility === "private") return refused("not_published");
  if (profile.ownedUrls.length === 0) return refused("no_proven_url");
  const oldEnough = profile.user.createdAt.getTime() + MEASUREMENT_MIN_ACCOUNT_AGE_HOURS * HOUR_MS;
  if (oldEnough > now.getTime()) return refused("too_recent", new Date(oldEnough));
  const active = await client.measurementRequest.count({ where: { profileId: profile.id, status: { in: ["queued", "running"] } } });
  if (active > 0) return refused("already_active");
  const counted = await countedSince(client, profile.id, measurementHostKeys(profile.ownedUrls), new Date(now.getTime() - MEASUREMENT_WINDOW_DAYS * DAY_MS));
  if (counted.length >= MEASUREMENTS_PER_WINDOW) {
    // Une place se libère quand assez de demandes comptées sont sorties de la fenêtre.
    const freeing = counted[counted.length - MEASUREMENTS_PER_WINDOW] ?? now.getTime();
    return refused("monthly_limit", new Date(freeing + MEASUREMENT_WINDOW_DAYS * DAY_MS));
  }
  if ((await client.measurementRequest.count({ where: { status: "queued" } })) >= MEASUREMENT_QUEUE_MAX) return refused("platform_busy");
  return { kind: "allowed", remaining: MEASUREMENTS_PER_WINDOW - counted.length, profileId: profile.id };
};
