import { z } from "zod";
import type { CompanySearch } from "@proofseen/db";
import { COMPANY_DIRECTORY_SORTS, COMPANY_KINDS, type CompanyDirectoryFilters, type CompanyKind } from "@proofseen/hub";

/*
 * The GET filters of the companies directory (`/fr/entreprises?ville=…&type=…&recrute=1&tri=…`), public and in the
 * connected space. Anything malformed is no filter: a hand-edited address always answers.
 */

const Page = z.coerce.number().int().min(1).max(50).catch(1);
const City = z.string().trim().max(120).catch("");

const ticked = (params: URLSearchParams, name: string): boolean => {
  const value = params.get(name);
  return value === "1" || value === "on";
};

const isKind = (raw: string): raw is CompanyKind => (COMPANY_KINDS as readonly string[]).includes(raw);

export const companyDirectoryQuery = (params: URLSearchParams): CompanyDirectoryFilters => {
  const kind = params.get("type") ?? "";
  const sort = params.get("tri") ?? "";
  return {
    city: City.parse(params.get("ville") ?? ""),
    kind: isKind(kind) ? kind : "",
    hiringOnly: ticked(params, "recrute"),
    registryActiveOnly: ticked(params, "siret"),
    sort: COMPANY_DIRECTORY_SORTS.find((s) => s === sort) ?? "name",
    page: Page.parse(params.get("page") ?? "1"),
  };
};

/** The repository's input for a companies directory query. */
export const companySearch = (f: CompanyDirectoryFilters): CompanySearch => ({
  city: f.city,
  ...(f.kind === "" ? {} : { kind: f.kind }),
  hiringOnly: f.hiringOnly,
  registryActiveOnly: f.registryActiveOnly,
  sort: f.sort,
  page: f.page,
});
