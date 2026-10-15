import { z } from "zod";
import type { Db } from "./client";

/*
 * Recherche plein texte des missions ouvertes : l'intitulé, la description et les compétences, lus en français et en
 * anglais (« développeuse » trouve « développeurs », « migration » trouve « migrations »). C'est un filtre, pas un
 * classement : la requête rend des identifiants, et la liste garde l'ordre choisi par le visiteur. Aucun ts_rank.
 *
 * L'expression est celle de l'index `JobPost_open_fulltext_idx` (migration 20261015130000_missions_space), au
 * caractère près : sinon Postgres ne s'en sert pas. Le texte cherché passe en paramètre, jamais dans le SQL.
 */

export const SearchTextSchema = z.string().trim().min(1).max(200);

/**
 * Missions correspondantes retenues au plus, les plus récentes d'abord. Au-delà, l'ordre par TJM ne porte que sur ces
 * missions-là : une recherche qui en trouve plus de 2 000 se précise.
 */
export const MAX_FULLTEXT_MATCHES = 2000;

export const fullTextMatches = async (db: Db, raw: string): Promise<readonly string[]> => {
  const q = SearchTextSchema.parse(raw);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "JobPost"
    WHERE "status" = 'open'
      AND (to_tsvector('french'::regconfig, "title" || ' ' || "description" || ' ' || "skillsText")
           || to_tsvector('english'::regconfig, "title" || ' ' || "description" || ' ' || "skillsText"))
          @@ (websearch_to_tsquery('french'::regconfig, ${q}) || websearch_to_tsquery('english'::regconfig, ${q}))
    ORDER BY "publishedAt" DESC, "id" DESC
    LIMIT ${MAX_FULLTEXT_MATCHES}`;
  return rows.map((row) => row.id);
};
