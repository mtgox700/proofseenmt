import { z } from "zod";
import { ARTICLE_AUDIENCES, ARTICLE_CATEGORIES, MAX_BLOG_PAGE } from "@proofseen/db";

/*
 * The GET filters of the public blog index (`/fr/blog?categorie=guide&public=freelance&page=2`). Anything malformed
 * falls back to the plain list rather than an error page: a shared or hand-edited address always answers.
 */

export interface BlogQuery {
  readonly category: (typeof ARTICLE_CATEGORIES)[number] | null;
  readonly audience: (typeof ARTICLE_AUDIENCES)[number] | null;
  readonly page: number;
}

const QuerySchema = z.object({
  category: z.enum(ARTICLE_CATEGORIES).nullable().catch(null),
  audience: z.enum(ARTICLE_AUDIENCES).nullable().catch(null),
  page: z.coerce.number().int().min(1).max(MAX_BLOG_PAGE).catch(1),
});

export const blogQuery = (params: URLSearchParams): BlogQuery =>
  QuerySchema.parse({ category: params.get("categorie"), audience: params.get("public"), page: params.get("page") ?? "1" });
