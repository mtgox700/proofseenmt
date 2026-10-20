import { FAVICON } from "./pages";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { marketFooter, marketHeader, MENU_STYLES, type Lang } from "./market-shell";
import { skillUrl } from "./skill-page";

/*
 * Index des pages métiers : les compétences qui ont une page, c'est-à-dire assez de missions ouvertes et de profils
 * publiés réels pour la remplir. Par ordre alphabétique du libellé : un ordre neutre, jamais un classement.
 */

export interface SkillIndexItem {
  readonly key: string;
  readonly label: string;
  readonly missions: number;
  readonly profiles: number;
}

const LABELS = {
  fr: {
    title: "Métiers freelance sur Proofseen",
    lead: "Une page par compétence, dès que des missions ouvertes ou des profils publiés réels la portent.",
    order: "Par ordre alphabétique.",
    list: "Compétences",
    empty: "Aucune page métier n'existe encore : une page apparaît dès que deux missions ou profils réels portent la compétence.",
    counts: (m: number, p: number) => `${m} mission${m > 1 ? "s" : ""} ouverte${m > 1 ? "s" : ""} · ${p} profil${p > 1 ? "s" : ""} publié${p > 1 ? "s" : ""}`,
  },
  en: {
    title: "Freelance skills on Proofseen",
    lead: "One page per skill, as soon as real open missions or published profiles carry it.",
    order: "In alphabetical order.",
    list: "Skills",
    empty: "No skill page exists yet: a page appears as soon as two real missions or profiles carry the skill.",
    counts: (m: number, p: number) => `${m} open mission${m > 1 ? "s" : ""} · ${p} published profile${p > 1 ? "s" : ""}`,
  },
} as const;

export const skillIndexUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/metiers`;

export const renderSkillIndex = (entries: readonly SkillIndexItem[], o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label, o.lang) || a.key.localeCompare(b.key));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: l.title,
    url: skillIndexUrl(base, o.lang),
    inLanguage: o.lang,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: sorted.length,
      itemListElement: sorted.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.label, url: skillUrl(base, o.lang, s.key) })),
    },
  };
  const list =
    sorted.length === 0
      ? `<p class="muted">${l.empty}</p>`
      : `<ul class="more">${sorted
          .map((s) => `<li><a href="/${o.lang}/metiers/${e(encodeURIComponent(s.key))}">${e(s.label)}<small>${l.counts(s.missions, s.profiles)}</small></a></li>`)
          .join("")}</ul>`;
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${l.title} — Proofseen</title>`,
    `<meta name="description" content="${e(l.lead)}">`,
    `<link rel="canonical" href="${e(skillIndexUrl(base, o.lang))}">`,
    `<link rel="alternate" hreflang="fr" href="${e(skillIndexUrl(base, "fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(skillIndexUrl(base, "en"))}">`,
    `<style>${STYLES}${MENU_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/metiers`, "skills"),
    '<main class="wrap">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    `<h2>${l.list}</h2>`,
    `<p class="muted">${l.order}</p>`,
    list,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
