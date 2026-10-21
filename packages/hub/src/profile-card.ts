import { monogram } from "./directory-cards";
import { escapeHtml as e } from "./html";
import { longDate, money, type Lang } from "./market-shell";
import { languageName } from "./profile-sections";

/*
 * La carte de profil, une seule définition (lot c, STORYBOARD c.3) : l'annuaire public la rend en HTML, la recherche
 * des entreprises (React) insère le même corps (`profileCardBody`) et y ajoute ses actions. Le CSS vit dans
 * @proofseen/brand (`PROFILE_CARD_CSS`, `profile-card.css`), le même pour les deux surfaces.
 *
 * Elle ne porte que des faits publics : la référence et la date de mise à jour (la ligne de trace), le nom et la photo
 * d'un profil nominatif seulement, le métier, la ville et le mode, le TJM s'il est affiché, la disponibilité déclarée
 * et sa date, les faits vérifiés (chacun sur un carré vert, avec son nombre), puis le déclaré (compétences, langues,
 * réalisations) au filet. Jamais une note, un score ni un rang.
 */

export type CardWorkMode = "onsite" | "hybrid" | "remote";
/** « unconfirmed » : déclarée il y a plus de 30 jours sans confirmation (règle de la base, C23), jamais « disponible ». */
export type CardAvailability = "available" | "available_from" | "unavailable" | "unconfirmed";

export interface ProfileCardView {
  /** Adresse publique du profil ; `null` : la carte n'a pas de lien (un profil sans adresse publique). */
  readonly slug: string | null;
  readonly reference: string;
  /** Profil nominatif seulement ; `null` pour un pseudonyme, qui n'a alors ni nom ni photo. */
  readonly displayName: string | null;
  /** Profil nominatif seulement : l'identifiant du fichier, servi par /fichiers/<id>. */
  readonly photoFileId?: string | null;
  readonly headline: string | null;
  readonly city: string | null;
  readonly workMode: CardWorkMode;
  readonly dailyRateCents?: number | null;
  readonly currency?: string;
  readonly availability?: CardAvailability;
  readonly availableFrom?: Date | null;
  readonly availabilityAt?: Date;
  readonly skills: readonly string[];
  readonly languages?: readonly { readonly code: string; readonly level: string }[];
  /** Le profil présente au moins une réalisation (déclarée). */
  readonly hasPortfolio?: boolean;
  readonly facts: {
    readonly registryActive: boolean;
    readonly identityVerified: boolean;
    readonly vigilanceValid: boolean;
    readonly verifiedMissions: number;
    readonly provenUrls?: number;
    readonly payingClients: number;
  };
  readonly updatedAt: Date;
}

export const MAX_CARD_TAGS = 6;

const LABELS = {
  fr: {
    trace: (ref: string, d: string) => `Profil ${ref} · mis à jour le ${d}`,
    pseudonym: (ref: string) => `Freelance ${ref}`,
    photo: (name: string) => `Photo de ${name}`,
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    perDay: "/ jour",
    available: "Disponible",
    from: (d: string) => `À partir du ${d}`,
    unavailable: "Indisponible",
    unconfirmed: "Disponibilité non confirmée",
    confirmed: (d: string) => `confirmée le ${d}`,
    lastConfirmed: (d: string) => `dernière confirmation le ${d}`,
    native: "langue maternelle",
    more: (n: number) => `+${n}`,
    portfolio: "Réalisations présentées sur le profil",
    see: "Voir le profil",
    noProof: "Pas encore de pièce vérifiée.",
    registry: "Entreprise active au répertoire officiel",
    identity: "Identité vérifiée par le prestataire de paiement",
    vigilance: "Attestation de vigilance URSSAF en cours de validité",
    missions: (n: number) => (n === 1 ? "1 mission vérifiée" : `${n} missions vérifiées`),
    provenUrls: (n: number) => (n === 1 ? "1 adresse web dont la possession est prouvée" : `${n} adresses web dont la possession est prouvée`),
    paying: (n: number) => (n === 1 ? "Payé sur Proofseen par 1 entreprise" : `Payé sur Proofseen par ${n} entreprises différentes`),
    legend: "Légende des cartes",
    legendProof: "vérifié par un tiers",
    legendDeclared: "déclaré par le freelance",
  },
  en: {
    trace: (ref: string, d: string) => `Profile ${ref} · updated on ${d}`,
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    photo: (name: string) => `Photo of ${name}`,
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    perDay: "/ day",
    available: "Available",
    from: (d: string) => `From ${d}`,
    unavailable: "Unavailable",
    unconfirmed: "Availability not confirmed",
    confirmed: (d: string) => `confirmed on ${d}`,
    lastConfirmed: (d: string) => `last confirmed on ${d}`,
    native: "native",
    more: (n: number) => `+${n}`,
    portfolio: "Work samples shown on the profile",
    see: "See the profile",
    noProof: "No verified document yet.",
    registry: "Business active in the official company register",
    identity: "Identity verified by the payment provider",
    vigilance: "Valid URSSAF vigilance certificate",
    missions: (n: number) => (n === 1 ? "1 verified mission" : `${n} verified missions`),
    provenUrls: (n: number) => (n === 1 ? "1 web address with proven ownership" : `${n} web addresses with proven ownership`),
    paying: (n: number) => (n === 1 ? "Paid on Proofseen by 1 company" : `Paid on Proofseen by ${n} different companies`),
    legend: "Card legend",
    legendProof: "verified by a third party",
    legendDeclared: "declared by the freelancer",
  },
} as const;

