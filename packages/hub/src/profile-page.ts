import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead } from "./head";
import { marketFooter, marketHeader } from "./market-shell";
import { nearbyProfilesSection, type NearbyProfile } from "./nearby";
import { EMPTY_SECTIONS, fileUrl, renderSections, SECTION_STYLES, sectionsJsonLd, type PublicSectionsView } from "./profile-sections";
import { recentPostsSection, type RecentPostItem } from "./post-page";
import { proofRegister, proofTally, type ProofFacts, type ProofMission, type ProofRegister, type ProvenAddress } from "./profile-proofs";
import { PROFILE_STYLES } from "./profile-styles";
import { PASSAGE_CSS, passageName } from "./profile-card";

/*
 * Page publique d'un profil freelance de la marketplace : document HTML complet, lisible sans JavaScript, avec ses
 * données structurées. C'est ce que lisent les moteurs de recherche et d'IA quand ils cherchent un freelance.
 *
 * Elle montre des faits vérifiés (missions prouvées, adresses dont la possession est prouvée, avis de missions payées)
 * et jamais une note globale, un rang ou un score : aucune « aggregateRating » dans les données structurées. Pour un
 * profil pseudonyme, aucun nom n'est inventé : la personne est désignée par sa référence publique.
 */

type Lang = "fr" | "en";

export interface PublicProfile {
  readonly reference: string;
  readonly slug: string;
  readonly visibility: "named" | "pseudonymous";
  readonly displayName: string | null;
  readonly headline: string;
  readonly summary: string;
  readonly city: string;
  readonly workMode: "onsite" | "hybrid" | "remote";
  /**
   * La disponibilité affichée. « unconfirmed » : déclarée il y a plus de 30 jours sans confirmation (règle de la base,
   * C23) ; la page le dit au lieu d'annoncer « disponible », et le profil reste publié.
   */
  readonly availability: "available" | "available_from" | "unavailable" | "unconfirmed";
  readonly availableFrom: Date | null;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly skills: readonly string[];
  readonly provenUrls: readonly string[];
  readonly provenUrlCount: number;
  /** La preuve de chaque adresse (méthode, date, dernière relecture) ; l'adresse elle-même seulement si nominatif. */
  readonly provenAddresses?: readonly ProvenAddress[];
  readonly missions: readonly ProofMission[];
  readonly reviews: readonly { readonly rating: number; readonly body: string; readonly createdAt: Date }[];
  readonly facts: ProofFacts;
  /** Photo publiée : profil nominatif seulement (le dépôt ne la fournit jamais pour un profil pseudonyme). */
  readonly photoFileId?: string | null;
  /** Dernière déclaration ou confirmation de la disponibilité par le freelance. */
  readonly availabilityConfirmedAt?: Date | null;
  /** Expériences, formations, certifications, langues et réalisations déclarées. */
  readonly sections?: PublicSectionsView;
  /** Publications publiques récentes du profil (C22). */
  readonly posts?: readonly RecentPostItem[];
  readonly updatedAt: Date;
}

const LABELS = {
  fr: {
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    available: "Disponible",
    availableFrom: (d: string) => `Disponible à partir du ${d}`,
    unavailable: "Indisponible",
    unconfirmed: "Disponibilité non confirmée",
    rate: "TJM",
    notGiven: "Non affiché",
    perDay: "/ jour",
    place: "Lieu",
    availability: "Disponibilité",
    skills: "Compétences",
    declared: "Déclaré par le freelance",
    declaredNote: "Rien de ce qui suit n'a été vérifié par un tiers.",
    reviews: "Avis de missions payées sur Proofseen",
    reviewTrace: "mission payée sur Proofseen",
    contact: "Contacter ce freelance sur Proofseen",
    updated: "Mis à jour le",
    reference: (ref: string, d: string) => `Profil ${ref} · mis à jour le ${d}`,
    rail: "Contact et preuves de ce profil",
    pseudonym: (ref: string) => `Freelance ${ref}`,
    confirmed: "Disponibilité confirmée le",
    lastConfirmed: "Dernière confirmation le",
    photo: (name: string) => `Photo de ${name}`,
  },
  en: {
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    available: "Available",
    availableFrom: (d: string) => `Available from ${d}`,
    unavailable: "Unavailable",
    unconfirmed: "Availability not confirmed",
    rate: "Day rate",
    notGiven: "Not shown",
    perDay: "/ day",
    place: "Location",
    availability: "Availability",
    skills: "Skills",
    declared: "Declared by the freelancer",
    declaredNote: "Nothing below has been checked by a third party.",
    reviews: "Reviews of missions paid on Proofseen",
    reviewTrace: "mission paid on Proofseen",
    contact: "Contact this freelancer on Proofseen",
    updated: "Updated on",
    reference: (ref: string, d: string) => `Profile ${ref} · updated on ${d}`,
    rail: "Contact and evidence of this profile",
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    confirmed: "Availability confirmed on",
    lastConfirmed: "Last confirmed on",
    photo: (name: string) => `Photo of ${name}`,
  },
} as const;

