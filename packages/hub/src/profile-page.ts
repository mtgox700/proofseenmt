import { FAVICON } from "./pages";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { marketHeader, MENU_STYLES } from "./market-shell";
import { EMPTY_SECTIONS, fileUrl, renderSections, SECTION_STYLES, sectionsJsonLd, type PublicSectionsView } from "./profile-sections";

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
  readonly availability: "available" | "available_from" | "unavailable";
  readonly availableFrom: Date | null;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly skills: readonly string[];
  readonly provenUrls: readonly string[];
  readonly provenUrlCount: number;
  readonly missions: readonly {
    readonly role: string;
    readonly clientKind: string;
    readonly durationMonths: number;
    readonly summary: string;
    readonly evidenceKind: string;
    readonly verifiedAt: Date;
    /** Nom du client, seulement s'il a lui-même autorisé son affichage en confirmant la mission. */
    readonly clientName?: string | null;
    /** Confirmation par l'entreprise inscrite, ou par un contact chez le client. */
    readonly confirmedBy?: "company" | "contact" | null;
  }[];
  readonly reviews: readonly { readonly rating: number; readonly body: string; readonly createdAt: Date }[];
  readonly facts: { readonly registryActiveCheckedAt: Date | null; readonly identityVerified: boolean; readonly payingClients: number; readonly vigilanceValidUntil: Date | null };
  /** Photo publiée : profil nominatif seulement (le dépôt ne la fournit jamais pour un profil pseudonyme). */
  readonly photoFileId?: string | null;
  /** Dernière déclaration ou confirmation de la disponibilité par le freelance. */
  readonly availabilityConfirmedAt?: Date | null;
  /** Expériences, formations, certifications, langues et réalisations déclarées. */
  readonly sections?: PublicSectionsView;
  readonly updatedAt: Date;
}

const LABELS = {
  fr: {
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    available: "Disponible",
    availableFrom: (d: string) => `Disponible à partir du ${d}`,
    unavailable: "Indisponible",
    rate: "TJM",
    notGiven: "Non affiché",
    perDay: "/ jour",
    skills: "Compétences",
    missions: "Missions vérifiées",
    months: (n: number) => (n === 1 ? "1 mois" : `${n} mois`),
    evidence: "Preuve",
    proofs: "Adresses dont la possession est prouvée",
    proofCount: (n: number) => (n === 0 ? "Aucune adresse prouvée pour l'instant." : n === 1 ? "1 adresse prouvée." : `${n} adresses prouvées.`),
    reviews: "Avis de missions payées sur Proofseen",
    facts: "Faits vérifiés",
    registryActive: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d})`,
    identityVerified: "Identité vérifiée par le prestataire de paiement",
    vigilance: (d: string) => `Attestation de vigilance URSSAF vérifiée, valable jusqu'au ${d}`,
    payingClients: (n: number) => (n === 1 ? "Payé sur Proofseen par 1 entreprise" : `Payé sur Proofseen par ${n} entreprises différentes`),
    contact: "Contacter ce freelance sur Proofseen",
    updated: "Mis à jour le",
    clientKinds: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Grand groupe", eti: "ETI", pme: "PME", secteur_public: "Secteur public", editeur_logiciel: "Éditeur de logiciel", esn: "ESN", association: "Association" },
    evidenceKinds: { facture: "Facture", contrat: "Contrat", attestation_client: "Attestation du client", acces_depot: "Accès au dépôt de code", livrable_public: "Livrable public" },
    verifiedOn: (kind: string, d: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? `Confirmée par un contact chez le client le ${d}` : `Confirmée par le client le ${d}`) : kind === "paid_on_platform" ? `Payée sur Proofseen, vérifiée le ${d}` : `Vérifiée le ${d}`,
    pseudonym: (ref: string) => `Freelance ${ref}`,
    confirmed: "Disponibilité confirmée le",
    photo: (name: string) => `Photo de ${name}`,
  },
  en: {
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    available: "Available",
    availableFrom: (d: string) => `Available from ${d}`,
    unavailable: "Unavailable",
    rate: "Day rate",
    notGiven: "Not shown",
    perDay: "/ day",
    skills: "Skills",
    missions: "Verified missions",
    months: (n: number) => (n === 1 ? "1 month" : `${n} months`),
    evidence: "Evidence",
    proofs: "Addresses with proven ownership",
    proofCount: (n: number) => (n === 0 ? "No proven address yet." : n === 1 ? "1 proven address." : `${n} proven addresses.`),
    reviews: "Reviews of missions paid on Proofseen",
    facts: "Verified facts",
    registryActive: (d: string) => `Business active in the official French company register (checked on ${d})`,
    identityVerified: "Identity verified by the payment provider",
    vigilance: (d: string) => `URSSAF vigilance certificate verified, valid until ${d}`,
    payingClients: (n: number) => (n === 1 ? "Paid on Proofseen by 1 company" : `Paid on Proofseen by ${n} different companies`),
    contact: "Contact this freelancer on Proofseen",
    updated: "Updated on",
    clientKinds: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Large group", eti: "Mid-size company", pme: "SME", secteur_public: "Public sector", editeur_logiciel: "Software publisher", esn: "IT services firm", association: "Non-profit" },
    evidenceKinds: { facture: "Invoice", contrat: "Contract", attestation_client: "Client attestation", acces_depot: "Repository access", livrable_public: "Public deliverable" },
    verifiedOn: (kind: string, d: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? `Confirmed by a contact at the client on ${d}` : `Confirmed by the client on ${d}`) : kind === "paid_on_platform" ? `Paid on Proofseen, verified on ${d}` : `Verified on ${d}`,
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    confirmed: "Availability confirmed on",
    photo: (name: string) => `Photo of ${name}`,
  },
} as const;

