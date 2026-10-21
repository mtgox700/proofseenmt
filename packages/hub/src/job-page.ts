import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead } from "./head";
import { marketFooter, marketHeader } from "./market-shell";
import { jobPosting, missionUrl, type PublicMission } from "./job-posting";
import { cityUrl } from "./city-page";
import { nearbyMissionsSection, type NearbyMission } from "./nearby";
import { factLine, LEDGER_STYLES } from "./ledger";
import { typeset } from "./typography";

/*
 * Page publique d'une mission de la marketplace : un document HTML complet, lisible sans JavaScript, avec ses données
 * structurées `JobPosting`. C'est ce qu'un moteur de recherche ou d'IA lit d'une offre ; un humain y lit la même chose.
 *
 * Hiérarchie (lot e de la refonte) : la ligne de trace (mission ouverte, date de publication), l'intitulé, l'entreprise
 * et son état au répertoire officiel, le contexte (TJM, durée, lieu), puis « Postuler » dans un rail à droite sur grand
 * écran, sous le contexte sur un téléphone, et répété en fin de page. Le vert ne touche que le fait vérifié par un
 * tiers : l'entreprise active au répertoire officiel, datée. Le délai de réponse est mesuré sur Proofseen, la
 * description est rédigée par l'entreprise : ni l'un ni l'autre n'est vert.
 *
 * Rien de privé n'y entre : ni l'auteur de la mission, ni ses candidats, ni de coordonnées (la mission en est
 * débarrassée avant publication). On postule par la plateforme, jamais par un lien sortant.
 */

type Lang = "fr" | "en";

