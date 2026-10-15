import type { Prisma } from "./generated/client";
import type { LanguageLevel } from "./generated/enums";

/*
 * Ce que la page publique d'un profil montre des sections déclarées par le freelance. Des déclarations, présentées
 * comme telles : jamais un niveau calculé, une ancienneté déduite ni une note.
 *
 * Un profil pseudonyme ne publie ni photo (un visage identifie), ni image de réalisation (une capture porte un nom, un
 * logo, un visage), ni adresse web (portfolio, vérification d'une certification), ni entreprise, ni école : une
 * entreprise ou une école, croisée avec des dates, désigne la personne. Restent le rôle, les dates, les descriptions et
 * les compétences. Une entreprise que le freelance a masquée n'apparaît jamais, quel que soit le profil.
 */

export interface PublicExperience {
  readonly title: string;
  /** `null` quand le freelance l'a masquée ou ne l'a pas donnée, et toujours sur un profil pseudonyme. */
  readonly company: string | null;
  readonly startMonth: Date;
  readonly endMonth: Date | null;
  readonly description: string | null;
  readonly skills: readonly string[];
}

export interface PublicEducation {
  /** Profil nominatif seulement. */
  readonly school: string | null;
  readonly degree: string | null;
  readonly startYear: number | null;
  readonly endYear: number | null;
}

export interface PublicCertification {
  readonly name: string;
  readonly issuer: string | null;
  readonly year: number | null;
  /** Profil nominatif seulement. */
  readonly credentialUrl: string | null;
  readonly skills: readonly string[];
}

export interface PublicPortfolioItem {
  readonly title: string;
  /** Profil nominatif seulement. */
  readonly url: string | null;
  readonly description: string | null;
  /** Profil nominatif seulement. */
  readonly imageFileId: string | null;
}

export interface PublicProfileSections {
  readonly experiences: readonly PublicExperience[];
  readonly educations: readonly PublicEducation[];
  readonly certifications: readonly PublicCertification[];
  readonly languages: readonly { readonly code: string; readonly level: LanguageLevel }[];
  readonly portfolio: readonly PublicPortfolioItem[];
}

export const PUBLIC_SECTIONS_SELECT = {
  photoFileId: true,
  availabilityAt: true,
  experiences: {
    orderBy: [{ endMonth: { sort: "desc", nulls: "first" } }, { startMonth: "desc" }, { id: "desc" }],
    select: { title: true, company: true, companyHidden: true, startMonth: true, endMonth: true, description: true, skills: true },
  },
  educations: { orderBy: [{ endYear: { sort: "desc", nulls: "first" } }, { id: "desc" }], select: { school: true, degree: true, startYear: true, endYear: true } },
  certifications: { orderBy: [{ year: { sort: "desc", nulls: "last" } }, { id: "desc" }], select: { name: true, issuer: true, year: true, credentialUrl: true, skills: true } },
  languages: { orderBy: { code: "asc" }, select: { code: true, level: true } },
  portfolio: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { title: true, url: true, description: true, imageFileId: true } },
} as const satisfies Prisma.FreelanceProfileSelect;

type SectionsRow = Prisma.FreelanceProfileGetPayload<{ select: typeof PUBLIC_SECTIONS_SELECT }>;

export const publicSections = (row: SectionsRow, named: boolean): PublicProfileSections => ({
  experiences: row.experiences.map(({ companyHidden, company, ...e }) => ({ ...e, company: named && !companyHidden ? company : null })),
  educations: row.educations.map((e) => ({ ...e, school: named ? e.school : null })),
  certifications: row.certifications.map((c) => ({ ...c, credentialUrl: named ? c.credentialUrl : null })),
  languages: row.languages,
  portfolio: row.portfolio.map((p) => ({ ...p, url: named ? p.url : null, imageFileId: named ? p.imageFileId : null })),
});

/** La photo publiée : seulement sur un profil nominatif. */
export const publicPhoto = (row: Pick<SectionsRow, "photoFileId">, named: boolean): string | null => (named ? row.photoFileId : null);
