import { en } from "./en";
import { fr } from "./fr";
import type { Dictionary, Locale } from "./types";

export const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { fr, en };
export const pathFor = (locale: Locale): string => (locale === "fr" ? "/" : "/en/");

/** Pre-sale stays closed until a lawyer validates the terms (US-P01). Flip only after validation. */
export const PRESALE_OPEN = false;

/**
 * Dates contractuelles de la pré-vente (CGV articles 9 et 10). Définies **une seule fois** : recopiées dans les deux
 * traductions, elles finiraient par diverger, et une date de livraison qui diffère entre le français et l'anglais est
 * une clause contradictoire dans un contrat de vente à distance.
 */
export const PRESALE_DATES = {
  /** Décision de lancer le service, ou remboursement intégral. */
  gate: { fr: "27 novembre 2026", en: "27 November 2026" },
  /** Livraison au plus tard, sinon remboursement intégral et automatique. */
  delivery: { fr: "31 décembre 2026", en: "31 December 2026" },
  withdrawalDays: 14,
} as const;
/** Contact address for companies (étage 2 test). null = CTA shown as "soon" until the founder sets it. */
export const CONTACT_EMAIL: string | null = null;

export type { Dictionary, Locale } from "./types";