const LABELS = {
  fr: {
    back: "Toutes les missions",
    trace: (d: string) => `Mission ouverte · publiée le ${d}`,
    rate: "TJM",
    duration: "Durée",
    location: "Lieu",
    remote: "Télétravail",
    hybrid: "Hybride",
    onsite: "Sur site",
    months: (n: number) => (n === 1 ? "1 mois" : `${n} mois`),
    notGiven: "Non précisé",
    by: "Proposée par",
    about: "La mission",
    declared: "Texte rédigé par l'entreprise.",
    skills: "Compétences demandées",
    company: "L'entreprise",
    companyPage: "Voir la page de l'entreprise",
    published: "Publiée le",
    registryActive: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d})`,
    registryUnknown: "Activité au répertoire officiel des entreprises non confirmée",
    response: (days: number, decided: number) => `Répond aux candidatures en ${days} jour${days > 1 ? "s" : ""} (médiane sur ${decided} candidatures, six derniers mois)`,
    apply: "Postuler sur Proofseen",
    applyNote: "La candidature et la conversation restent sur Proofseen : aucune coordonnée n'est échangée avant votre accord.",
    rail: "Candidature",
    perDay: "/ jour",
  },
  en: {
    back: "All missions",
    trace: (d: string) => `Open mission · published on ${d}`,
    rate: "Day rate",
    duration: "Duration",
    location: "Location",
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "On site",
    months: (n: number) => (n === 1 ? "1 month" : `${n} months`),
    notGiven: "Not specified",
    by: "Posted by",
    about: "The mission",
    declared: "Text written by the company.",
    skills: "Skills requested",
    company: "The company",
    companyPage: "See the company page",
    published: "Published on",
    registryActive: (d: string) => `Business active in the official French company register (checked on ${d})`,
    registryUnknown: "Not confirmed as active in the official French company register",
    response: (days: number, decided: number) => `Answers applications within ${days} day${days > 1 ? "s" : ""} (median over ${decided} applications, last six months)`,
    apply: "Apply on Proofseen",
    applyNote: "The application and the conversation stay on Proofseen: no contact details are shared before you agree.",
    rail: "Application",
    perDay: "/ day",
  },
} as const;

const OTHER: Readonly<Record<Lang, Lang>> = { fr: "en", en: "fr" };

/** Ce que la page ajoute à la grammaire du registre : l'espace entre les paragraphes, la mesure de lecture. */
const JOB_STYLES =
  ".byline a{font-weight:var(--ps-weight-strong)}" +
  ".head .vline{margin-top:var(--ps-space-2);font-size:var(--ps-step--1)}" +
  ".body .lede{max-width:var(--ps-measure)}.body .lede+.lede{margin-top:var(--ps-space-4)}" +
  ".body .trace{margin-top:var(--ps-space-3)}" +
  ".org{display:grid;gap:var(--ps-space-2)}.org .vline{font-size:var(--ps-step--1)}" +
  ".org a{display:inline-flex;align-items:center;min-height:2.75rem}" +
  ".closing{display:grid;justify-items:start;gap:var(--ps-space-3);margin-top:var(--ps-space-8);padding-top:var(--ps-space-5);border-top:1px solid var(--ps-line)}" +
  ".closing .cta{margin:0;white-space:normal}";

const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export const rateText = (m: Pick<PublicMission, "dailyRateMinCents" | "dailyRateMaxCents" | "currency">, lang: Lang): string => {
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

const longDate = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

/**
 * L'état de l'entreprise au répertoire officiel : une ligne verte et datée quand la base l'a établi, une ligne neutre
 * sinon (la base ne distingue pas ici « pas encore contrôlée » de « contrôlée, pas active » : on n'affirme ni l'un ni
 * l'autre). Une source qui ne connaît pas cet état (`undefined`) n'en dit rien.
 */
export const registryLine = (checkedAt: Date | null | undefined, lang: Lang, tag: "p" | "li" = "p"): string => {
  if (checkedAt === undefined) return "";
  return checkedAt === null ? factLine(LABELS[lang].registryUnknown, false, tag) : factLine(LABELS[lang].registryActive(longDate(checkedAt, lang)), true, tag);
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

const companyHref = (slug: string, lang: Lang): string => `/${lang}/entreprises/${encodeURIComponent(slug)}`;

const companyLink = (m: PublicMission, lang: Lang): string =>
  m.organisationSlug == null ? e(m.organisationName) : `<a href="${e(companyHref(m.organisationSlug, lang))}">${e(m.organisationName)}</a>`;

/** L'en-tête : trace, intitulé, entreprise et son état, puis le contexte en cellules. */
const head = (m: PublicMission, lang: Lang): string => {
  const l = LABELS[lang];
  const context = [
    [l.rate, rateText(m, lang)],
    [l.duration, m.durationMonths === null ? l.notGiven : l.months(m.durationMonths)],
    [l.location, locationText(m, lang)],
  ]
    .map(([dt, dd]) => `<div><dt>${e(dt ?? "")}</dt><dd>${e(dd ?? "")}</dd></div>`)
    .join("");
  return (
    `<header class="head"><a class="crumb" href="/${lang}/missions">← ${l.back}</a>` +
    `<p class="ref"><time datetime="${m.publishedAt.toISOString().slice(0, 10)}">${e(l.trace(longDate(m.publishedAt, lang)))}</time></p>` +
    `<h1 class="title">${e(m.title)}</h1>` +
    `<p class="byline">${l.by} ${companyLink(m, lang)}</p>` +
    registryLine(m.organisationRegistryActiveCheckedAt ?? null, lang) +
    `<dl class="ctx">${context}</dl></header>`
  );
};

/** L'entreprise : son état au répertoire (vérifié), son délai de réponse (mesuré sur Proofseen), sa page. */
const company = (m: PublicMission, lang: Lang): string => {
  const l = LABELS[lang];
  const response = m.organisationResponse == null ? "" : factLine(l.response(m.organisationResponse.medianDays, m.organisationResponse.decided), false);
  const page = m.organisationSlug == null ? "" : `<p><a href="${e(companyHref(m.organisationSlug, lang))}">${l.companyPage}</a></p>`;
  return (
    `<section aria-labelledby="entreprise"><h2 class="part" id="entreprise">${l.company}</h2>` +
    `<div class="org"><p><strong>${e(m.organisationName)}</strong></p>${registryLine(m.organisationRegistryActiveCheckedAt ?? null, lang)}${response}${page}</div></section>`
  );
};

export const renderJobPage = (m: PublicMission, o: JobPageOptions): string => {
  const l = LABELS[o.lang];
  const url = (lang: Lang) => missionUrl(o.baseUrl, lang, m.id);
  const other = OTHER[o.lang];
  const description = `${m.title} · ${locationText(m, o.lang)} · ${rateText(m, o.lang)}`;
  const apply = `<a class="cta" href="${e(o.applyHref)}">${l.apply}</a>`;

  return typeset(
    o.lang,
    [
      "<!doctype html>",
      `<html lang="${o.lang}">`,
      "<head>",
      ...pageHead({ lang: o.lang, title: `${m.title} · ${m.organisationName}`, description: description.slice(0, 160), canonical: url(o.lang) }),
      `<link rel="alternate" hreflang="fr" href="${e(url("fr"))}">`,
      `<link rel="alternate" hreflang="en" href="${e(url("en"))}">`,
      `<link rel="alternate" hreflang="x-default" href="${e(url("fr"))}">`,
      `<style>${STYLES}${LEDGER_STYLES}${JOB_STYLES}</style>`,
      `<script type="application/ld+json">${safeJsonLd(jobPosting(m, { baseUrl: o.baseUrl, lang: o.lang }))}</script>`,
      "</head>",
      "<body>",
      marketHeader(o.lang, url(other)),
      '<main id="contenu" class="sheet">',
      head(m, o.lang),
      `<aside class="rail" aria-label="${l.rail}">${apply}<p class="rail-note">${l.applyNote}</p></aside>`,
      '<div class="body">',
      `<section aria-labelledby="mission"><h2 class="part" id="mission">${l.about}</h2>`,
      paragraphs(m.description),
      `<p class="trace">${l.declared}</p></section>`,
      m.skills.length === 0 ? "" : `<h2>${l.skills}</h2><ul class="tags">${m.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
      company(m, o.lang),
      `<div class="closing">${apply}<p class="trace">${l.published} ${e(longDate(m.publishedAt, o.lang))}</p></div>`,
      nearbyMissionsSection(o.nearby ?? [], o.lang),
      "</div>",
      "</main>",
      marketFooter(o.lang),
      "</body>",
      "</html>",
      "",
    ].join("\n"),
  );
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