export type AvailabilityTone = "now" | "later" | "off" | "stale";

/** Ce que la carte affiche, champ par champ : la même source pour le HTML du hub et pour la parité testée avec React. */
export interface ProfileCardFields {
  readonly trace: string;
  readonly name: string;
  readonly href: string | null;
  readonly photo: { readonly src: string; readonly alt: string } | null;
  /** Monogramme décoratif quand il n'y a pas de photo : initiales d'un nom, ou deux signes de la référence. */
  readonly monogram: string;
  readonly headline: string | null;
  readonly context: readonly string[];
  readonly rate: string | null;
  readonly availability: { readonly state: string; readonly tone: AvailabilityTone; readonly when: string | null } | null;
  /** Les faits vérifiés, chacun nommé et compté ; vide : « pas encore de pièce vérifiée ». */
  readonly verified: readonly string[];
  readonly skills: readonly string[];
  readonly moreSkills: string | null;
  readonly languages: string | null;
  readonly portfolio: string | null;
}

const verifiedLines = (c: ProfileCardView, lang: Lang): readonly string[] => {
  const l = LABELS[lang];
  const proven = c.facts.provenUrls ?? 0;
  return [
    ...(c.facts.verifiedMissions === 0 ? [] : [l.missions(c.facts.verifiedMissions)]),
    ...(proven === 0 ? [] : [l.provenUrls(proven)]),
    ...(c.facts.registryActive ? [l.registry] : []),
    ...(c.facts.vigilanceValid ? [l.vigilance] : []),
    ...(c.facts.identityVerified ? [l.identity] : []),
    ...(c.facts.payingClients === 0 ? [] : [l.paying(c.facts.payingClients)]),
  ];
};

const availabilityOf = (c: ProfileCardView, lang: Lang): ProfileCardFields["availability"] => {
  const l = LABELS[lang];
  if (c.availability === undefined) return null;
  const stale = c.availability === "unconfirmed";
  const state = stale
    ? l.unconfirmed
    : c.availability === "available"
      ? l.available
      : c.availability === "available_from" && c.availableFrom != null
        ? l.from(longDate(c.availableFrom, lang))
        : l.unavailable;
  const tone: AvailabilityTone = stale ? "stale" : c.availability === "available" ? "now" : c.availability === "available_from" ? "later" : "off";
  const day = c.availabilityAt === undefined ? null : longDate(c.availabilityAt, lang);
  return { state, tone, when: day === null ? null : stale ? l.lastConfirmed(day) : l.confirmed(day) };
};

const levelText = (level: string, lang: Lang): string => (level === "native" ? LABELS[lang].native : level.toUpperCase());

export const profileCardFields = (c: ProfileCardView, lang: Lang): ProfileCardFields => {
  const l = LABELS[lang];
  const name = c.displayName ?? l.pseudonym(c.reference);
  // Une photo ne sort que pour un profil nominatif, même si la vue en portait une par erreur.
  const photo = c.displayName !== null && c.photoFileId != null ? { src: `/fichiers/${encodeURIComponent(c.photoFileId)}`, alt: l.photo(c.displayName) } : null;
  const skills = c.skills.slice(0, MAX_CARD_TAGS);
  const hidden = c.skills.length - skills.length;
  const languages = (c.languages ?? []).map((x) => `${languageName(x.code, lang)} (${levelText(x.level, lang)})`);
  return {
    trace: l.trace(c.reference, longDate(c.updatedAt, lang)),
    name,
    href: c.slug === null ? null : `/${lang}/profils/${c.slug}`,
    photo,
    monogram: monogram(c.reference, c.displayName),
    headline: c.headline,
    context: [c.city, l.modes[c.workMode]].filter((x): x is string => x !== null && x !== ""),
    rate: c.dailyRateCents == null ? null : money(c.dailyRateCents, c.currency ?? "EUR", lang),
    availability: availabilityOf(c, lang),
    verified: verifiedLines(c, lang),
    skills,
    moreSkills: hidden > 0 ? l.more(hidden) : null,
    languages: languages.length === 0 ? null : languages.join(" · "),
    portfolio: c.hasPortfolio === true ? l.portfolio : null,
  };
};

