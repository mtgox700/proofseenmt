import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import type { Prisma } from "./generated/client";
import { SETTLED_PAYMENT } from "./reviews";
import { skillKey } from "./skills";
import { vigilanceExpiresOn } from "./vigilance";

/** Une attestation ne se montre que vérifiée et non échue. */
const vigilanceShown = (v: { readonly issuedOn: Date; readonly verifiedAt: Date | null } | null, now: Date): Date | null => {
  if (v === null || v.verifiedAt === null) return null;
  const until = vigilanceExpiresOn(v.issuedOn);
  return until.getTime() > now.getTime() ? until : null;
};
import type { AvailabilityStatus, ClientKind, EvidenceKind, ProfileVisibility, WorkMode } from "./generated/enums";

/*
 * Ce qu'une page publique de profil peut montrer, et rien d'autre. C'est la page que les moteurs de recherche et d'IA
 * lisent : elle porte des faits vérifiés, jamais une note, un rang ou un score de la personne.
 *
 * Profil pseudonyme : ni nom, ni adresses web (une adresse personnelle suffit à retrouver quelqu'un) — seulement le
 * nombre de preuves de possession. Profil nominatif : le nom affiché et les adresses prouvées. Dans les deux cas, le
 * contact passe par la plateforme.
 *
 * Le nom affiché vient du compte de connexion ; sans prénom ni nom, c'est l'adresse e-mail. Un nom qui contient des
 * coordonnées n'est jamais publié : la page retombe sur la référence, comme un profil pseudonyme.
 */

/** Le nom public d'un profil, ou `null` (la page montre alors la référence). */
export const publicName = (visibility: ProfileVisibility, displayName: string): string | null =>
  visibility === "named" && !containsContact(displayName) ? displayName : null;

export interface PublicMissionFact {
  readonly role: string;
  readonly clientKind: ClientKind;
  readonly durationMonths: number;
  readonly summary: string;
  readonly evidenceKind: EvidenceKind;
  readonly verifiedAt: Date;
}

export interface PublicProfilePage {
  readonly reference: string;
  readonly slug: string;
  readonly visibility: Exclude<ProfileVisibility, "private">;
  /** Seulement pour un profil nominatif. */
  readonly displayName: string | null;
  readonly headline: string;
  readonly summary: string;
  readonly city: string;
  readonly workMode: WorkMode;
  readonly availability: AvailabilityStatus;
  readonly availableFrom: Date | null;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly skills: readonly string[];
  /** Adresses dont la possession est prouvée — vide pour un profil pseudonyme. */
  readonly provenUrls: readonly string[];
  readonly provenUrlCount: number;
  readonly missions: readonly PublicMissionFact[];
  readonly reviews: readonly { readonly rating: number; readonly body: string; readonly createdAt: Date }[];
  /**
   * Faits vérifiés, datés quand ils le sont : jamais un niveau, un badge gradué ni un score. Le SIRET lui-même n'est
   * jamais publié, seulement le fait que l'entreprise est active au répertoire officiel.
   */
  readonly facts: {
    readonly registryActiveCheckedAt: Date | null;
    readonly identityVerified: boolean;
    /** Entreprises distinctes qui ont payé au moins une mission sur Proofseen (paiement acquis). */
    readonly payingClients: number;
    /** Attestation de vigilance URSSAF vérifiée par un opérateur et en cours de validité : sa date d'échéance. */
    readonly vigilanceValidUntil: Date | null;
  };
  readonly updatedAt: Date;
}

/*
 * L'annuaire public : les profils publiés, filtrés par compétence et par ville, du plus récemment mis à jour au plus
 * ancien. Cet ordre est un fait daté, affiché comme tel : jamais une pertinence, un score ni un classement de personnes.
 */
export const DIRECTORY_PAGE_SIZE = 20;

export const DirectorySearchSchema = z.object({
  skill: z.string().trim().max(60).default(""),
  city: z.string().trim().max(120).default(""),
  page: z.number().int().min(1).max(50).default(1),
});
export type DirectorySearch = z.input<typeof DirectorySearchSchema>;

/** Une carte de l'annuaire : seulement des faits publics, les mêmes que ceux de la page du profil. */
export interface DirectoryCard {
  readonly slug: string;
  readonly reference: string;
  readonly displayName: string | null;
  readonly headline: string;
  readonly city: string;
  readonly workMode: WorkMode;
  readonly skills: readonly string[];
  readonly facts: {
    readonly registryActive: boolean;
    readonly identityVerified: boolean;
    readonly vigilanceValid: boolean;
    readonly verifiedMissions: number;
    readonly payingClients: number;
  };
  readonly updatedAt: Date;
}

export interface PublicProfiles {
  /** La page d'un profil publié et complet ; `null` sinon. */
  page(slug: string, now?: Date): Promise<PublicProfilePage | null>;
  /** Les profils publiés, pour le sitemap. */
  listForSitemap(): Promise<readonly { readonly slug: string; readonly updatedAt: Date }[]>;
  /** Une page de l'annuaire public. */
  directory(search: DirectorySearch, now?: Date): Promise<{ readonly items: readonly DirectoryCard[]; readonly hasMore: boolean }>;
}

const SLUG = /^[a-z0-9-]{3,60}$/;
export const MAX_SITEMAP_PROFILES = 25_000;

const directoryWhere = (f: z.output<typeof DirectorySearchSchema>): Prisma.FreelanceProfileWhereInput => {
  const skill = skillKey(f.skill);
  const city = skillKey(f.city);
  return {
    visibility: { not: "private" },
    slug: { not: null },
    headline: { not: null },
    city: { not: null },
    ...(city === "" ? {} : { cityKey: city }),
    ...(skill === "" ? {} : { skills: { some: { skill: { key: skill } } } }),
  };
};

