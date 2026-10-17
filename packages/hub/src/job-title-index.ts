import { escapeHtml as e } from "./html";
import { jobTitleUrl } from "./job-title-page";
import type { Lang } from "./market-shell";
import { renderFrame } from "./page-frame";

/*
 * Index des pages par poste : les postes qui ont une page, c'est-à-dire assez de missions ouvertes et de profils publiés
 * réels pour la remplir. Par ordre alphabétique du libellé : un ordre neutre, jamais un classement.
 */

export interface JobTitleIndexItem {
  readonly key: string;
  readonly label: { readonly fr: string; readonly en: string };
  readonly missions: number;
  readonly profiles: number;
}

const LABELS = {
  fr: {
    title: "Postes freelance tech sur Proofseen",
    lead: "Une page par intitulé de poste, dès que des missions ouvertes ou des profils publiés réels le portent. Les compétences ont leurs propres pages, dans Métiers.",
    order: "Par ordre alphabétique.",
    list: "Postes",
    empty: "Aucune page de poste n'existe encore : une page apparaît dès que deux missions ou profils réels portent l'intitulé.",
    counts: (m: number, p: number) => `${m} mission${m > 1 ? "s" : ""} ouverte${m > 1 ? "s" : ""} · ${p} profil${p > 1 ? "s" : ""} publié${p > 1 ? "s" : ""}`,
  },
  en: {
    title: "Tech freelance job titles on Proofseen",
    lead: "One page per job title, as soon as real open missions or published profiles carry it. Skills have their own pages, under Skills.",
    order: "In alphabetical order.",
    list: "Job titles",
    empty: "No job title page exists yet: a page appears as soon as two real missions or profiles carry the title.",
    counts: (m: number, p: number) => `${m} open mission${m > 1 ? "s" : ""} · ${p} published profile${p > 1 ? "s" : ""}`,
  },
} as const;

export const jobTitleIndexUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/postes`;

export const renderJobTitleIndex = (entries: readonly JobTitleIndexItem[], o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  const sorted = [...entries].sort((a, b) => a.label[o.lang].localeCompare(b.label[o.lang], o.lang) || a.key.localeCompare(b.key));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: l.title,
    url: jobTitleIndexUrl(base, o.lang),
    inLanguage: o.lang,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: sorted.length,
      itemListElement: sorted.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.label[o.lang], url: jobTitleUrl(base, o.lang, s.key) })),
    },
  };
  const list =
    sorted.length === 0
      ? `<p class="muted">${e(l.empty)}</p>`
      : `<ul class="more">${sorted
          .map((s) => `<li><a href="/${o.lang}/postes/${e(encodeURIComponent(s.key))}">${e(s.label[o.lang])}<small>${l.counts(s.missions, s.profiles)}</small></a></li>`)
          .join("")}</ul>`;
  return renderFrame({
    lang: o.lang,
    title: l.title,
    description: l.lead,
    canonical: jobTitleIndexUrl(base, o.lang),
    alternates: { fr: jobTitleIndexUrl(base, "fr"), en: jobTitleIndexUrl(base, "en") },
    jsonLd,
    otherHref: `/${other}/postes`,
    menu: "jobTitles",
    main: [`<h1 class="title">${e(l.title)}</h1>`, `<p class="headline">${e(l.lead)}</p>`, `<h2>${l.list}</h2>`, `<p class="muted">${l.order}</p>`, list],
  });
};

export const jobTitleSitemap = (baseUrl: string, items: readonly { readonly key: string }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(jobTitleUrl(baseUrl, lang, item.key))}</loc></url>`)),
    "</urlset>",
    "",
  ].join("\n");
