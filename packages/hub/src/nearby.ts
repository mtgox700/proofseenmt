import { escapeHtml as e } from "./html";
import { languageName } from "./profile-sections";

/*
 * « Missions proches » et « Profils proches » (C22) sur les pages publiques : des liens HTML simples, sans JavaScript,
 * les mêmes pour un robot et pour un navigateur. Chaque proposition dit pourquoi elle est là (compétences en commun,
 * même ville…) ; la règle d'ordre est écrite au-dessus de la liste. Aucun pourcentage, aucune note : des faits.
 *
 * Un profil pseudonyme est désigné par sa référence, jamais par un nom (l'appelant ne fournit `displayName` que pour un
 * profil nominatif).
 */

type Lang = "fr" | "en";
type WorkMode = "onsite" | "hybrid" | "remote";

/** Les raisons montrées en public : la similitude, jamais les preuves d'une personne. */
export type NearbyReason =
  | { readonly kind: "skills"; readonly shared: readonly string[] }
  /** Les libellés des familles d'intitulés, déjà traduits. */
  | { readonly kind: "job_title"; readonly labels: readonly string[] }
  | { readonly kind: "city"; readonly city: string }
  | { readonly kind: "work_mode"; readonly mode: WorkMode }
  | { readonly kind: "rate" }
  | { readonly kind: "languages"; readonly codes: readonly string[] };

export interface NearbyMission {
  readonly id: string;
  readonly title: string;
  readonly organisationName: string;
  readonly city: string | null;
  readonly workMode: WorkMode;
  readonly reasons: readonly NearbyReason[];
}

export interface NearbyProfile {
  readonly slug: string;
  readonly reference: string;
  readonly displayName?: string;
  readonly headline: string;
  readonly city: string;
  readonly workMode: WorkMode;
  readonly reasons: readonly NearbyReason[];
}

/** Au plus quatre compétences citées dans une raison, les autres comptées. */
const SHOWN_SKILLS = 4;

const LABELS = {
  fr: {
    missionsTitle: "Missions proches",
    profilesTitle: "Profils proches",
    missionsRule: "Rapprochées sur des faits : compétences, métier, ville, mode de travail, fourchette de TJM. Ordre : nombre de critères en commun, puis de compétences en commun, puis la mission la plus récente.",
    profilesRule: "Rapprochés sur des faits : compétences, métier, ville, mode de travail, TJM, langues. Ordre : nombre de critères en commun, puis de compétences en commun, puis le profil mis à jour le plus récemment.",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    skills: (n: number) => (n === 1 ? "1 compétence en commun" : `${n} compétences en commun`),
    more: (n: number) => `et ${n} autre${n > 1 ? "s" : ""}`,
    jobTitle: "même métier",
    city: "même ville",
    workMode: "mode de travail qui convient",
    missionRate: "fourchettes de TJM qui se recouvrent",
    profileRate: "TJM proche (moins d'un cinquième d'écart)",
    languages: (n: number) => (n === 1 ? "langue en commun" : "langues en commun"),
  },
  en: {
    missionsTitle: "Similar missions",
    profilesTitle: "Similar profiles",
    missionsRule: "Matched on facts: skills, job, city, work mode, day-rate range. Order: number of criteria in common, then of skills in common, then the most recent mission.",
    profilesRule: "Matched on facts: skills, job, city, work mode, day rate, languages. Order: number of criteria in common, then of skills in common, then the most recently updated profile.",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    skills: (n: number) => (n === 1 ? "1 skill in common" : `${n} skills in common`),
    more: (n: number) => `and ${n} more`,
    jobTitle: "same job",
    city: "same city",
    workMode: "work mode that fits",
    missionRate: "overlapping day-rate ranges",
    profileRate: "close day rate (less than a fifth apart)",
    languages: (n: number) => (n === 1 ? "language in common" : "languages in common"),
  },
} as const;

type Subject = "mission" | "profile";

const skillList = (shared: readonly string[], lang: Lang): string => {
  const shown = shared.slice(0, SHOWN_SKILLS).join(", ");
  return shared.length > SHOWN_SKILLS ? `${shown} ${LABELS[lang].more(shared.length - SHOWN_SKILLS)}` : shown;
};

/** Une raison en texte, pour l'écran comme pour un robot. */
export const nearbyReasonText = (r: NearbyReason, lang: Lang, subject: Subject): string => {
  const l = LABELS[lang];
  switch (r.kind) {
    case "skills":
      return `${l.skills(r.shared.length)} (${skillList(r.shared, lang)})`;
    case "job_title":
      return `${l.jobTitle} (${r.labels.join(", ")})`;
    case "city":
      return `${l.city} (${r.city})`;
    case "work_mode":
      return `${l.workMode} (${l.modes[r.mode]})`;
    case "rate":
      return subject === "mission" ? l.missionRate : l.profileRate;
    case "languages":
      return `${l.languages(r.codes.length)} (${r.codes.map((code) => languageName(code, lang)).join(", ")})`;
  }
};

const reasons = (items: readonly NearbyReason[], lang: Lang, subject: Subject): string =>
  items.length === 0 ? "" : `<p class="muted">${e(items.map((r) => nearbyReasonText(r, lang, subject)).join(" · "))}</p>`;

const place = (city: string | null, mode: WorkMode, lang: Lang): string => (mode === "remote" || city === null ? LABELS[lang].modes[mode] : `${city} · ${LABELS[lang].modes[mode]}`);

const section = (id: string, title: string, rule: string, cards: readonly string[]): string =>
  cards.length === 0 ? "" : `<section aria-labelledby="${id}"><h2 id="${id}">${e(title)}</h2><p class="muted">${e(rule)}</p><ul class="missions">${cards.join("")}</ul></section>`;

export const nearbyMissionsSection = (items: readonly NearbyMission[], lang: Lang): string =>
  section(
    "nearby-missions",
    LABELS[lang].missionsTitle,
    LABELS[lang].missionsRule,
    items.map(
      (m) =>
        `<li class="card"><h3><a href="${e(`/${lang}/missions/${encodeURIComponent(m.id)}`)}">${e(m.title)}</a></h3><p class="when">${e(`${m.organisationName} · ${place(m.city, m.workMode, lang)}`)}</p>${reasons(m.reasons, lang, "mission")}</li>`,
    ),
  );

export const nearbyProfilesSection = (items: readonly NearbyProfile[], lang: Lang): string =>
  section(
    "nearby-profiles",
    LABELS[lang].profilesTitle,
    LABELS[lang].profilesRule,
    items.map(
      (p) =>
        `<li class="card"><h3><a href="${e(`/${lang}/profils/${encodeURIComponent(p.slug)}`)}">${e(p.displayName ?? p.reference)}</a></h3><p class="when">${e(`${p.headline} · ${place(p.city, p.workMode, lang)}`)}</p>${reasons(p.reasons, lang, "profile")}</li>`,
    ),
  );
