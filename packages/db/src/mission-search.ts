import { z } from "zod";
import type { Db } from "./client";
import { foldText } from "./search-text";

/*
 * Recherche plein texte des missions ouvertes : l'intitulé, la description et les compétences, lus en français et en
 * anglais (« développeuse » trouve « développeurs », « migration » trouve « migrations »), sans tenir compte des
 * accents (« developpeur » trouve « Développeur ») : le texte de la mission (`searchText`) et le texte cherché sont
 * pliés de la même façon (search-text.ts). C'est un filtre, pas un classement : la requête rend des identifiants, et
 * la liste garde l'ordre choisi par le visiteur. Aucun ts_rank.
 *
 * L'expression est celle de l'index `JobPost_open_search_idx` (migration 20261017090000_search_unaccent), au
 * caractère près : sinon Postgres ne s'en sert pas. Le texte cherché passe en paramètre, jamais dans le SQL.
 */

export const SearchTextSchema = z.string().trim().min(1).max(200);

/**
 * Missions correspondantes retenues au plus, les plus récentes d'abord. Au-delà, l'ordre par TJM ne porte que sur ces
 * missions-là : une recherche qui en trouve plus de 2 000 se précise.
 */
export const MAX_FULLTEXT_MATCHES = 2000;

export const fullTextMatches = async (db: Db, raw: string): Promise<readonly string[]> => {
  const q = foldText(SearchTextSchema.parse(raw));
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "JobPost"
    WHERE "status" = 'open'
      AND (to_tsvector('french'::regconfig, "searchText") || to_tsvector('english'::regconfig, "searchText"))
          @@ (websearch_to_tsquery('french'::regconfig, ${q}) || websearch_to_tsquery('english'::regconfig, ${q}))
    ORDER BY "publishedAt" DESC, "id" DESC
    LIMIT ${MAX_FULLTEXT_MATCHES}`;
  return rows.map((row) => row.id);
};
