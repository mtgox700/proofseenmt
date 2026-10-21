import { LOCKUP } from "@proofseen/brand";
import { escapeHtml as e } from "./html";

/*
 * Ce que les pages publiques de la marketplace partagent : l'en-tête avec le menu public (missions, freelances, métiers,
 * postes, simulateur, blog, connexion, inscription), le format des dates et des montants. Le menu ne mène qu'à des
 * pages remplies par la base, ou par des taux sourcés (le simulateur). Des liens simples : aucune page de ce menu ne
 * demande de JavaScript.
 */

export type Lang = "fr" | "en";

const MENU = {
  fr: { skip: "Aller au contenu", home: "Proofseen, accueil", label: "Menu principal", missions: "Missions", freelancers: "Freelances", companies: "Entreprises", skills: "Métiers", jobTitles: "Postes", simulator: "Simulateur", blog: "Blog", signIn: "Se connecter", signUp: "Créer un compte", otherLang: "English" },
  en: { skip: "Skip to content", home: "Proofseen, home", label: "Main menu", missions: "Missions", freelancers: "Freelancers", companies: "Companies", skills: "Skills", jobTitles: "Job titles", simulator: "Simulator", blog: "Blog", signIn: "Sign in", signUp: "Sign up", otherLang: "Français" },
} as const;

export type MenuItem = "missions" | "freelancers" | "companies" | "skills" | "jobTitles" | "simulator" | "blog";

/** Les entrées du menu public, dans l'ordre, avec leur chemin sous la langue : les mêmes pour le hub et pour React. */
export const MENU_ITEMS: readonly (readonly [MenuItem, string])[] = [
  ["missions", "missions"],
  ["freelancers", "freelances"],
  ["companies", "entreprises"],
  ["skills", "metiers"],
  ["jobTitles", "postes"],
  ["simulator", "simulateur"],
  ["blog", "blog"],
];

export interface PublicMenu {
  readonly skip: string;
  readonly home: string;
  readonly label: string;
  readonly items: readonly { readonly key: MenuItem; readonly href: string; readonly label: string }[];
  readonly signIn: { readonly href: string; readonly label: string };
  readonly signUp: { readonly href: string; readonly label: string };
  readonly otherLang: string;
}

/** Le menu public d'une langue, en données : React le rend avec les mêmes libellés et les mêmes adresses. */
export const publicMenu = (lang: Lang): PublicMenu => {
  const l = MENU[lang];
  return {
    skip: l.skip,
    home: l.home,
    label: l.label,
    items: MENU_ITEMS.map(([key, path]) => ({ key, href: `/${lang}/${path}`, label: l[key] })),
    signIn: { href: `/${lang}/connexion`, label: l.signIn },
    signUp: { href: `/${lang}/creer-un-compte`, label: l.signUp },
    otherLang: l.otherLang,
  };
};

/** Le poinçon et le mot, en image de taille fixe (aucun décalage), dans la version du thème du visiteur. */
export const lockup = (): string =>
  `<picture><source srcset="${LOCKUP.light}" media="(prefers-color-scheme: light)">` +
  `<img src="${LOCKUP.dark}" width="${LOCKUP.width}" height="${LOCKUP.height}" alt="Proofseen"></picture>`;

/**
 * Le lien d'évitement et l'en-tête public : la marque, le menu, l'inscription, le lien vers la même page dans l'autre
 * langue. Des liens simples, aucun script : sur un téléphone, le menu défile sur une seconde ligne, rien n'est replié.
 */
export const marketHeader = (lang: Lang, otherHref: string, current?: MenuItem): string => {
  const m = publicMenu(lang);
  const other: Lang = lang === "fr" ? "en" : "fr";
  const items = m.items.map((i) => `<a href="${i.href}"${current === i.key ? ' aria-current="page"' : ""}>${i.label}</a>`).join("");
  return (
    `<a class="skip" href="#contenu">${m.skip}</a>` +
    `<header class="top"><div class="chrome"><a class="brand" href="/${lang}" aria-label="${e(m.home)}">${lockup()}</a>` +
    `<nav class="nav" aria-label="${m.label}">${items}<a href="${m.signIn.href}">${m.signIn.label}</a></nav>` +
    `<a class="btn btn-primary signup" href="${m.signUp.href}">${m.signUp.label}</a>` +
    `<a class="lang" href="${e(otherHref)}" hreflang="${other}" lang="${other}">${m.otherLang}</a></div></header>`
  );
};

/** Les trois pages légales, dans l'ordre du pied de page. Les chemins sont les mêmes dans les deux langues. */
export const LEGAL_PAGES = ["mentions-legales", "confidentialite", "conditions"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export const LEGAL_LABELS: Readonly<Record<Lang, { readonly nav: string } & Readonly<Record<LegalPage, string>>>> = {
  fr: { nav: "Informations légales", "mentions-legales": "Mentions légales", confidentialite: "Confidentialité", conditions: "Conditions d'utilisation" },
  en: { nav: "Legal information", "mentions-legales": "Legal notice", confidentialite: "Privacy", conditions: "Terms of use" },
};

const MARKS = {
  fr: "ChatGPT, Claude, Perplexity, Gemini, Copilot, LinkedIn, Malt et GitHub sont des marques de leurs propriétaires. Proofseen n'est affilié à aucun d'entre eux.",
  en: "ChatGPT, Claude, Perplexity, Gemini, Copilot, LinkedIn, Malt and GitHub are trademarks of their owners. Proofseen is not affiliated with any of them.",
} as const;

/** Le pied de page public : les trois pages légales, des liens simples, identiques pour chaque visiteur. */
export const marketFooter = (lang: Lang): string => {
  const l = LEGAL_LABELS[lang];
  const links = LEGAL_PAGES.map((page) => `<a href="/${lang}/${page}">${e(l[page])}</a>`).join(" · ");
  return (
    `<footer class="foot"><div class="chrome"><p class="brand">${lockup()}</p>` +
    `<nav aria-label="${e(l.nav)}">${links}</nav><p>${e(MARKS[lang])}</p></div></footer>`
  );
};

export const longDate = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

/** La date du jour seule (AAAA-MM-JJ) : un rendu reste identique d'une requête à l'autre dans la même journée. */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