export const profileUrl = (baseUrl: string, lang: Lang, slug: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/profils/${slug}`;

const date = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

/** La disponibilité en toutes lettres ; jamais « disponible » pour une déclaration que la personne n'a pas reconfirmée. */
export const availabilityLabel = (p: Pick<PublicProfile, "availability" | "availableFrom">, lang: Lang): string => {
  const l = LABELS[lang];
  if (p.availability === "available") return l.available;
  if (p.availability === "unavailable") return l.unavailable;
  if (p.availability === "unconfirmed") return l.unconfirmed;
  return l.availableFrom(p.availableFrom === null ? "" : date(p.availableFrom, lang));
};

/** Le nom sous lequel la page désigne la personne : son nom si elle l'a choisi, sa référence sinon. */
export const profileName = (p: PublicProfile, lang: Lang): string => (p.visibility === "named" && p.displayName !== null ? p.displayName : LABELS[lang].pseudonym(p.reference));

export const profileJsonLd = (p: PublicProfile, o: { readonly baseUrl: string; readonly lang: Lang }): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  url: profileUrl(o.baseUrl, o.lang, p.slug),
  dateModified: p.updatedAt.toISOString(),
  mainEntity: {
    "@type": "Person",
    identifier: p.reference,
    name: profileName(p, o.lang),
    jobTitle: p.headline,
    description: p.summary,
    address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "FR" },
    ...(p.skills.length === 0 ? {} : { knowsAbout: [...p.skills] }),
    ...(p.provenUrls.length === 0 ? {} : { sameAs: [...p.provenUrls] }),
    ...sectionsJsonLd(p.sections ?? EMPTY_SECTIONS, { lang: o.lang, baseUrl: o.baseUrl, photoFileId: p.visibility === "named" ? (p.photoFileId ?? null) : null, named: p.visibility === "named" }),
  },
});

export interface ProfilePageOptions {
  readonly baseUrl: string;
  readonly lang: Lang;
  readonly contactHref: string;
  /** « Profils proches » (C22), rapprochés sur des faits, chacun avec sa raison. */
  readonly nearby?: readonly NearbyProfile[];
}

/*
 * La fiche, en-tête du dossier : la ligne de trace (référence et date), la photo d'identité d'un profil nominatif et
 * de lui seul, le nom (ou la référence), le métier, puis les faits déclarés du contexte, sans vert.
 */
const fiche = (p: PublicProfile, name: string, availability: string, o: ProfilePageOptions): string => {
  const l = LABELS[o.lang];
  const photoId = p.visibility === "named" ? (p.photoFileId ?? null) : null;
  const photo = photoId === null ? "" : `<img class="avatar" src="${e(fileUrl(o.baseUrl, photoId))}" alt="${e(l.photo(name))}" width="120" height="120">`;
  const confirmedLabel = p.availability === "unconfirmed" ? l.lastConfirmed : l.confirmed;
  const context = [
    [l.rate, p.dailyRateCents === null ? l.notGiven : `${money(p.dailyRateCents, p.currency, o.lang)} ${l.perDay}`],
    [l.place, `${p.city} · ${l.modes[p.workMode]}`],
    [l.availability, availability],
    ...(p.availabilityConfirmedAt === undefined || p.availabilityConfirmedAt === null ? [] : [[confirmedLabel, date(p.availabilityConfirmedAt, o.lang)]]),
  ]
    .map(([dt, dd]) => `<div><dt>${e(dt ?? "")}</dt><dd>${e(dd ?? "")}</dd></div>`)
    .join("");
  return (
    // M3 : la carte de l'annuaire porte le même nom de transition ; arrivée de l'annuaire, elle devient cette fiche.
    `<header class="fiche" style="view-transition-name:${passageName(p.slug)}"><p class="ref">${e(l.reference(p.reference, date(p.updatedAt, o.lang)))}</p>` +
    `<div class="who">${photo}<div><h1 class="title">${e(name)}</h1><p class="headline">${e(p.headline)}</p></div></div>` +
    `<dl class="context">${context}</dl></header>`
  );
};

/** Ce que le freelance déclare : un filet neutre, jamais de vert, et des titres un cran sous « Déclaré par le freelance ». */
const declared = (p: PublicProfile, o: ProfilePageOptions): string => {
  const l = LABELS[o.lang];
  const skills = p.skills.length === 0 ? "" : `<h3>${l.skills}</h3><ul class="tags">${p.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`;
  const sections = renderSections(p.sections ?? EMPTY_SECTIONS, { lang: o.lang, baseUrl: o.baseUrl, named: p.visibility === "named", level: 3 });
  if (skills === "" && sections === "") return "";
  return `<section class="declared" aria-labelledby="declare"><h2 class="part" id="declare">${l.declared}</h2><p class="part-note">${e(l.declaredNote)}</p>${skills}${sections}</section>`;
};

/** Les avis, un par un, sans moyenne. Le paiement est un fait, l'avis une opinion : aucun poinçon sur une note. */
const reviews = (p: PublicProfile, lang: Lang): string => {
  const l = LABELS[lang];
  if (p.reviews.length === 0) return "";
  const items = p.reviews.map((r) => `<li class="card"><p class="when">${r.rating} / 5 · ${e(date(r.createdAt, lang))} · ${l.reviewTrace}</p><p>${e(r.body)}</p></li>`).join("");
  return `<h2>${l.reviews}</h2><ul class="missions">${items}</ul>`;
};

export const renderProfilePage = (p: PublicProfile, o: ProfilePageOptions): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const name = profileName(p, o.lang);
  const availability = availabilityLabel(p, o.lang);
  const named = p.visibility === "named";
  const register: ProofRegister = { named, missions: p.missions, provenUrls: p.provenUrls, provenUrlCount: p.provenUrlCount, provenAddresses: p.provenAddresses ?? [], facts: p.facts };
  const contact = `<a class="cta" href="${e(o.contactHref)}">${l.contact}</a>`;

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: `${name} · ${p.headline}`, description: `${p.headline} · ${p.city} · ${availability}`.slice(0, 160), canonical: profileUrl(o.baseUrl, o.lang, p.slug), type: "profile" }),
    `<link rel="alternate" hreflang="fr" href="${e(profileUrl(o.baseUrl, "fr", p.slug))}">`,
    `<link rel="alternate" hreflang="en" href="${e(profileUrl(o.baseUrl, "en", p.slug))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(profileUrl(o.baseUrl, "fr", p.slug))}">`,
    `<style>${STYLES}${SECTION_STYLES}${PROFILE_STYLES}\n${PASSAGE_CSS}</style>`,
    `<script type="application/ld+json">${safeJsonLd(profileJsonLd(p, o))}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, profileUrl(o.baseUrl, other, p.slug)),
    '<main id="contenu" class="dossier">',
    fiche(p, name, availability, o),
    `<aside class="rail" aria-label="${e(l.rail)}">${contact}<a class="tally" href="#verifie">${e(proofTally(register, o.lang))}</a></aside>`,
    '<div class="folio">',
    `<p class="lede">${e(p.summary)}</p>`,
    proofRegister(register, o.lang),
    declared(p, o),
    reviews(p, o.lang),
    recentPostsSection(p.posts, o.lang),
    `<div class="closing">${contact}<p class="muted">${l.updated} ${e(date(p.updatedAt, o.lang))}</p></div>`,
    nearbyProfilesSection(o.nearby ?? [], o.lang),
    "</div>",
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

/** Sitemap des profils publiés, dans les deux langues. */
export const profileSitemap = (baseUrl: string, items: readonly { readonly slug: string; readonly updatedAt: Date }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) =>
      (["fr", "en"] as const).map((lang) => `<url><loc>${e(profileUrl(baseUrl, lang, item.slug))}</loc><lastmod>${item.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`),
    ),
    "</urlset>",
    "",
  ].join("\n");
