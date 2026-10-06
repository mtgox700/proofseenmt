import { FAVICON } from "./pages";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { missionUrl } from "./job-posting";
import { profileUrl } from "./profile-page";

/*
 * Page métier : les missions ouvertes et les profils publiés d'une compétence. Elle n'existe que remplie de contenu réel
 * (la base décide) ; ce rendu ne fabrique aucun texte de remplissage. Un freelance pseudonyme y apparaît par sa
 * référence, jamais par son nom.
 */

type Lang = "fr" | "en";

export interface SkillPageView {
  readonly key: string;
  readonly label: string;
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: "onsite" | "hybrid" | "remote"; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
}

const LABELS = {
  fr: {
    title: (label: string) => `${label} : missions et freelances`,
    lead: (m: number, p: number) => `${m} mission${m > 1 ? "s" : ""} ouverte${m > 1 ? "s" : ""} et ${p} profil${p > 1 ? "s" : ""} publié${p > 1 ? "s" : ""} sur Proofseen.`,
    missions: "Missions ouvertes",
    profiles: "Freelances",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    pseudonym: (ref: string) => `Freelance ${ref}`,
    otherLang: "English",
  },
  en: {
    title: (label: string) => `${label}: missions and freelancers`,
    lead: (m: number, p: number) => `${m} open mission${m > 1 ? "s" : ""} and ${p} published profile${p > 1 ? "s" : ""} on Proofseen.`,
    missions: "Open missions",
    profiles: "Freelancers",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    otherLang: "Français",
  },
} as const;

export const skillUrl = (baseUrl: string, lang: Lang, key: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/metiers/${encodeURIComponent(key)}`;

export const renderSkillPage = (s: SkillPageView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const title = l.title(s.label);
  const urls = [...s.missions.map((m) => missionUrl(o.baseUrl, o.lang, m.id)), ...s.profiles.map((p) => profileUrl(o.baseUrl, o.lang, p.slug))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    url: skillUrl(o.baseUrl, o.lang, s.key),
    about: s.label,
    mainEntity: { "@type": "ItemList", numberOfItems: urls.length, itemListElement: urls.map((url, i) => ({ "@type": "ListItem", position: i + 1, url })) },
  };
  const missions =
    s.missions.length === 0
      ? ""
      : `<h2>${l.missions}</h2><ul class="missions">${s.missions
          .map((m) => {
            const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
            return `<li class="card"><h3><a href="${e(`/${o.lang}/missions/${m.id}`)}">${e(m.title)}</a></h3><p class="when">${e(m.organisationName)} · ${e(where)}</p></li>`;
          })
          .join("")}</ul>`;
  const profiles =
    s.profiles.length === 0
      ? ""
      : `<h2>${l.profiles}</h2><ul class="missions">${s.profiles
          .map((p) => `<li class="card"><h3><a href="${e(`/${o.lang}/profils/${p.slug}`)}">${e(p.displayName ?? l.pseudonym(p.reference))}</a></h3><p class="when">${e(p.headline)} · ${e(p.city)}</p></li>`)
          .join("")}</ul>`;
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${e(title)} — Proofseen</title>`,
    `<meta name="description" content="${e(l.lead(s.missions.length, s.profiles.length))}">`,
    `<link rel="canonical" href="${e(skillUrl(o.baseUrl, o.lang, s.key))}">`,
    `<link rel="alternate" hreflang="fr" href="${e(skillUrl(o.baseUrl, "fr", s.key))}">`,
    `<link rel="alternate" hreflang="en" href="${e(skillUrl(o.baseUrl, "en", s.key))}">`,
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    `<header class="top"><div class="wrap"><a class="me" href="/${o.lang}">Proofseen</a>` +
      `<a class="lang" href="${e(skillUrl(o.baseUrl, other, s.key))}" hreflang="${other}" lang="${other}">${l.otherLang}</a></div></header>`,
    '<main class="wrap">',
    `<h1 class="title">${e(title)}</h1>`,
    `<p class="headline">${e(l.lead(s.missions.length, s.profiles.length))}</p>`,
    missions,
    profiles,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

export const skillSitemap = (baseUrl: string, items: readonly { readonly key: string }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(skillUrl(baseUrl, lang, item.key))}</loc></url>`)),
    "</urlset>",
    "",
  ].join("\n");