export const profileUrl = (baseUrl: string, lang: Lang, slug: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/profils/${slug}`;

const date = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

/** Le libellé d'une valeur de vocabulaire, ou la valeur elle-même si elle est inconnue (jamais une case vide). */
const pick = (table: Readonly<Record<string, string>>, key: string): string => table[key] ?? key;

/*
 * Une mission vérifiée : un fait daté, avec la façon dont il a été vérifié. Le client est désigné par son type, sauf
 * s'il a lui-même autorisé son nom en confirmant ; aucun résumé n'est inventé quand il n'y en a pas.
 */
const missionItem = (m: PublicProfile["missions"][number], lang: Lang): string => {
  const l = LABELS[lang];
  const client = m.clientName === undefined || m.clientName === null || m.clientName === "" ? pick(l.clientKinds, m.clientKind) : m.clientName;
  const how = m.evidenceKind in l.evidenceKinds ? ` · ${l.evidence} : ${e(pick(l.evidenceKinds, m.evidenceKind))}` : "";
  const summary = m.summary.trim() === "" ? "" : `<p>${e(m.summary)}</p>`;
  return `<li class="card"><h3>${e(m.role)}</h3><p class="when">${e(client)} · ${e(l.months(m.durationMonths))} · ${e(l.verifiedOn(m.evidenceKind, date(m.verifiedAt, lang), m.confirmedBy === "contact"))}${how}</p>${summary}</li>`;
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
    ...sectionsJsonLd(p.sections ?? EMPTY_SECTIONS, { lang: o.lang, baseUrl: o.baseUrl, photoFileId: p.visibility === "named" ? (p.photoFileId ?? null) : null }),
  },
});

export const renderProfilePage = (p: PublicProfile, o: { readonly baseUrl: string; readonly lang: Lang; readonly contactHref: string }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const name = profileName(p, o.lang);
  const availability =
    p.availability === "available" ? l.available : p.availability === "unavailable" ? l.unavailable : l.availableFrom(p.availableFrom === null ? "" : date(p.availableFrom, o.lang));
  const context = [
    [l.rate, p.dailyRateCents === null ? l.notGiven : `${money(p.dailyRateCents, p.currency, o.lang)} ${l.perDay}`],
    [o.lang === "fr" ? "Lieu" : "Location", `${p.city} · ${l.modes[p.workMode]}`],
    [o.lang === "fr" ? "Disponibilité" : "Availability", availability],
    ...(p.availabilityConfirmedAt === undefined || p.availabilityConfirmedAt === null ? [] : [[l.confirmed, date(p.availabilityConfirmedAt, o.lang)]]),
  ]
    .map(([dt, dd]) => `<div><dt>${e(dt ?? "")}</dt><dd>${e(dd ?? "")}</dd></div>`)
    .join("");
  const missions = p.missions.length === 0 ? "" : `<h2>${l.missions}</h2><ul class="missions">${p.missions.map((m) => missionItem(m, o.lang)).join("")}</ul>`;
  const proofs =
    p.provenUrls.length > 0
      ? `<h2>${l.proofs}</h2><ul class="links">${p.provenUrls.map((u) => `<li><a href="${e(u)}" rel="me noopener">${e(u)}</a></li>`).join("")}</ul>`
      : `<h2>${l.proofs}</h2><p class="muted">${e(l.proofCount(p.provenUrlCount))}</p>`;
  const factLines = [
    ...(p.facts.registryActiveCheckedAt === null ? [] : [l.registryActive(date(p.facts.registryActiveCheckedAt, o.lang))]),
    ...(p.facts.identityVerified ? [l.identityVerified] : []),
    ...(p.facts.vigilanceValidUntil === null ? [] : [l.vigilance(date(p.facts.vigilanceValidUntil, o.lang))]),
    ...(p.facts.payingClients === 0 ? [] : [l.payingClients(p.facts.payingClients)]),
  ];
  const photoId = p.visibility === "named" ? (p.photoFileId ?? null) : null;
  const photo = photoId === null ? "" : `<img class="avatar" src="${e(fileUrl(o.baseUrl, photoId))}" alt="${e(l.photo(name))}" width="120" height="120">`;
  const facts = factLines.length === 0 ? "" : `<h2>${l.facts}</h2><ul class="links">${factLines.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`;
  const reviews =
    p.reviews.length === 0
      ? ""
      : `<h2>${l.reviews}</h2><ul class="missions">${p.reviews
          .map((r) => `<li class="card"><p class="when">${r.rating} / 5 · ${e(date(r.createdAt, o.lang))}</p><p>${e(r.body)}</p></li>`)
          .join("")}</ul>`;

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${e(`${name} — ${p.headline}`)}</title>`,
    `<meta name="description" content="${e(`${p.headline} · ${p.city} · ${availability}`.slice(0, 160))}">`,
    `<link rel="canonical" href="${e(profileUrl(o.baseUrl, o.lang, p.slug))}">`,
    `<link rel="alternate" hreflang="fr" href="${e(profileUrl(o.baseUrl, "fr", p.slug))}">`,
    `<link rel="alternate" hreflang="en" href="${e(profileUrl(o.baseUrl, "en", p.slug))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(profileUrl(o.baseUrl, "fr", p.slug))}">`,
    `<style>${STYLES}${MENU_STYLES}${SECTION_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(profileJsonLd(p, o))}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, profileUrl(o.baseUrl, other, p.slug)),
    '<main class="wrap">',
    photo,
    `<h1 class="title">${e(name)}</h1>`,
    `<p class="headline">${e(p.headline)}</p>`,
    `<dl class="context">${context}</dl>`,
    `<p class="lede">${e(p.summary)}</p>`,
    facts,
    p.skills.length === 0 ? "" : `<h2>${l.skills}</h2><ul class="tags">${p.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    missions,
    renderSections(p.sections ?? EMPTY_SECTIONS, { lang: o.lang, baseUrl: o.baseUrl }),
    proofs,
    reviews,
    `<p><a class="cta" href="${e(o.contactHref)}">${l.contact}</a></p>`,
    `<p class="muted">${l.updated} ${e(date(p.updatedAt, o.lang))}</p>`,
    "</main>",
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
