import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";
import { notifications } from "./notifications";

/*
 * Attestation de vigilance URSSAF (art. L8222-1 et D8222-5 du Code du travail) : pour toute prestation d'au moins
 * 5 000 € HT, l'entreprise cliente doit obtenir de son prestataire une attestation de moins de six mois. Proofseen la
 * tient pour les deux parties : le freelance la déclare (date de délivrance, code de sécurité), un contrat au-dessus du
 * seuil est refusé sans attestation en cours de validité, et un rappel part avant l'échéance.
 *
 * Le fait n'est affiché publiquement qu'une fois le code vérifié à la main par un opérateur sur le site de l'URSSAF :
 * une attestation déclarée n'est pas une attestation prouvée.
 */

export const VIGILANCE_VALIDITY_MONTHS = 6;
export const VIGILANCE_REMINDER_DAYS = 30;

const DAY_MS = 86_400_000;

/** Une attestation délivrée après cette date est encore en cours de validité à `now`. */
export const sixMonthsBefore = (now: Date): Date => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - VIGILANCE_VALIDITY_MONTHS);
  return d;
};

/** Date d'échéance : six mois calendaires après la délivrance. */
export const vigilanceExpiresOn = (issuedOn: Date): Date => {
  const d = new Date(issuedOn);
  d.setUTCMonth(d.getUTCMonth() + VIGILANCE_VALIDITY_MONTHS);
  return d;
};

export const VigilanceInputSchema = z.object({
  issuedOn: z.iso.date(),
  securityCode: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6,40}$/, "code de sécurité illisible")),
});

export type VigilanceInput = z.input<typeof VigilanceInputSchema>;

export type DeclareResult = { readonly kind: "saved"; readonly expiresOn: Date } | { readonly kind: "no_profile" } | { readonly kind: "expired" } | { readonly kind: "future" };

export interface VigilanceStatus {
  readonly state: "missing" | "valid" | "expired";
  readonly expiresOn: Date | null;
  readonly verified: boolean;
}

export const vigilance = (db: Db) => ({
  /** Le freelance déclare son attestation ; une nouvelle remplace l'ancienne et repart non vérifiée. */
  async declare(actor: Actor, raw: VigilanceInput, now: Date): Promise<DeclareResult> {
    const input = VigilanceInputSchema.parse(raw);
    const issuedOn = new Date(`${input.issuedOn}T00:00:00Z`);
    if (issuedOn.getTime() > now.getTime()) return { kind: "future" };
    const expiresOn = vigilanceExpiresOn(issuedOn);
    if (expiresOn.getTime() <= now.getTime()) return { kind: "expired" };
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (profile === null) return { kind: "no_profile" };
    const data = { issuedOn, securityCode: input.securityCode, verifiedAt: null, remindedAt: null, rejectedAt: null, rejectionReason: null };
    await db.vigilanceAttestation.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, ...data }, update: data });
    return { kind: "saved", expiresOn };
  },

  async status(profileId: string, now: Date): Promise<VigilanceStatus> {
    const row = await db.vigilanceAttestation.findUnique({ where: { profileId }, select: { issuedOn: true, verifiedAt: true } });
    if (row === null) return { state: "missing", expiresOn: null, verified: false };
    const expiresOn = vigilanceExpiresOn(row.issuedOn);
    return { state: expiresOn.getTime() > now.getTime() ? "valid" : "expired", expiresOn, verified: row.verifiedAt !== null };
  },

  /** Ce qu'un opérateur doit contrôler sur le site de l'URSSAF : date de délivrance et code de sécurité. */
  async forReference(reference: string): Promise<{ readonly issuedOn: Date; readonly securityCode: string; readonly verifiedAt: Date | null; readonly siret: string | null; readonly legalName: string | null } | null> {
    const row = await db.vigilanceAttestation.findFirst({
      where: { profile: { reference } },
      select: { issuedOn: true, securityCode: true, verifiedAt: true, profile: { select: { billing: { select: { siret: true, legalName: true } } } } },
    });
    if (row === null) return null;
    return { issuedOn: row.issuedOn, securityCode: row.securityCode, verifiedAt: row.verifiedAt, siret: row.profile.billing?.siret ?? null, legalName: row.profile.billing?.legalName ?? null };
  },

  /** Un opérateur a vérifié le code sur le site de l'URSSAF ; rend `false` si le profil n'a pas d'attestation. */
  async markVerified(reference: string, securityCode: string, now: Date): Promise<boolean> {
    // Le code contrôlé fait partie de la condition : une attestation redéclarée entre-temps n'est pas marquée à sa place.
    const { count } = await db.vigilanceAttestation.updateMany({ where: { profile: { reference }, rejectedAt: null, securityCode: securityCode.replace(/[\s-]/g, "").toUpperCase() }, data: { verifiedAt: now } });
    return count === 1;
  },

  /** Rappelle aux freelances dont l'attestation expire dans moins de VIGILANCE_REMINDER_DAYS jours ; une fois chacun. */
  async remindExpiring(now: Date): Promise<number> {
    // Expire avant now + 30 j ⇔ délivrée avant (now + 30 j) − 6 mois.
    const horizon = new Date(now.getTime() + VIGILANCE_REMINDER_DAYS * DAY_MS);
    horizon.setUTCMonth(horizon.getUTCMonth() - VIGILANCE_VALIDITY_MONTHS);
    const due = await db.vigilanceAttestation.findMany({
      // Échue : plus rien à rappeler, la règle des contrats s'applique déjà.
      where: { remindedAt: null, issuedOn: { lt: horizon, gt: sixMonthsBefore(now) } },
      select: { id: true, issuedOn: true, profile: { select: { userId: true } } },
      take: 200,
    });
    let reminded = 0;
    for (const row of due) {
      const sent = await db.$transaction(async (tx) => {
        const { count } = await tx.vigilanceAttestation.updateMany({ where: { id: row.id, remindedAt: null }, data: { remindedAt: now } });
        if (count === 0) return false;
        await notifications(db).enqueue(tx, [row.profile.userId], "vigilance_expiring", { expiresOn: vigilanceExpiresOn(row.issuedOn).toISOString().slice(0, 10) });
        return true;
      });
      if (sent) reminded += 1;
    }
    return reminded;
  },
});
