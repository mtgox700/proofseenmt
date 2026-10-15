import { z } from "zod";
import type { Db } from "./client";
import { containsContact, NO_CONTACT } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { AvailabilityStatus, ProfileVisibility, WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { searchProfiles, type ProfileSearch, type ProfileSearchPage } from "./profile-search";
import { ensureSkills, skillKey } from "./skills";
import { LISTED_PROFILE } from "./public-visibility";

/*
 * Profil freelance : un par personne, privé tant qu'elle ne le publie pas.
 *
 * Ce qu'une entreprise voit d'un profil publié : des faits (titre, ville, mode de travail, TJM, disponibilité,
 * compétences, nombre d'adresses dont la possession est prouvée, nombre de missions vérifiées). Le nom de la personne
 * vit sur le compte, pas sur le profil : seul un profil nominatif le montre, jamais un profil pseudonyme ; et jamais une
 * note ou un rang. L'adresse publique du profil dérive de sa référence tirée au hasard, pas du nom.
 *
 * La recherche filtre et l'utilisateur choisit l'ordre (AI Act) ; à ordre égal, l'identifiant départage, de façon
 * stable et sans signification.
 */

const MAX_REFERENCE_ATTEMPTS = 5;
const MAX_RATE_CENTS = 10_000_000;

export const ProfileInputSchema = z
  .object({
    headline: z.string().trim().min(2).max(200).nullable().default(null),
    summary: z.string().trim().min(2).max(4000).nullable().default(null),
    city: z.string().trim().min(1).max(120).nullable().default(null),
    workMode: z.enum(["onsite", "hybrid", "remote"]),
    dailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).nullable().default(null),
    availability: z.enum(["available", "available_from", "unavailable"]).default("available"),
    availableFrom: z.date().nullable().default(null),
    skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  })
  .refine((p) => (p.availability === "available_from") === (p.availableFrom !== null), {
    message: "une date de disponibilité accompagne « disponible à partir de », et elle seule",
  })
  // Le profil publié est lu par les moteurs : une adresse ou un numéro y ferait passer le contact hors plateforme.
  .refine((p) => ![p.headline, p.summary, p.city, ...p.skills].some((field) => field !== null && containsContact(field)), { message: NO_CONTACT });

export type ProfileInput = z.input<typeof ProfileInputSchema>;

export interface ProfileFacts {
  readonly id: string;
  readonly reference: string;
  readonly slug: string | null;
  readonly visibility: ProfileVisibility;
  readonly headline: string | null;
  readonly summary: string | null;
  readonly city: string | null;
  readonly workMode: WorkMode;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly availableFrom: Date | null;
  readonly skills: readonly string[];
  readonly verifiedUrls: number;
  readonly verifiedMissions: number;
}

export { PROFILE_SORTS, ProfileSearchSchema, type ProfileCard, type ProfileSearch, type ProfileSearchPage, type ProfileSort } from "./profile-search";

/** Ce qu'un profil doit renseigner avant d'être publié. */
export const REQUIRED_TO_PUBLISH = ["headline", "summary", "city"] as const;

export type VisibilityResult =
  | { readonly kind: "ok"; readonly profile: ProfileFacts }
  | { readonly kind: "incomplete"; readonly missing: readonly (typeof REQUIRED_TO_PUBLISH)[number][] }
  | { readonly kind: "absent" };

export interface Profiles {
  /** Crée le profil de l'acteur, privé. `null` s'il en a déjà un. */
  create(actor: Actor, input: ProfileInput, newReference: () => string): Promise<ProfileFacts | null>;
  update(actor: Actor, input: ProfileInput): Promise<ProfileFacts | null>;
  /** Publie (pseudonyme ou nommé) ou retire le profil. Un profil incomplet n'est pas publié : la réponse dit ce qui manque. */
  setVisibility(actor: Actor, visibility: ProfileVisibility): Promise<VisibilityResult>;
  findMine(actor: Actor): Promise<ProfileFacts | null>;
  /** Un profil publié, par son adresse publique ; `null` s'il est privé ou n'existe pas. */
  findPublic(slug: string): Promise<ProfileFacts | null>;
  /** Les profils publiés qui répondent aux filtres, dans l'ordre choisi par l'entreprise (voir `profile-search`). */
  search(filters: ProfileSearch, now?: Date): Promise<ProfileSearchPage>;
}

