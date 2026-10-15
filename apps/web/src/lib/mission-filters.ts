import { z } from "zod";
import type { MissionSearch } from "@proofseen/db";
import type { JobIndexFilters, SinceDays } from "@proofseen/hub";

/*
 * The GET filters of the public mission list (`/fr/missions?q=…&tjmMin=…&depuis=7…`), read into two shapes: what the
 * page shows back in its form, and what the repository searches. Anything malformed falls back to "no filter" rather
 * than an error page: a shared or hand-edited address always answers.
 */

const MODES = ["onsite", "hybrid", "remote"] as const;
const SORTS = ["recent", "rate_desc", "rate_asc"] as const;
const SINCE = [1, 7, 30] as const;
const MAX_EUROS = 100_000;
const DAY_MS = 86_400_000;

const optionalWhole = (max: number) =>
  z
    .string()
    .trim()
    .transform((raw) => (raw === "" ? null : /^\d{1,7}$/.test(raw) ? Number(raw) : Number.NaN))
    .pipe(z.number().int().min(0).max(max).nullable())
    .catch(null);

const QuerySchema = z.object({
  q: z.string().trim().max(200).catch(""),
  mode: z.array(z.string()).transform((modes) => [...new Set(modes.filter((m): m is (typeof MODES)[number] => (MODES as readonly string[]).includes(m)))]),
  skill: z.string().trim().max(60).catch(""),
  city: z.string().trim().max(120).catch(""),
  rateMin: optionalWhole(MAX_EUROS),
  rateMax: optionalWhole(MAX_EUROS),
  maxDuration: optionalWhole(600).pipe(z.number().int().min(1).nullable()).catch(null),
  since: z.coerce.number().pipe(z.union([z.literal(SINCE[0]), z.literal(SINCE[1]), z.literal(SINCE[2])])).nullable().catch(null),
  sort: z.enum(SORTS).catch("recent"),
  page: z.coerce.number().int().min(1).max(50).catch(1),
});

export interface MissionQuery {
  readonly filters: JobIndexFilters;
  readonly search: MissionSearch;
}

export const missionQuery = (params: URLSearchParams, now: Date): MissionQuery => {
  const raw = QuerySchema.parse({
    q: params.get("q") ?? "",
    mode: params.getAll("mode"),
    skill: params.get("competence") ?? "",
    city: params.get("ville") ?? "",
    rateMin: params.get("tjmMin") ?? "",
    rateMax: params.get("tjmMax") ?? "",
    maxDuration: params.get("dureeMax") ?? "",
    since: params.get("depuis") === null || params.get("depuis") === "" ? null : params.get("depuis"),
    sort: params.get("tri") ?? "recent",
    page: params.get("page") ?? "1",
  });
  const since: SinceDays | null = raw.since;
  const filters: JobIndexFilters = {
    q: raw.q,
    mode: raw.mode,
    skill: raw.skill,
    city: raw.city,
    rateMin: raw.rateMin,
    rateMax: raw.rateMax,
    maxDuration: raw.maxDuration,
    since,
    sort: raw.sort,
    page: raw.page,
  };
  const search: MissionSearch = {
    workModes: raw.mode,
    skills: raw.skill === "" ? [] : [raw.skill],
    sort: raw.sort,
    page: raw.page,
    ...(raw.q === "" ? {} : { q: raw.q }),
    ...(raw.city === "" ? {} : { city: raw.city }),
    ...(raw.rateMin === null ? {} : { minDailyRateCents: raw.rateMin * 100 }),
    ...(raw.rateMax === null ? {} : { maxDailyRateCents: raw.rateMax * 100 }),
    ...(raw.maxDuration === null ? {} : { maxDurationMonths: raw.maxDuration }),
    ...(since === null ? {} : { publishedAfter: new Date(now.getTime() - since * DAY_MS) }),
  };
  return { filters, search };
};
