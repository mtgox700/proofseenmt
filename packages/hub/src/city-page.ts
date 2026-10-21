import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { missionUrl } from "./job-posting";
import { jobCard, JOB_CARD_STYLES } from "./job-card";
import { factLine, LEDGER_STYLES } from "./ledger";
import { isoDay, longDate, marketFooter, marketHeader, money, type Lang } from "./market-shell";

/*
 * Page d'une ville : ses missions ouvertes. Elle n'existe que remplie de missions réelles (la base décide du seuil) ;
 * ce rendu ne fabrique aucun texte de remplissage. Les missions vont des plus récentes aux plus anciennes, et la page
 * le dit. Les faits (nombre, compétences demandées, fourchette de TJM avec son n) sont ceux que la base a comptés au
 * moment du rendu, datés. Ce sont des comptes de Proofseen, pas des vérifications : aucun n'est vert.
 */

export const MIN_CITY_RATE_SAMPLE = 5;

export interface CityMissionView {
  readonly id: string;
  readonly title: string;
  readonly organisationName: string;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly city: string | null;
  readonly skills: readonly string[];
  readonly dailyRateMinCents: number | null;
  readonly dailyRateMaxCents: number | null;
  readonly currency: string;
  readonly publishedAt: Date;
}

export interface CityPageView {
  readonly key: string;
  readonly label: string;
  readonly missions: readonly CityMissionView[];
  readonly facts: {
    readonly missionCount: number;
    readonly skills: readonly string[];
    readonly dailyRate: { readonly n: number; readonly minCents: number; readonly maxCents: number; readonly currency: string } | null;
  };
  readonly generatedAt: Date;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const LABELS = {
  fr: {
    title: (city: string) => `Missions freelance à ${city}`,
    lead: (n: number, city: string) => `${plural(n, "mission ouverte", "missions ouvertes")} à ${city}, publiées par des entreprises sur Proofseen.`,
    back: "Toutes les missions",
    trace: (when: string) => `Missions par ville · page générée le ${when}`,
    facts: "En bref",
    factsNote: "Comptés par Proofseen sur les missions ouvertes, au moment où la page a été générée.",
    list: "Missions ouvertes",
    order: "Ordre : date de publication, les plus récentes d'abord.",
    count: (n: number, city: string, when: string) => `Au ${when}, Proofseen compte ${plural(n, "mission ouverte", "missions ouvertes")} à ${city}.`,
    skills: (list: string) => `Compétences demandées : ${list}.`,
    rate: (min: string, max: string, n: number) => `TJM affichés de ${min} à ${max} par jour (n = ${n} missions qui affichent leur TJM).`,
    generated: (when: string) => `Page générée le ${when} à partir des missions ouvertes.`,
  },
  en: {
    title: (city: string) => `Freelance missions in ${city}`,
    lead: (n: number, city: string) => `${plural(n, "open mission", "open missions")} in ${city}, posted by companies on Proofseen.`,
    back: "All missions",
    trace: (when: string) => `Missions by city · page generated on ${when}`,
    facts: "In short",
    factsNote: "Counted by Proofseen over the open missions, when the page was generated.",
    list: "Open missions",
    order: "Order: publication date, most recent first.",
    count: (n: number, city: string, when: string) => `On ${when}, Proofseen lists ${plural(n, "open mission", "open missions")} in ${city}.`,
    skills: (list: string) => `Skills asked for: ${list}.`,
    rate: (min: string, max: string, n: number) => `Day rates shown range from ${min} to ${max} (n = ${n} missions showing their rate).`,
    generated: (when: string) => `Page generated on ${when} from the open missions.`,
  },
} as const;

export const cityUrl = (baseUrl: string, lang: Lang, key: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/missions/ville/${encodeURIComponent(key)}`;

const facts = (c: CityPageView, lang: Lang): readonly string[] => {
  const l = LABELS[lang];
  const r = c.facts.dailyRate !== null && c.facts.dailyRate.n >= MIN_CITY_RATE_SAMPLE ? c.facts.dailyRate : null;
  return [
    l.count(c.facts.missionCount, c.label, longDate(c.generatedAt, lang)),
    ...(c.facts.skills.length === 0 ? [] : [l.skills(c.facts.skills.join(", "))]),
    ...(r === null ? [] : [l.rate(money(r.minCents, r.currency, lang), money(r.maxCents, r.currency, lang), r.n)]),
  ];
};

export const renderCityPage = (c: CityPageView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const url = cityUrl(o.baseUrl, o.lang, c.key);
  const title = l.title(c.label);
  const lead = l.lead(c.facts.missionCount, c.label);
  const generated = longDate(c.generatedAt, o.lang);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    url,
    inLanguage: o.lang,
    dateModified: isoDay(c.generatedAt),
    about: { "@type": "City", name: c.label },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: c.missions.length,
      itemListElement: c.missions.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.title, url: missionUrl(o.baseUrl, o.lang, m.id) })),
    },
  };
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(title), description: lead, canonical: url }),
    `<link rel="alternate" hreflang="fr" href="${e(cityUrl(o.baseUrl, "fr", c.key))}">`,
    `<link rel="alternate" hreflang="en" href="${e(cityUrl(o.baseUrl, "en", c.key))}">`,
    `<style>${STYLES}${LEDGER_STYLES}${JOB_CARD_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, cityUrl(o.baseUrl, other, c.key), "missions"),
    '<main id="contenu" class="wrap">',
    `<header class="head"><a class="crumb" href="/${o.lang}/missions">← ${l.back}</a>`,
    `<p class="ref"><time datetime="${isoDay(c.generatedAt)}">${e(l.trace(generated))}</time></p>`,
    `<h1 class="title">${e(title)}</h1>`,
    `<p class="headline">${e(lead)}</p></header>`,
    `<h2 class="part">${l.facts}</h2>`,
    `<p class="part-note">${l.factsNote}</p>`,
    `<ul class="lines">${facts(c, o.lang).map((f) => factLine(f, false, "li")).join("")}</ul>`,
    `<h2 class="part">${l.list}</h2>`,
    `<p class="trace">${l.order}</p>`,
    `<ul class="entries missions">${c.missions.map((m) => jobCard(m, o.lang)).join("")}</ul>`,
    `<p class="byline trace"><time datetime="${isoDay(c.generatedAt)}">${e(l.generated(generated))}</time></p>`,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
