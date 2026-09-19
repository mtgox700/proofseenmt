import type { HubProfile, Locale } from "./schema";

const DATE_LOCALE: Readonly<Record<Locale, string>> = { fr: "fr-FR", en: "en-GB" };

/** Deterministic, timezone-independent date formatting ("15 octobre 2026"). */
export const formatDate = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(DATE_LOCALE[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export const formatMonth = (yyyyMm: string, locale: Locale): string =>
  new Intl.DateTimeFormat(DATE_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${yyyyMm}-01T00:00:00Z`));

export const LABELS = {
  fr: {
    available: "Disponible",
    availableFrom: (d: string) => `Disponible à partir du ${d}`,
    unavailable: "Indisponible pour le moment",
    updated: (d: string) => `Mis à jour le ${d}`,
    rate: (min: number, max: number) => `TJM : ${min} à ${max} € HT par jour`,
    about: "Profil",
    stack: "Compétences techniques",
    missions: "Missions",
    facts: "Faits vérifiables",
    source: "Source :",
    links: "Liens",
    contact: "Contact",
    client: "Contexte",
    period: "Période",
    role: "Rôle",
    ongoing: "aujourd'hui",
    back: "Retour au profil",
    otherMissions: "Autres missions",
    proof: (missions: number, facts: number) =>
      `${missions} mission${missions > 1 ? "s" : ""} · ${facts} fait${facts > 1 ? "s" : ""} vérifiable${facts > 1 ? "s" : ""}, chacun avec sa source`,
    otherLang: "English version",
  },
  en: {
    available: "Available",
    availableFrom: (d: string) => `Available from ${d}`,
    unavailable: "Not available at the moment",
    updated: (d: string) => `Updated on ${d}`,
    rate: (min: number, max: number) => `Day rate: €${min} to €${max} excl. VAT`,
    about: "Profile",
    stack: "Technical skills",
    missions: "Missions",
    facts: "Verifiable facts",
    source: "Source:",
    links: "Links",
    contact: "Contact",
    client: "Context",
    period: "Period",
    role: "Role",
    ongoing: "present",
    back: "Back to profile",
    otherMissions: "Other missions",
    proof: (missions: number, facts: number) =>
      `${missions} mission${missions > 1 ? "s" : ""} · ${facts} verifiable fact${facts > 1 ? "s" : ""}, each with its source`,
    otherLang: "Version française",
  },
} as const;

export const availabilityText = (profile: HubProfile, locale: Locale): string => {
  const l = LABELS[locale];
  const { status, from } = profile.availability;
  if (status === "available_from" && from !== null) return l.availableFrom(formatDate(from, locale));
  return status === "available" ? l.available : l.unavailable;
};
