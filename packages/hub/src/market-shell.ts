import { escapeHtml as e } from "./html";

/*
 * Ce que les pages publiques de la marketplace partagent : l'en-tête avec le menu public (missions, freelances, métiers,
 * postes, simulateur, blog, connexion, inscription), le format des dates et des montants. Le menu ne mène qu'à des
 * pages remplies par la base, ou par des taux sourcés (le simulateur). Des liens simples : aucune page de ce menu ne
 * demande de JavaScript.
 */

export type Lang = "fr" | "en";

const MENU = {
  fr: { label: "Menu principal", missions: "Missions", freelancers: "Freelances", companies: "Entreprises", skills: "Métiers", jobTitles: "Postes", simulator: "Simulateur", blog: "Blog", signIn: "Se connecter", signUp: "Créer un compte", otherLang: "English" },
  en: { label: "Main menu", missions: "Missions", freelancers: "Freelancers", companies: "Companies", skills: "Skills", jobTitles: "Job titles", simulator: "Simulator", blog: "Blog", signIn: "Sign in", signUp: "Sign up", otherLang: "Français" },
} as const;

export const MENU_STYLES =
  ".top .wrap{flex-wrap:wrap;padding-block:.4rem}" +
  ".top nav{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem 1.1rem}" +
  ".top nav a{color:var(--muted);text-decoration:none}.top nav a:hover{color:var(--ink)}" +
  ".top nav a[aria-current]{color:var(--ink)}";

export type MenuItem = "missions" | "freelancers" | "companies" | "skills" | "jobTitles" | "simulator" | "blog";

/** L'en-tête public : la marque, le menu, et le lien vers la même page dans l'autre langue. */
export const marketHeader = (lang: Lang, otherHref: string, current?: MenuItem): string => {
  const l = MENU[lang];
  const other: Lang = lang === "fr" ? "en" : "fr";
  const item = (key: MenuItem, path: string): string => `<a href="/${lang}/${path}"${current === key ? ' aria-current="page"' : ""}>${l[key]}</a>`;
  return (
    `<header class="top"><div class="wrap"><a class="me" href="/${lang}">Proofseen</a>` +
    `<nav aria-label="${l.label}">${item("missions", "missions")}${item("freelancers", "freelances")}${item("companies", "entreprises")}${item("skills", "metiers")}${item("jobTitles", "postes")}${item("simulator", "simulateur")}${item("blog", "blog")}` +
    `<a href="/${lang}/connexion">${l.signIn}</a><a href="/${lang}/creer-un-compte">${l.signUp}</a>` +
    `<a class="lang" href="${e(otherHref)}" hreflang="${other}" lang="${other}">${MENU[lang].otherLang}</a></nav></div></header>`
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
  return `<footer class="foot"><div class="wrap"><nav aria-label="${e(l.nav)}">${links}</nav><p>${e(MARKS[lang])}</p></div></footer>`;
};

export const longDate =(d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

/** La date du jour seule (AAAA-MM-JJ) : un rendu reste identique d'une requête à l'autre dans la même journée. */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
