import { escapeHtml as e } from "./html";

/*
 * Ce que les pages publiques de la marketplace partagent : l'en-tête avec le menu public (missions, freelances, métiers,
 * connexion, inscription), le format des dates et des montants. Le menu ne mène qu'à des pages remplies par la base.
 * Des liens simples : aucune page de ce menu ne demande de JavaScript.
 */

export type Lang = "fr" | "en";

const MENU = {
  fr: { label: "Menu principal", missions: "Missions", freelancers: "Freelances", skills: "Métiers", blog: "Blog", signIn: "Se connecter", signUp: "Créer un compte", otherLang: "English" },
  en: { label: "Main menu", missions: "Missions", freelancers: "Freelancers", skills: "Skills", blog: "Blog", signIn: "Sign in", signUp: "Sign up", otherLang: "Français" },
} as const;

export const MENU_STYLES =
  ".top .wrap{flex-wrap:wrap;padding-block:.4rem}" +
  ".top nav{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem 1.1rem}" +
  ".top nav a{color:var(--muted);text-decoration:none}.top nav a:hover{color:var(--ink)}" +
  ".top nav a[aria-current]{color:var(--ink)}";

export type MenuItem = "missions" | "freelancers" | "skills" | "blog";

/** L'en-tête public : la marque, le menu, et le lien vers la même page dans l'autre langue. */
export const marketHeader = (lang: Lang, otherHref: string, current?: MenuItem): string => {
  const l = MENU[lang];
  const other: Lang = lang === "fr" ? "en" : "fr";
  const item = (key: MenuItem, path: string): string => `<a href="/${lang}/${path}"${current === key ? ' aria-current="page"' : ""}>${l[key]}</a>`;
  return (
    `<header class="top"><div class="wrap"><a class="me" href="/${lang}">Proofseen</a>` +
    `<nav aria-label="${l.label}">${item("missions", "missions")}${item("freelancers", "freelances")}${item("skills", "metiers")}${item("blog", "blog")}` +
    `<a href="/${lang}/connexion">${l.signIn}</a><a href="/${lang}/creer-un-compte">${l.signUp}</a>` +
    `<a class="lang" href="${e(otherHref)}" hreflang="${other}" lang="${other}">${MENU[lang].otherLang}</a></nav></div></header>`
  );
};

export const longDate = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

/** La date du jour seule (AAAA-MM-JJ) : un rendu reste identique d'une requête à l'autre dans la même journée. */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