export const publicProfiles = (db: Db): PublicProfiles => ({
  async page(slug, now = new Date()) {
    if (!SLUG.test(slug)) return null;
    const row = await db.freelanceProfile.findFirst({
      where: { slug, visibility: { not: "private" } },
      select: {
        reference: true,
        slug: true,
        visibility: true,
        headline: true,
        summary: true,
        city: true,
        workMode: true,
        availability: true,
        availableFrom: true,
        dailyRateCents: true,
        currency: true,
        updatedAt: true,
        user: { select: { displayName: true } },
        skills: { select: { skill: { select: { label: true } } } },
        ownedUrls: { where: { verifiedAt: { not: null } }, orderBy: { verifiedAt: "asc" }, select: { url: true } },
        missions: { orderBy: { verifiedAt: "desc" }, select: { role: true, clientKind: true, durationMonths: true, summary: true, evidenceKind: true, verifiedAt: true } },
        reviews: { where: { contract: { payments: { some: SETTLED_PAYMENT } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { rating: true, body: true, createdAt: true } },
        billing: { select: { registryStatus: true, registryCheckedAt: true, payoutsEnabledAt: true } },
        vigilance: { select: { issuedOn: true, verifiedAt: true } },
        // Des entreprises distinctes, pas des contrats : dix micro-contrats avec la même entreprise ne font pas dix clients.
        contracts: { where: { payments: { some: SETTLED_PAYMENT }, organisationId: { not: null } }, select: { organisationId: true }, distinct: ["organisationId"] },
      },
    });
    // Une page sans contenu réel n'est jamais servie : un profil publié a toujours titre, résumé et ville (la base
    // l'impose), mais on ne fait pas reposer la page sur cette seule garantie.
    if (row === null || row.slug === null || row.headline === null || row.summary === null || row.city === null || row.visibility === "private") return null;
    const named = row.visibility === "named";
    return {
      reference: row.reference,
      slug: row.slug,
      visibility: row.visibility,
      displayName: publicName(row.visibility, row.user.displayName),
      headline: row.headline,
      summary: row.summary,
      city: row.city,
      workMode: row.workMode,
      availability: row.availability,
      availableFrom: row.availableFrom,
      dailyRateCents: row.dailyRateCents,
      currency: row.currency,
      skills: row.skills.map((s) => s.skill.label),
      provenUrls: named ? row.ownedUrls.map((u) => u.url) : [],
      provenUrlCount: row.ownedUrls.length,
      missions: row.missions,
      reviews: row.reviews,
      facts: {
        registryActiveCheckedAt: row.billing?.registryStatus === "active" ? row.billing.registryCheckedAt : null,
        // Le prestataire de paiement n'ouvre les versements qu'après avoir vérifié l'identité du titulaire.
        identityVerified: row.billing?.payoutsEnabledAt != null,
        payingClients: row.contracts.length,
        vigilanceValidUntil: vigilanceShown(row.vigilance, now),
      },
      updatedAt: row.updatedAt,
    };
  },

  async listForSitemap() {
    const rows = await db.freelanceProfile.findMany({
      where: { visibility: { not: "private" }, slug: { not: null } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_SITEMAP_PROFILES,
      select: { slug: true, updatedAt: true },
    });
    return rows.flatMap((r) => (r.slug === null ? [] : [{ slug: r.slug, updatedAt: r.updatedAt }]));
  },

  async directory(search, now = new Date()) {
    const f = DirectorySearchSchema.parse(search);
    const rows = await db.freelanceProfile.findMany({
      where: directoryWhere(f),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * DIRECTORY_PAGE_SIZE,
      take: DIRECTORY_PAGE_SIZE + 1,
      select: {
        slug: true,
        reference: true,
        visibility: true,
        headline: true,
        city: true,
        workMode: true,
        updatedAt: true,
        user: { select: { displayName: true } },
        skills: { select: { skill: { select: { label: true } } } },
        billing: { select: { registryStatus: true, payoutsEnabledAt: true } },
        vigilance: { select: { issuedOn: true, verifiedAt: true } },
        _count: { select: { missions: true } },
        contracts: { where: { payments: { some: SETTLED_PAYMENT }, organisationId: { not: null } }, select: { organisationId: true } },
      },
    });
    const items = rows.slice(0, DIRECTORY_PAGE_SIZE).flatMap((r): DirectoryCard[] =>
      r.slug === null || r.headline === null || r.city === null || r.visibility === "private"
        ? []
        : [
            {
              slug: r.slug,
              reference: r.reference,
              displayName: publicName(r.visibility, r.user.displayName),
              headline: r.headline,
              city: r.city,
              workMode: r.workMode,
              skills: r.skills.map((s) => s.skill.label).sort((a, b) => a.localeCompare(b, "fr")),
              facts: {
                registryActive: r.billing?.registryStatus === "active",
                identityVerified: r.billing?.payoutsEnabledAt != null,
                vigilanceValid: vigilanceShown(r.vigilance, now) !== null,
                verifiedMissions: r._count.missions,
                // Des entreprises distinctes, comme sur la page du profil.
                payingClients: new Set(r.contracts.map((c) => c.organisationId)).size,
              },
              updatedAt: r.updatedAt,
            },
          ],
    );
    return { items, hasMore: rows.length > DIRECTORY_PAGE_SIZE };
  },
});
