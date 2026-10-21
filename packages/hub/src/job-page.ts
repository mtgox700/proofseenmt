import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead } from "./head";
import { marketFooter, marketHeader } from "./market-shell";
import { jobPosting, missionUrl, type PublicMission } from "./job-posting";
import { cityUrl } from "./city-page";
import { nearbyMissionsSection, type NearbyMission } from "./nearby";

/*
 * Page publique d'une mission de la marketplace : un document HTML complet, lisible sans JavaScript, avec ses données
 * structurées `JobPosting`. C'est ce qu'un moteur de recherche ou d'IA lit d'une offre ; un humain y lit la même chose.
 *
 * Rien de privé n'y entre : ni l'auteur de la mission, ni ses candidats, ni de coordonnées (la mission en est
 * débarrassée avant publication). On postule par la plateforme, jamais par un lien sortant.
 */

type Lang = "fr" | "en";

const LABELS = {
  fr: {
    back: "Toutes les missions",
    rate: "TJM",
    duration: "Durée",
    location: "Lieu",
    remote: "Télétravail",
    hybrid: "Hybride",
    onsite: "Sur site",
    months: (n: number) => (n === 1 ? "1 mois" : `${n} mois`),
    notGiven: "Non précisé",
    skills: "Compétences",
    published: "Publiée le",
    registryActive: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d})`,
    response: (days: number, decided: number) => `Répond aux candidatures en ${days} jour${days > 1 ? "s" : ""} (médiane sur ${decided} candidatures, six derniers mois)`,
    apply: "Postuler sur Proofseen",
    perDay: "/ jour",
  },
  en: {
    back: "All missions",
    rate: "Day rate",
    duration: "Duration",
    location: "Location",
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "On site",
    months: (n: number) => (n === 1 ? "1 month" : `${n} months`),
    notGiven: "Not specified",
    skills: "Skills",
    published: "Published on",
    registryActive: (d: string) => `Business active in the official French company register (checked on ${d})`,
    response: (days: number, decided: number) => `Answers applications within ${days} day${days > 1 ? "s" : ""} (median over ${decided} applications, last six months)`,
    apply: "Apply on Proofseen",
    perDay: "/ day",
  },
} as const;

const OTHER: Readonly<Record<Lang, Lang>> = { fr: "en", en: "fr" };

const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export const rateText = (m: PublicMission, lang: Lang): string => {
  const l = LABELS[lang];
  const { dailyRateMinCents: min, dailyRateMaxCents: max } = m;
  if (min === null && max === null) return l.notGiven;
  if (min !== null && max !== null && min !== max) return `${money(min, m.currency, lang)} – ${money(max, m.currency, lang)} ${l.perDay}`;
  return `${money(min ?? max ?? 0, m.currency, lang)} ${l.perDay}`;
};

const locationText = (m: PublicMission, lang: Lang): string => {
  const mode = LABELS[lang][m.workMode];
  return m.workMode === "remote" || m.city === null ? mode : `${m.city} · ${mode}`;
};

/** Le texte libre de l'entreprise, en paragraphes : une ligne vide sépare deux paragraphes, rien d'autre n'est interprété. */
const paragraphs = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => `<p class="lede">${e(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

export interface JobPageOptions {
  readonly baseUrl: string;
  readonly lang: Lang;
  /** Où mène « Postuler » : la page de la plateforme qui prend la candidature. */
  readonly applyHref: string;
  /** « Missions proches » (C22) : rapprochées sur des faits, chacune avec sa raison. */
  readonly nearby?: readonly NearbyMission[];
}

export const renderJobPage = (m: PublicMission, o: JobPageOptions): string => {
  const l = LABELS[o.lang];
  const url = (lang: Lang) => missionUrl(o.baseUrl, lang, m.id);
  const other = OTHER[o.lang];
  const description = `${m.title} · ${locationText(m, o.lang)} · ${rateText(m, o.lang)}`;
  const context = [
    [l.rate, rateText(m, o.lang)],
    [l.duration, m.durationMonths === null ? l.notGiven : l.months(m.durationMonths)],
    [l.location, locationText(m, o.lang)],
  ]
    .map(([dt, dd]) => `<div><dt>${e(dt ?? "")}</dt><dd>${e(dd ?? "")}</dd></div>`)
    .join("");
  const longDate = (d: Date): string => new Intl.DateTimeFormat(o.lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);
  const published = longDate(m.publishedAt);
  // Un fait vérifié sur l'entreprise, daté ; absent tant que le répertoire n'a pas confirmé.
  const registry = m.organisationRegistryActiveCheckedAt == null ? "" : `<p class="muted">${e(l.registryActive(longDate(m.organisationRegistryActiveCheckedAt)))}</p>`;
  const response = m.organisationResponse == null ? "" : `<p class="muted">${e(l.response(m.organisationResponse.medianDays, m.organisationResponse.decided))}</p>`;

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: `${m.title} · ${m.organisationName}`, description: description.slice(0, 160), canonical: url(o.lang) }),
    `<link rel="alternate" hreflang="fr" href="${e(url("fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(url("en"))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(url("fr"))}">`,
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jobPosting(m, { baseUrl: o.baseUrl, lang: o.lang }))}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, url(other)),
    '<main id="contenu" class="wrap">',
    `<a class="crumb" href="/${o.lang}/missions">← ${l.back}</a>`,
    `<h1 class="title">${e(m.title)}</h1>`,
    `<p class="byline">${m.organisationSlug == null ? e(m.organisationName) : `<a href="${e(`/${o.lang}/entreprises/${encodeURIComponent(m.organisationSlug)}`)}">${e(m.organisationName)}</a>`} · ${l.published} ${e(published)}</p>`,
    registry,
    response,
    `<dl class="context">${context}</dl>`,
    paragraphs(m.description),
    m.skills.length === 0 ? "" : `<h2>${l.skills}</h2><ul class="tags">${m.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    `<p><a class="cta" href="${e(o.applyHref)}">${l.apply}</a></p>`,
    nearbyMissionsSection(o.nearby ?? [], o.lang),
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

/** Sitemap des missions ouvertes, dans les deux langues. */
export const jobSitemap = (
  baseUrl: string,
  items: readonly { readonly id: string; readonly publishedAt: Date }[],
  /** Les pages par ville qui existent (assez de missions ouvertes). */
  cities: readonly { readonly key: string }[] = [],
): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) =>
      (["fr", "en"] as const).map(
        (lang) => `<url><loc>${e(missionUrl(baseUrl, lang, item.id))}</loc><lastmod>${item.publishedAt.toISOString().slice(0, 10)}</lastmod></url>`,
      ),
    ),
    ...cities.flatMap((city) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(cityUrl(baseUrl, lang, city.key))}</loc></url>`)),
    "</urlset>",
    "",
  ].join("\n");
