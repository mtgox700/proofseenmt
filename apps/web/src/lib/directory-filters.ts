import { z } from "zod";

/*
 * The GET filters of the public freelancer directory (`/fr/freelances?competence=…&ville=…&page=…`). Anything
 * malformed falls back to the plain list rather than an error page: a shared or hand-edited address always answers.
 */

export interface DirectoryQuery {
  readonly skill: string;
  readonly city: string;
  readonly page: number;
}

const MAX_PAGE = 50;

const QuerySchema = z.object({
  skill: z.string().trim().max(60).catch(""),
  city: z.string().trim().max(120).catch(""),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});

export const directoryQuery = (params: URLSearchParams): DirectoryQuery =>
  QuerySchema.parse({ skill: params.get("competence") ?? "", city: params.get("ville") ?? "", page: params.get("page") ?? "1" });
