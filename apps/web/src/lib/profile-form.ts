import { ProfileInputSchema, type ProfileInput } from "@proofseen/db";
import { eurosToCents, skillsOf } from "./mission-form";

/*
 * The profile form, as posted, turned into the repository's input. Like the mission form, this file only translates
 * (euros as typed, skills as one line, empty optional fields to null); the repository schema decides what is valid.
 */

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const orNull = (value: string): string | null => (value === "" ? null : value);

/** A calendar day from a date input, at midnight UTC; `null` when empty, an invalid date when unreadable. */
const day = (raw: string): Date | null => (raw === "" ? null : new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : "invalid"));

export const profileFromForm = (form: FormData): ReturnType<typeof ProfileInputSchema.safeParse> => {
  const availability = field(form, "availability") as ProfileInput["availability"];
  const input: ProfileInput = {
    headline: orNull(field(form, "headline")),
    summary: orNull(field(form, "summary")),
    city: orNull(field(form, "city")),
    workMode: field(form, "workMode") as ProfileInput["workMode"],
    dailyRateCents: eurosToCents(field(form, "rate")),
    availability,
    // The date only means something with « available from »: left filled in after switching away, it is dropped.
    availableFrom: availability === "available_from" ? day(field(form, "availableFrom")) : null,
    skills: skillsOf(field(form, "skills")),
  };
  return ProfileInputSchema.safeParse(input);
};