const avatarHtml = (f: ProfileCardFields): string =>
  f.photo === null
    ? `<span class="fc-avatar" aria-hidden="true">${e(f.monogram)}</span>`
    : `<img class="fc-avatar" src="${e(f.photo.src)}" width="56" height="56" alt="${e(f.photo.alt)}" loading="lazy" decoding="async">`;

const registerHtml = (f: ProfileCardFields, lang: Lang): string =>
  f.verified.length === 0 ? `<p class="fc-none">${LABELS[lang].noProof}</p>` : `<ul class="fc-proof">${f.verified.map((v) => `<li>${e(v)}</li>`).join("")}</ul>`;

const declaredHtml = (f: ProfileCardFields): string => {
  const tags = f.skills.length === 0 ? "" : `<ul class="fc-tags">${f.skills.map((s) => `<li>${e(s)}</li>`).join("")}${f.moreSkills === null ? "" : `<li class="plus">${e(f.moreSkills)}</li>`}</ul>`;
  const lines = [f.languages, f.portfolio].flatMap((x) => (x === null ? [] : [`<p class="fc-langs">${e(x)}</p>`])).join("");
  return tags === "" && lines === "" ? "" : `<div class="fc-decl">${tags}${lines}</div>`;
};

/**
 * Le corps de la carte, sans son enveloppe : l'annuaire l'entoure d'un `<article>` et d'un pied, la recherche React
 * d'un `<article>` et de ses actions. `headingId` relie l'article à son titre.
 */
export const profileCardBody = (c: ProfileCardView, lang: Lang, headingId: string): string => {
  const f = profileCardFields(c, lang);
  const l = LABELS[lang];
  const name = f.href === null ? e(f.name) : `<a href="${e(f.href)}">${e(f.name)}</a>`;
  const rate = f.rate === null ? "" : `<span><b>${e(f.rate)}</b> ${l.perDay}</span>`;
  const avail = f.availability === null ? "" : `<p class="fc-avail"><span class="fc-state ${f.availability.tone}">${e(f.availability.state)}</span>${f.availability.when === null ? "" : ` <span>· ${e(f.availability.when)}</span>`}</p>`;
  return (
    `<p class="fc-trace">${e(f.trace)}</p>` +
    `<div class="fc-id">${avatarHtml(f)}<div><h3 class="fc-name" id="${e(headingId)}">${name}</h3>${f.headline === null ? "" : `<p class="fc-role">${e(f.headline)}</p>`}</div></div>` +
    `<p class="fc-ctx"><span>${e(f.context.join(" · "))}</span>${rate}</p>` +
    avail +
    registerHtml(f, lang) +
    declaredHtml(f)
  );
};

/** Le nom de transition partagé par une carte de l'annuaire et l'en-tête de la page du profil (M3, le passage au guichet). */
export const passageName = (slug: string): string => `pf-${slug.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;

/**
 * M3, « le passage au guichet » (STORYBOARD c.6) : entre deux documents qui l'acceptent tous deux (l'annuaire et le
 * profil), la carte devient l'en-tête du dossier. CSS seul, aucun script ; jamais en mouvement réduit. Sans support,
 * la navigation reste une navigation.
 */
export const PASSAGE_CSS =
  "@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}" +
  "::view-transition-group(*){animation-duration:var(--ps-dur-reveal);animation-timing-function:var(--ps-ease-ink)}}";

/** La carte complète de l'annuaire public : l'article, son nom de transition, le corps partagé, le pied. */
export const profileCardHtml = (c: ProfileCardView & { readonly slug: string }, lang: Lang): string => {
  const id = `p-${c.slug}`;
  return (
    `<article class="fiche-card" aria-labelledby="${e(id)}" style="view-transition-name:${passageName(c.slug)}">` +
    profileCardBody(c, lang, id) +
    `<p class="fc-foot"><a class="fc-go" href="/${lang}/profils/${e(c.slug)}" aria-hidden="true" tabindex="-1">${LABELS[lang].see} →</a></p>` +
    `</article>`
  );
};

/**
 * La clé de lecture des cartes : le carré vert pour ce qu'un tiers a vérifié, le carré au filet pour le déclaré.
 * `proof: false` (revue Kensa, M5) : aucune carte affichée ne porte de fait vérifié, la clé n'a donc pas de vert.
 */
export const profileCardLegend = (lang: Lang, o: { readonly proof?: boolean } = {}): string => {
  const l = LABELS[lang];
  const proof = o.proof === false ? "" : `<li class="k-proof">${l.legendProof}</li>`;
  return `<ul class="ps-legend" aria-label="${e(l.legend)}">${proof}<li class="k-decl">${l.legendDeclared}</li></ul>`;
};

/** Au moins une de ces cartes porte un fait vérifié (et donc un carré vert). */
export const anyVerifiedCard = (cards: readonly ProfileCardView[]): boolean => cards.some((c) => verifiedLines(c, "fr").length > 0);
