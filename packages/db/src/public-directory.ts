import { z } from "zod";
import type { Db } from "./client";
import { shownAvailability, type ShownAvailability } from "./availability";
import type { LanguageLevel, WorkMode } from "./generated/enums";
import { jobTitleByKey } from "./job-titles";
import { searchProfiles, type ProfileCard } from "./profile-search";

/*
 * L'annuaire public des freelances : les profils publiés, filtrés par compétences, ville, mode de travail, famille de
 * poste, disponibilité et faits vérifiés, du plus récemment mis à jour au plus ancien. Cet ordre est un fait daté, affiché
 * comme tel : jamais une pertinence, un score ni un classement de personnes.
 *
 * La recherche est celle des entreprises (profile-search.ts), réduite à ces filtres : mêmes profils, mêmes faits, mêmes
 * exclusions de ce qu'un opérateur a retiré du public. Photo et nom : profil nominatif seulement.
 */
export const DIRECTORY_PAGE_SIZE = 20;
const MAX_DIRECTORY_SKILLS = 5;

const Skill = z.string().trim().max(60);

export const DirectorySearchSchema = z.object({
  /** Une compétence (l'ancienne adresse `?competence=`) ; s'ajoute à `skills`. */
  skill: Skill.default(""),
  skills: z.array(Skill).max(MAX_DIRECTORY_SKILLS).default([]),
  city: z.string().trim().max(120).default(""),
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).max(3).default([]),
  jobTitle: z
    .string()
    .refine((key) => key === "" || jobTitleByKey(key) !== undefined, { message: "famille de poste inconnue" })
    .default(""),
  availableNow: z.boolean().default(false),
  provenOnly: z.boolean().default(false),
  verifiedMissionsOnly: z.boolean().default(false),
  registryActiveOnly: z.boolean().default(false),
  vigilanceValidOnly: z.boolean().default(false),
  page: z.number().int().min(1).max(50).default(1),
});
export type DirectorySearch = z.input<typeof DirectorySearchSchema>;

/** Une carte de l'annuaire : seulement des faits publics, les mêmes que ceux de la page du profil. */
export interface DirectoryCard {
  readonly slug: string;
  readonly reference: string;
  readonly displayName: string | null;
  /** Profil nominatif seulement. */
  readonly photoFileId: string | null;
  readonly headline: string;
  readonly city: string;
  readonly workMode: WorkMode;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  /** La disponibilité affichée : « non confirmée » au-delà de 30 jours sans confirmation (availability.ts). */
  readonly availability: ShownAvailability;
  readonly availableFrom: Date | null;
  readonly availabilityAt: Date;
  readonly skills: readonly string[];
  readonly languages: readonly { readonly code: string; readonly level: LanguageLevel }[];
  readonly facts: {
    readonly registryActive: boolean;
    readonly identityVerified: boolean;
    readonly vigilanceValid: boolean;
    readonly verifiedMissions: number;
    readonly provenUrls: number;
    readonly payingClients: number;
  };
  readonly updatedAt: Date;
}

const toDirectoryCard = (c: ProfileCard, now: Date): DirectoryCard[] =>
  c.slug === null || c.headline === null || c.city === null
    ? []
    : [
        {
          slug: c.slug,
          reference: c.reference,
          displayName: c.displayName ?? null,
          photoFileId: c.photoFileId,
          headline: c.headline,
          city: c.city,
          workMode: c.workMode,
          dailyRateCents: c.dailyRateCents,
          currency: c.currency,
          availability: shownAvailability(c.availability, c.availabilityAt, now),
          availableFrom: c.availableFrom,
          availabilityAt: c.availabilityAt,
          skills: c.skills,
          languages: c.languages,
          facts: {
            registryActive: c.registryActive,
            identityVerified: c.identityVerified,
            vigilanceValid: c.vigilanceValid,
            verifiedMissions: c.verifiedMissions,
            provenUrls: c.verifiedUrls,
            payingClients: c.payingClients,
          },
          updatedAt: c.updatedAt,
        },
      ];

export const directoryPage = async (db: Db, search: DirectorySearch, now: Date): Promise<{ readonly items: readonly DirectoryCard[]; readonly hasMore: boolean }> => {
  const f = DirectorySearchSchema.parse(search);
  const skills = [...new Set([f.skill, ...f.skills].filter((s) => s !== ""))];
  const page = await searchProfiles(
    db,
    {
      skills,
      ...(f.city === "" ? {} : { city: f.city }),
      workModes: f.workModes,
      ...(f.jobTitle === "" ? {} : { jobTitle: f.jobTitle }),
      availableNow: f.availableNow,
      provenOnly: f.provenOnly,
      verifiedMissionsOnly: f.verifiedMissionsOnly,
      registryActiveOnly: f.registryActiveOnly,
      vigilanceValidOnly: f.vigilanceValidOnly,
      sort: "recent",
      page: f.page,
      pageSize: DIRECTORY_PAGE_SIZE,
    },
    now,
  );
  return { items: page.items.flatMap((c) => toDirectoryCard(c, now)), hasMore: page.hasMore };
};
