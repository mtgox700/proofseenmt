/*
 * The account settings' logic, kept pure so it can be tested without a session: the company a person acts for, the
 * typed confirmation that guards erasure, and how the erasure route's answer is read back to the person.
 */

/** Cookie holding the company the person chose to act for. A preference, never a grant: membership is re-checked. */
export const ORGANISATION_COOKIE = "ps_org";
export const ORGANISATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface Membership {
  readonly id: string;
  readonly role: string;
}

/**
 * The company the person acts for: the one they chose, if they still belong to it; else the first one they own; else
 * the first one they belong to. A chosen id they no longer belong to is ignored, never trusted.
 */
export const pickOrganisation = <T extends Membership>(mine: readonly T[], chosen: string | undefined): T | null =>
  mine.find((org) => chosen !== undefined && org.id === chosen) ?? mine.find((org) => org.role === "owner") ?? mine[0] ?? null;

/** The word to type before the account is erased, in the page's language. */
export const ERASE_WORDS = { fr: "SUPPRIMER", en: "DELETE" } as const;

/** Spaces around and letter case do not matter; the word itself does. */
export const confirmationMatches = (typed: string, lang: keyof typeof ERASE_WORDS): boolean => typed.trim().toUpperCase() === ERASE_WORDS[lang];

export type EraseOutcome = "erased" | "busy" | "throttled" | "signed_out" | "failed";

/** The erasure route's answer (`{ ok, data }` or `{ ok: false, error }`), as something the page can explain. */
export const eraseOutcome = (body: unknown): EraseOutcome => {
  if (typeof body !== "object" || body === null) return "failed";
  const answer = body as { readonly ok?: unknown; readonly error?: unknown };
  if (answer.ok === true) return "erased";
  switch (answer.error) {
    case "contrat en cours":
      return "busy";
    case "trop de demandes":
      return "throttled";
    case "non-connecté":
      return "signed_out";
    default:
      return "failed";
  }
};
