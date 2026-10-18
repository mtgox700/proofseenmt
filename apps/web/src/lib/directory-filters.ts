import { z } from "zod";
import { JOB_TITLES, type DirectorySearch } from "@proofseen/db";
import type { DirectoryFilters, DirectoryWorkMode } from "@proofseen/hub";

/*
 * The GET filters of the public freelancer directory (`/fr/freelances?competence=…&ville=…&mode=…&poste=…&page=…`).
 * Anything malformed falls back to the plain list rather than an error page: a shared or hand-edited address always
 * answers. `competence` takes one skill or a comma list (five at most), as the form sends it.
 */

export type DirectoryQuery = DirectoryFilters;

const MAX_PAGE = 50;
const MAX_SKILLS = 5;
const MAX_SKILL_LENGTH = 60;
const MODES: readonly DirectoryWorkMode[] = ["remote", "hybrid", "onsite"];
const JOB_TITLE_KEYS: readonly string[] = JOB_TITLES.map((t) => t.key);

const Page = z.coerce.number().int().min(1).max(MAX_PAGE).catch(1);
const City = z.string().trim().max(120).catch("");

const ticked = (params: URLSearchParams, name: string): boolean => {
  const value = params.get(name);
  return value === "1" || value === "on";
};

const skillsOf = (params: URLSearchParams): readonly string[] => {
  const seen = new Set<string>();
  return params
    .getAll("competence")
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s.length <= MAX_SKILL_LENGTH)
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SKILLS);
};

export const directoryQuery = (params: URLSearchParams): DirectoryQuery => {
  const jobTitle = (params.get("poste") ?? "").trim();
  return {
    skills: skillsOf(params),
    city: City.parse(params.get("ville") ?? ""),
    workModes: MODES.filter((mode) => params.getAll("mode").includes(mode)),
    jobTitle: JOB_TITLE_KEYS.includes(jobTitle) ? jobTitle : "",
    availableNow: ticked(params, "disponible"),
    provenOnly: ticked(params, "adresse"),
    verifiedMissionsOnly: ticked(params, "missions"),
    registryActiveOnly: ticked(params, "siret"),
    vigilanceValidOnly: ticked(params, "urssaf"),
    page: Page.parse(params.get("page") ?? "1"),
  };
};

/** The repository's input for a directory query. */
export const directorySearch = (q: DirectoryQuery): DirectorySearch => ({
  skills: [...q.skills],
  city: q.city,
  workModes: [...q.workModes],
  jobTitle: q.jobTitle,
  availableNow: q.availableNow,
  provenOnly: q.provenOnly,
  verifiedMissionsOnly: q.verifiedMissionsOnly,
  registryActiveOnly: q.registryActiveOnly,
  vigilanceValidOnly: q.vigilanceValidOnly,
  page: q.page,
});

/** The job title families offered in the form, labelled in the page's language. */
export const jobTitleOptions = (lang: "fr" | "en"): readonly { readonly key: string; readonly label: string }[] =>
  JOB_TITLES.map((t) => ({ key: t.key, label: t.label[lang] })).sort((a, b) => a.label.localeCompare(b.label, lang));
