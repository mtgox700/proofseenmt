import { en } from "./en";
import { fr } from "./fr";
import type { Dictionary, Locale } from "./types";

export const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { fr, en };
export const pathFor = (locale: Locale): string => (locale === "fr" ? "/" : "/en/");

/** Pre-sale stays closed until a lawyer validates the terms (US-P01). Flip only after validation. */
export const PRESALE_OPEN = false;
/** Contact address for companies (étage 2 test). null = CTA shown as "soon" until the founder sets it. */
export const CONTACT_EMAIL: string | null = null;

export type { Dictionary, Locale } from "./types";
