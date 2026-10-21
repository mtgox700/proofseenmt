import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import { matchesFoldedJobTitle } from "./job-titles";
import { LISTED_PROFILE } from "./public-visibility";
import { foldText } from "./search-text";

/*
 * Ce que Prisma ne sait pas exprimer dans la recherche de profils, réduit à une liste d'identifiants que la requête
 * principale reprend (`id IN …`) :
 *  - les mots-clés, en plein texte sur le texte plié du profil (`searchText`, tenu par la base) ;
 *  - la famille de poste (job-titles.ts), reconnue dans le titre du profil par l'application, comme sur les pages
 *    publiques par poste : la même règle partout.
 *
 * Chaque liste est bornée. Ce sont des filtres : jamais un ts_rank, une pertinence, une somme de preuves ni une note de
 * personne (AI Act). L'ancien ordre « nombre de faits vérifiés » a été retiré pour cette raison.
 */

export const ProfileTextSchema = z.string().trim().min(1).max(200);

/** Profils retenus au plus par les mots-clés : au-delà, la recherche se précise. */
export const MAX_TEXT_MATCHES = 2000;
/** Profils publiés lus au plus pour reconnaître une famille de poste ou compter les facettes, les plus récents d'abord. */
export const MAX_SCAN = 5000;

/** Un profil publié et complet, que personne n'a retiré du public : la base de toute recherche. */
export const PUBLISHED_PROFILE = {
  visibility: { not: "private" },
  ...LISTED_PROFILE,
  slug: { not: null },
  headline: { not: null },
  city: { not: null },
} as const satisfies Prisma.FreelanceProfileWhereInput;

/**
 * Les profils dont le texte contient les mots cherchés, en français et en anglais, sans accents. L'expression est celle
 * de l'index `FreelanceProfile_public_search_text_idx` (migration 20261018100000_advanced_search), au caractère près.
 * Le texte cherché passe en paramètre, jamais dans le SQL. Un profil masqué par l’opérateur ne prend pas de place dans la
 * limite (relecture sécurité C22, recherche B3).
 */
export const textMatches = async (db: Db, raw: string): Promise<readonly string[]> => {
  const q = foldText(ProfileTextSchema.parse(raw));
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "FreelanceProfile"
    WHERE "visibility" <> 'private' AND "moderatedAt" IS NULL
      AND (to_tsvector('french'::regconfig, "searchText") || to_tsvector('english'::regconfig, "searchText"))
          @@ (websearch_to_tsquery('french'::regconfig, ${q}) || websearch_to_tsquery('english'::regconfig, ${q}))
    ORDER BY "updatedAt" DESC, "id" DESC
    LIMIT ${MAX_TEXT_MATCHES}`;
  return rows.map((row) => row.id);
};

export interface HeadlineRow {
  readonly id: string;
  readonly headline: string | null;
}

/** Les identifiants et titres d'un ensemble de profils, bornés ; `capped` dit qu'il y en avait davantage. */
export const scanHeadlines = async (db: Db, where: Prisma.FreelanceProfileWhereInput): Promise<{ readonly rows: readonly HeadlineRow[]; readonly capped: boolean }> => {
  const rows = await db.freelanceProfile.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: MAX_SCAN + 1, select: { id: true, headline: true } });
  return { rows: rows.slice(0, MAX_SCAN), capped: rows.length > MAX_SCAN };
};

/** Les lignes dont le titre entre dans la famille de poste. */
export const inJobTitle = (key: string, rows: readonly HeadlineRow[]): readonly HeadlineRow[] =>
  rows.filter((row) => row.headline !== null && matchesFoldedJobTitle(key, foldText(row.headline)));

/** Les profils publiés dont le titre entre dans la famille de poste. */
export const jobTitleMatches = async (db: Db, key: string): Promise<readonly string[]> =>
  inJobTitle(key, (await scanHeadlines(db, PUBLISHED_PROFILE)).rows).map((row) => row.id);

/** Deux restrictions ensemble : seulement les identifiants présents dans les deux ; `null` veut dire « aucune ». */
export const intersect = (a: readonly string[] | null, b: readonly string[] | null): readonly string[] | null => {
  if (a === null) return b;
  if (b === null) return a;
  const kept = new Set(b);
  return a.filter((id) => kept.has(id));
};
