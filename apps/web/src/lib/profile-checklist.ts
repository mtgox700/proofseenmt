import type { ProfileFacts, RegistryView, VigilanceStatus } from "@proofseen/db";
import { MIN_SKILLS, MIN_SUMMARY_CHARS } from "@proofseen/profiles";

/*
 * The facts an AI engine needs to read on a public profile, each one done or missing, and where to fix it. This is a
 * list of facts, never a score: no percentage, no grade, no ranking of the person (AI Act). The thresholds are the
 * ones the public pages already apply to decide a profile is not thin content (`@proofseen/profiles`).
 */

export const CHECKLIST_KEYS = ["published", "headline", "summary", "skills", "city", "workMode", "dailyRate", "availability", "provenAddress", "siret", "vigilance"] as const;

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** What is on the page the engines read, and what proves it. */
export type ChecklistGroup = "page" | "proof";

/** Why an item is not done although something was entered: the person needs a different action than "fill it in". */
export type ChecklistNote = "too_short" | "too_few" | "date_passed" | "awaiting_check" | "registry_problem" | "expired" | "awaiting_operator";

export interface ChecklistItem {
  readonly key: ChecklistKey;
  readonly group: ChecklistGroup;
  readonly done: boolean;
  readonly note: ChecklistNote | null;
  /** The exact page, and field when there is one, where the person fixes it. */
  readonly href: string;
}

export interface Checklist {
  readonly items: readonly ChecklistItem[];
  /** How many items are not done: a count of facts, not a quality measure. */
  readonly missing: number;
}

export type ChecklistProfile = Pick<
  ProfileFacts,
  "visibility" | "headline" | "summary" | "skills" | "city" | "workMode" | "dailyRateCents" | "availability" | "availableFrom" | "verifiedUrls"
>;

export interface ChecklistInput {
  readonly lang: string;
  /** `null` when the person has not created a profile yet: everything is missing. */
  readonly profile: ChecklistProfile | null;
  /** The billing identity, `null` until it is filled in. */
  readonly billing: { readonly siret: string | null; readonly registry: RegistryView } | null;
  /** The URSSAF certificate, `null` without a profile. */
  readonly vigilance: Pick<VigilanceStatus, "state" | "verified"> | null;
  readonly now: Date;
}

export { MIN_SKILLS, MIN_SUMMARY_CHARS };

interface Check {
  readonly done: boolean;
  readonly note: ChecklistNote | null;
}

const check = (done: boolean, note: ChecklistNote | null = null): Check => ({ done, note: done ? null : note });

const isoDay = (instant: Date): string => instant.toISOString().slice(0, 10);

const GROUPS: Readonly<Record<ChecklistKey, ChecklistGroup>> = {
  published: "page",
  headline: "page",
  summary: "page",
  skills: "page",
  city: "page",
  workMode: "page",
  dailyRate: "page",
  availability: "page",
  provenAddress: "proof",
  siret: "proof",
  vigilance: "proof",
};

/** Where each fact is fixed: the ids are the ones of the profile form, the billing form and the vigilance section. */
const TARGETS: Readonly<Record<ChecklistKey, string>> = {
  published: "profil#publication-title",
  headline: "profil#headline",
  summary: "profil#summary",
  skills: "profil#skills",
  city: "profil#city",
  workMode: "profil#workMode",
  dailyRate: "profil#rate",
  availability: "profil#availability",
  provenAddress: "preuves",
  siret: "facturation#siret",
  vigilance: "facturation#vigilance-title",
};

const profileChecks = (p: ChecklistProfile, now: Date): Record<Exclude<ChecklistKey, "siret" | "vigilance">, Check> => ({
  published: check(p.visibility !== "private"),
  headline: check(p.headline !== null && p.headline.trim() !== ""),
  summary: check(p.summary !== null && p.summary.trim().length >= MIN_SUMMARY_CHARS, p.summary === null || p.summary.trim() === "" ? null : "too_short"),
  skills: check(p.skills.length >= MIN_SKILLS, p.skills.length === 0 ? null : "too_few"),
  city: check(p.city !== null && p.city.trim() !== ""),
  workMode: check(true),
  dailyRate: check(p.dailyRateCents !== null),
  // "Available from" a day already gone tells the engines something false: the date has to be moved or removed.
  availability: check(!(p.availability === "available_from" && p.availableFrom !== null && isoDay(p.availableFrom) < isoDay(now)), "date_passed"),
  provenAddress: check(p.verifiedUrls >= 1),
});

const siretCheck = (billing: ChecklistInput["billing"]): Check => {
  if (billing === null || billing.siret === null) return check(false);
  if (billing.registry.status === null) return check(false, "awaiting_check");
  return check(billing.registry.status === "active", "registry_problem");
};

const vigilanceCheck = (vigilance: ChecklistInput["vigilance"]): Check => {
  if (vigilance === null || vigilance.state === "missing") return check(false);
  if (vigilance.state === "expired") return check(false, "expired");
  return check(vigilance.verified, "awaiting_operator");
};

const MISSING: Check = { done: false, note: null };

export const profileChecklist = (input: ChecklistInput): Checklist => {
  const checks: Record<ChecklistKey, Check> =
    input.profile === null
      ? (Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, MISSING])) as Record<ChecklistKey, Check>)
      : { ...profileChecks(input.profile, input.now), siret: siretCheck(input.billing), vigilance: vigilanceCheck(input.vigilance) };
  const items = CHECKLIST_KEYS.map((key) => ({ key, group: GROUPS[key], ...checks[key], href: `/${input.lang}/app/${TARGETS[key]}` }));
  return { items, missing: items.filter((item) => !item.done).length };
};
