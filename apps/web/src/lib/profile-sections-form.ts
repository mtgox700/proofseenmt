import type { CertificationInput, EducationInput, ExperienceInput, LanguageInput, PortfolioInput } from "@proofseen/db";
import { skillsOf } from "./mission-form";

/*
 * The forms of the rich profile sections, as posted, turned into repository inputs. Like the profile form, this file
 * only translates (empty optional fields to null, a month to its first day, a year to a number); the repository
 * schemas decide what is valid, and an unreadable value becomes something they refuse rather than a silent default.
 */

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const orNull = (value: string): string | null => (value === "" ? null : value);

/*
 * A month as `YYYY-MM` (the month input), or `MM/YYYY` as typed where the browser shows a plain text field; the first
 * day of that month at midnight UTC. `null` when empty, an invalid date when unreadable.
 */
export const monthOf = (raw: string): Date | null => {
  if (raw === "") return null;
  const iso = /^(\d{4})-(\d{2})$/.exec(raw);
  const typed = /^(\d{1,2})\/(\d{4})$/.exec(raw);
  const [year, month] = iso !== null ? [iso[1], iso[2]] : typed !== null ? [typed[2], typed[1]?.padStart(2, "0")] : [undefined, undefined];
  if (year === undefined || month === undefined || Number(month) < 1 || Number(month) > 12) return new Date(Number.NaN);
  return new Date(`${year}-${month}-01T00:00:00Z`);
};

/** A year as typed; `null` when empty, `NaN` when unreadable (refused by the schema). */
export const yearOf = (raw: string): number | null => (raw === "" ? null : /^\d{4}$/.test(raw) ? Number(raw) : Number.NaN);

/** A month field, for a month input's value: `YYYY-MM`. */
export const monthField = (d: Date | null): string => (d === null ? "" : d.toISOString().slice(0, 7));

export const experienceFromForm = (form: FormData): ExperienceInput => {
  const current = form.get("current") === "1";
  return {
    title: field(form, "title"),
    company: orNull(field(form, "company")),
    companyHidden: form.get("companyHidden") === "1",
    startMonth: monthOf(field(form, "startMonth")) ?? new Date(Number.NaN),
    // « Ongoing » wins over an end month left filled in.
    endMonth: current ? null : monthOf(field(form, "endMonth")),
    description: orNull(field(form, "description")),
    skills: skillsOf(field(form, "skills")),
  };
};

export const educationFromForm = (form: FormData): EducationInput => ({
  school: field(form, "school"),
  degree: orNull(field(form, "degree")),
  startYear: yearOf(field(form, "startYear")),
  endYear: yearOf(field(form, "endYear")),
});

export const certificationFromForm = (form: FormData): CertificationInput => ({
  name: field(form, "name"),
  issuer: orNull(field(form, "issuer")),
  year: yearOf(field(form, "year")),
  credentialUrl: orNull(field(form, "credentialUrl")),
  skills: skillsOf(field(form, "skills")),
});

export const languageFromForm = (form: FormData): LanguageInput => ({
  code: field(form, "code") as LanguageInput["code"],
  level: field(form, "level") as LanguageInput["level"],
});

export const portfolioFromForm = (form: FormData): PortfolioInput => ({
  title: field(form, "title"),
  url: field(form, "url"),
  description: orNull(field(form, "description")),
});
