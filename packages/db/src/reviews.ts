import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Actor } from "./messaging";

/*
 * Avis. Un avis n'existe que pour une mission terminée **et payée sur la plateforme**, écrit par un membre de
 * l'entreprise cliente sur le freelance du contrat, une seule fois. La base l'impose aussi : pas d'avis libre, pas
 * d'avis acheté, pas dix avis pour une seule mission.
 *
 * Ce qu'on montre : chaque avis, tel qu'écrit, avec sa date. Ce qu'on ne calcule jamais : une moyenne, une note globale
 * ou un rang de la personne (règle AI Act du projet). Un avis est public : il ne contient pas de coordonnées.
 */

const Uuid = z.uuid();

export const ReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .refine((text) => !containsContact(text), { message: "pas de coordonnées dans un avis public" }),
});

export type ReviewInput = z.input<typeof ReviewInputSchema>;

export interface PublicReview {
  readonly id: string;
  readonly rating: number;
  readonly body: string;
  readonly createdAt: Date;
}

export type WriteReviewResult = { readonly kind: "written"; readonly review: PublicReview } | { readonly kind: "already_written" } | { readonly kind: "not_eligible" };

export interface Reviews {
  write(actor: Actor, contractId: string, input: ReviewInput): Promise<WriteReviewResult>;
  /** Les avis d'un profil publié, les plus récents d'abord. Aucun agrégat. */
  listForProfile(profileId: string): Promise<readonly PublicReview[]>;
}

const SELECT = { id: true, rating: true, body: true, createdAt: true } as const;

export const reviews = (db: Db): Reviews => ({
  async write(actor, contractId, raw) {
    if (!Uuid.safeParse(contractId).success) return { kind: "not_eligible" };
    const input = ReviewInputSchema.parse(raw);
    const contract = await db.contract.findFirst({
      where: {
        id: contractId,
        status: "completed",
        payments: { some: { status: "released" } },
        organisation: { members: { some: { userId: actor.userId } } },
        NOT: { profile: { userId: actor.userId } },
      },
      select: { profileId: true },
    });
    if (contract?.profileId == null) return { kind: "not_eligible" };
    try {
      const review = await db.review.create({
        data: { contractId, authorUserId: actor.userId, targetProfileId: contract.profileId, rating: input.rating, body: input.body },
        select: SELECT,
      });
      return { kind: "written", review };
    } catch (error) {
      if (isUniqueViolation(error)) return { kind: "already_written" };
      throw error;
    }
  },

  async listForProfile(profileId) {
    if (!Uuid.safeParse(profileId).success) return [];
    return db.review.findMany({
      where: { targetProfileId: profileId, target: { visibility: { not: "private" } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: SELECT,
    });
  },
});
