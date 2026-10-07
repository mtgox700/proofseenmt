import { MissionInputSchema, type MissionInput } from "@proofseen/db";

/*
 * A mission form, as posted, turned into the repository's input. Euros are typed the way people type them ("650",
 * "650,50", "1 200"), skills as one comma-separated line; empty optional fields become null. The repository schema
 * then decides what is valid: this file only translates.
 */

const MAX_SKILLS = 30;

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** Euros as typed → cents; `null` when empty, `NaN` when unreadable (the schema then refuses it). */
export const eurosToCents = (raw: string): number | null => {
  const compact = raw.replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  if (compact === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(compact)) return Number.NaN;
  return Math.round(Number(compact) * 100);
};

const wholeOrNull = (raw: string): number | null => (raw === "" ? null : /^\d+$/.test(raw) ? Number(raw) : Number.NaN);

export const skillsOf = (raw: string): string[] =>
  [...new Set(raw.split(",").map((skill) => skill.trim()).filter((skill) => skill !== ""))].slice(0, MAX_SKILLS);

export const missionFromForm = (form: FormData): ReturnType<typeof MissionInputSchema.safeParse> => {
  const input: MissionInput = {
    title: field(form, "title"),
    description: field(form, "description"),
    skills: skillsOf(field(form, "skills")),
    durationMonths: wholeOrNull(field(form, "durationMonths")),
    dailyRateMinCents: eurosToCents(field(form, "rateMin")),
    dailyRateMaxCents: eurosToCents(field(form, "rateMax")),
    city: field(form, "city") === "" ? null : field(form, "city"),
    workMode: field(form, "workMode") as MissionInput["workMode"],
  };
  return MissionInputSchema.safeParse(input);
};

/** Cents → the value an edit form shows again: "650" for whole euros, "650.50" otherwise (both read back the same). */
export const centsToField = (cents: number | null): string => (cents === null ? "" : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
