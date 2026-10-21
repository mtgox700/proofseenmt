import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { missionUrl } from "./job-posting";
import { isoDay, longDate, marketFooter, marketHeader, money, type Lang } from "./market-shell";

/*
 * Page d'une ville : ses missions ouvertes. Elle n'existe que remplie de missions réelles (la base décide du seuil) ;
 * ce rendu ne fabrique aucun texte de remplissage. Les missions vont des plus récentes aux plus anciennes, et la page
 * le dit. Les faits (nombre, compétences demandées, fourchette de TJM avec son n) sont ceux que la base a comptés au
 * moment du rendu, datés.
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
    facts: "En bref",
    list: "Missions ouvertes",
    order: "Ordre : date de publication, les plus récentes d'abord.",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    count: (n: number, city: string, when: string) => `Au ${when}, Proofseen compte ${plural(n, "mission ouverte", "missions ouvertes")} à ${city}.`,
    skills: (list: string) => `Compétences demandées : ${list}.`,
    rate: (min: string, max: string, n: number) => `TJM affichés de ${min} à ${max} par jour (n = ${n} missions qui affichent leur TJM).`,
    published: (when: string) => `publiée le ${when}`,
    perDay: "/ jour",
    notGiven: "TJM non précisé",
    generated: (when: string) => `Page générée le ${when} à partir des missions ouvertes.`,
  },
  en: {
    title: (city: string) => `Freelance missions in ${city}`,
    lead: (n: number, city: string) => `${plural(n, "open mission", "open missions")} in ${city}, posted by companies on Proofseen.`,
    back: "All missions",
    facts: "In short",
    list: "Open missions",
    order: "Order: publication date, most recent first.",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    count: (n: number, city: string, when: string) => `On ${when}, Proofseen lists ${plural(n, "open mission", "open missions")} in ${city}.`,
    skills: (list: string) => `Skills asked for: ${list}.`,
    rate: (min: string, max: string, n: number) => `Day rates shown range from ${min} to ${max} (n = ${n} missions showing their rate).`,
    published: (when: string) => `posted on ${when}`,
    perDay: "/ day",
    notGiven: "Day rate not given",
    generated: (when: string) => `Page generated on ${when} from the open missions.`,
  },
} as const;

export const cityUrl = (baseUrl: string, lang: Lang, key: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/missions/ville/${encodeURIComponent(key)}`;

const rate = (m: CityMissionView, lang: Lang): string => {
  const l = LABELS[lang];
  const { dailyRateMinCents: min, dailyRateMaxCents: max } = m;
  if (min === null && max === null) return l.notGiven;
  if (min !== null && max !== null && min !== max) return `${money(min, m.currency, lang)} – ${money(max, m.currency, lang)} ${l.perDay}`;
  return `${money(min ?? max ?? 0, m.currency, lang)} ${l.perDay}`;
};

const card = (m: CityMissionView, lang: Lang): string => {
  const l = LABELS[lang];
  const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
  return (
    `<li class="card"><h3><a href="${e(`/${lang}/missions/${m.id}`)}">${e(m.title)}</a></h3>` +
    `<p class="when">${e(m.organisationName)} · ${e(where)} · <time datetime="${isoDay(m.publishedAt)}">${e(l.published(longDate(m.publishedAt, lang)))}</time></p>` +
    (m.skills.length === 0 ? "" : `<ul class="tags">${m.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`) +
    `<p class="lead"><b>${e(rate(m, lang))}</b></p></li>`
  );
};

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
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, cityUrl(o.baseUrl, other, c.key), "missions"),
    '<main id="contenu" class="wrap">',
    `<a class="crumb" href="/${o.lang}/missions">← ${l.back}</a>`,
    `<h1 class="title">${e(title)}</h1>`,
    `<p class="headline">${e(lead)}</p>`,
    `<h2>${l.facts}</h2>`,
    `<p class="lede">${facts(c, o.lang).map(e).join(" ")}</p>`,
    `<h2>${l.list}</h2>`,
    `<p class="muted">${l.order}</p>`,
    `<ul class="missions">${c.missions.map((m) => card(m, o.lang)).join("")}</ul>`,
    `<p class="byline"><time datetime="${isoDay(c.generatedAt)}">${e(l.generated(longDate(c.generatedAt, o.lang)))}</time></p>`,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