const SELECT = {
  id: true,
  reference: true,
  slug: true,
  visibility: true,
  headline: true,
  summary: true,
  city: true,
  workMode: true,
  dailyRateCents: true,
  currency: true,
  availability: true,
  availableFrom: true,
  skills: { select: { skill: { select: { label: true } } } },
  _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true } },
} as const;

type Row = Prisma.FreelanceProfileGetPayload<{ select: typeof SELECT }>;

const toFacts = ({ skills, _count, ...row }: Row): ProfileFacts => ({
  ...row,
  skills: skills.map((s) => s.skill.label),
  verifiedUrls: _count.ownedUrls,
  verifiedMissions: _count.missions,
});

const cityKey = (city: string | null): string | null => (city === null ? null : skillKey(city));

const columns = (p: z.output<typeof ProfileInputSchema>) => ({
  headline: p.headline,
  summary: p.summary,
  city: p.city,
  cityKey: cityKey(p.city),
  workMode: p.workMode,
  dailyRateCents: p.dailyRateCents,
  availability: p.availability,
  availableFrom: p.availableFrom,
  availabilityAt: new Date(),
});

const SLUG = /^[a-z0-9-]{3,60}$/;

export const profiles = (db: Db): Profiles => ({
  async create(actor, raw, newReference) {
    const input = ProfileInputSchema.parse(raw);
    if ((await db.freelanceProfile.count({ where: { userId: actor.userId } })) > 0) return null;
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const reference = newReference();
      try {
        const row = await db.$transaction(async (tx) => {
          const skillIds = await ensureSkills(tx, input.skills);
          return tx.freelanceProfile.create({
            data: { ...columns(input), userId: actor.userId, reference, skills: { create: skillIds.map((skillId) => ({ skillId })) } },
            select: SELECT,
          });
        });
        return toFacts(row);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Le compte a gagné une course contre lui-même (deux onglets) : son profil existe désormais.
        if ((await db.freelanceProfile.count({ where: { userId: actor.userId } })) > 0) return null;
      }
    }
    throw new Error("impossible d'allouer une référence libre");
  },

  async update(actor, raw) {
    const input = ProfileInputSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const profile = await tx.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
      if (profile === null) return null;
      const skillIds = await ensureSkills(tx, input.skills);
      await tx.freelanceSkill.deleteMany({ where: { profileId: profile.id } });
      await tx.freelanceSkill.createMany({ data: skillIds.map((skillId) => ({ profileId: profile.id, skillId })) });
      return toFacts(await tx.freelanceProfile.update({ where: { id: profile.id }, data: columns(input), select: SELECT }));
    });
  },

  async setVisibility(actor, visibility) {
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { reference: true, headline: true, summary: true, city: true } });
    if (profile === null) return { kind: "absent" };
    if (visibility !== "private") {
      const missing = REQUIRED_TO_PUBLISH.filter((field) => profile[field] === null);
      if (missing.length > 0) return { kind: "incomplete", missing };
    }
    const row = await db.freelanceProfile.update({
      where: { userId: actor.userId },
      data: { visibility, ...(visibility === "private" ? {} : { slug: profile.reference.toLowerCase() }) },
      select: SELECT,
    });
    return { kind: "ok", profile: toFacts(row) };
  },

  async findMine(actor) {
    const row = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: SELECT });
    return row === null ? null : toFacts(row);
  },

  async findPublic(slug) {
    if (!SLUG.test(slug)) return null;
    const row = await db.freelanceProfile.findFirst({ where: { slug, visibility: { not: "private" }, ...LISTED_PROFILE }, select: SELECT });
    return row === null ? null : toFacts(row);
  },

  search(raw, now = new Date()) {
    return searchProfiles(db, raw, now);
  },
});
