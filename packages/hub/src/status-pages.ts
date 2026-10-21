import { escapeHtml as e, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { marketFooter, marketHeader, type Lang } from "./market-shell";
import { typeset } from "./typography";

/*
 * Les deux états d'une page du hub qui ne peut pas s'afficher : l'adresse ne mène à rien (404), ou la page n'a pas pu
 * être lue (503, 500). Le même cadre que toutes les pages publiques (tête, en-tête, pied, jetons de la marque), le même
 * contenu et le même ton que la 404 des pages React (`apps/web/src/i18n/states.ts`, `NotFoundView`), dans la langue de
 * l'adresse. Aucun script, rien de caché, `noindex` ; le statut reste celui de la route.
 *
 * Aucun vert : le vert se gagne par un fait vérifié, et ces pages n'en portent aucun. Le dessin est celui de la 404
 * React : une fiche du registre dont l'emplacement du poinçon est vide, les repères visent l'emplacement une fois.
 */

const COPY = {
  fr: {
    code: "Erreur 404",
    title: "Cette page n'existe pas.",
    lead: "Aucune page publiée ne répond à cette adresse. Elle a pu être retirée, ou l'adresse a été mal recopiée.",
    mark: "Aucune marque frappée ici.",
    searchLabel: "Chercher une mission",
    searchSubmit: "Chercher",
    elsewhere: "Reprendre ailleurs",
    links: { home: "Accueil", missions: "Missions", directory: "Annuaire des freelances", companies: "Entreprises" },
    error: {
      code: "Incident",
      title: "Cette page n'a pas pu s'afficher.",
      lead: "Un incident de notre côté a interrompu l'affichage. Vous pouvez réessayer tout de suite.",
      retry: "Réessayer",
      home: "Retour à l'accueil",
    },
  },
  en: {
    code: "Error 404",
    title: "This page does not exist.",
    lead: "No published page answers at this address. It may have been taken down, or the address was mistyped.",
    mark: "No mark struck here.",
    searchLabel: "Search missions",
    searchSubmit: "Search",
    elsewhere: "Carry on from here",
    links: { home: "Home", missions: "Missions", directory: "Freelancer directory", companies: "Companies" },
    error: {
      code: "Incident",
      title: "This page could not be displayed.",
      lead: "Something went wrong on our side while showing it. You can try again right away.",
      retry: "Try again",
      home: "Back to home",
    },
  },
} as const;

/** La langue d'une adresse : celle du segment, le français sinon (la langue par défaut du site). */
export const statusLang = (segment: string): Lang => (segment === "en" ? "en" : "fr");

const SLOT = { x: 200, y: 48, size: 96, r: 16 } as const;

/** L'emplacement du poinçon : un carré aux quatre coins mordus d'un quart de cercle, comme le cartouche de la marque. */
const cartouche = (): string => {
  const { x, y, size, r } = SLOT;
  return (
    `M${x + r} ${y}H${x + size - r}A${r} ${r} 0 0 0 ${x + size} ${y + r}V${y + size - r}` +
    `A${r} ${r} 0 0 0 ${x + size - r} ${y + size}H${x + r}A${r} ${r} 0 0 0 ${x} ${y + size - r}V${y + r}A${r} ${r} 0 0 0 ${x + r} ${y}Z`
  );
};

/** Deux traits à chaque coin de l'emplacement, un peu en dehors, comme sur une épreuve d'imprimeur. */
const cropMarks = (): string => {
  const { x, y, size } = SLOT;
  const [gap, arm] = [8, 10];
  const [left, right, top, bottom] = [x - gap, x + size + gap, y - gap, y + size + gap];
  return (
    `M${left} ${top + arm}V${top}H${left + arm}M${right - arm} ${top}H${right}V${top + arm}` +
    `M${right} ${bottom - arm}V${bottom}H${right - arm}M${left + arm} ${bottom}H${left}V${bottom - arm}`
  );
};

const LINES: readonly (readonly [number, number, number])[] = [
  [24, 28, 56],
  [24, 56, 140],
  [24, 74, 112],
  [24, 118, 128],
  [24, 136, 96],
  [24, 170, 48],
];

/** Le dessin, décoratif : la légende à côté dit la même chose en mots. Taille fixée par la viewBox, aucun décalage. */
const punchAbsent = (): string =>
  '<svg class="nf-art-svg" viewBox="0 0 320 200" width="320" height="200" aria-hidden="true" focusable="false">' +
  '<rect class="nf-paper" x="0.75" y="0.75" width="318.5" height="198.5" rx="4"/>' +
  LINES.map(([x, y, w]) => `<rect class="nf-ink" x="${x}" y="${y}" width="${w}" height="6" rx="1"/>`).join("") +
  '<path class="nf-rule" d="M24 98H176M80 176H176"/>' +
  `<path class="nf-slot" d="${cartouche()}"/><path class="nf-aim" d="${cropMarks()}"/></svg>`;

/** Le CSS de `apps/web/src/styles/states.css` (partie 404), en jetons de la marque. */
const STATUS_STYLES = [
  ".nf-code,.nf-mark,.nf-links-title{margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  '.nf{display:grid;grid-template-columns:minmax(0,1fr);grid-template-areas:"text" "art" "links";gap:var(--ps-space-6)}',
  '@media (min-width:56rem){.nf{grid-template-columns:minmax(0,7fr) minmax(0,5fr);grid-template-areas:"text art" "links links";column-gap:var(--ps-space-8);align-items:center}}',
  ".nf-text{grid-area:text;display:grid;gap:var(--ps-space-4);justify-items:start}",
  ".nf-title{margin:0;font:var(--ps-weight-display) var(--ps-step-4)/var(--ps-lead-4) var(--ps-font-display);letter-spacing:var(--ps-track-4);max-width:16ch}",
  ".nf-lead{max-width:52ch;color:var(--ps-muted);font-size:var(--ps-step-1);line-height:var(--ps-lead-1)}",
  ".nf-search{display:grid;gap:var(--ps-space-2);width:min(100%,30rem);margin-top:var(--ps-space-2)}",
  ".nf-search label{font-size:var(--ps-step--1);font-weight:var(--ps-weight-strong)}",
  ".nf-search-row{display:flex;gap:var(--ps-space-2)}",
  ".nf-search input{flex:1;min-width:0;min-height:2.75rem;padding:0 var(--ps-space-3);color:var(--ps-text);background:var(--ps-raised);border:var(--ps-border) solid var(--ps-line-strong);border-radius:var(--ps-radius)}",
  ".nf-art{grid-area:art;margin:0;display:grid;gap:var(--ps-space-3);justify-items:center}",
  ".nf-art-svg{width:min(100%,24rem);height:auto}",
  ".nf-paper{fill:var(--ps-surface);stroke:var(--ps-line);stroke-width:1.5}",
  ".nf-ink{fill:var(--ps-line-strong);fill-opacity:.4}",
  ".nf-rule{fill:none;stroke:var(--ps-line-strong);stroke-width:1.5;stroke-opacity:.6}",
  ".nf-slot{fill:none;stroke:var(--ps-line-strong);stroke-width:1.5;stroke-dasharray:6 5}",
  ".nf-aim{fill:none;stroke:var(--ps-text);stroke-width:1.5;stroke-linecap:square;transform-box:view-box;transform-origin:248px 96px}",
  "@media (prefers-reduced-motion:no-preference){.nf-aim{animation:nf-aim var(--ps-dur-reveal) var(--ps-ease-strike) 240ms both}}",
  "@keyframes nf-aim{from{transform:scale(1.14)}}",
  ".nf-links{grid-area:links;padding-top:var(--ps-space-5);border-top:var(--ps-border) solid var(--ps-line)}",
  ".nf-links-title{margin-bottom:var(--ps-space-3)}",
  ".nf-links ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);column-gap:var(--ps-space-6)}",
  "@media (min-width:40rem){.nf-links ul{grid-template-columns:repeat(2,minmax(0,1fr))}}",
  "@media (min-width:64rem){.nf-links ul{grid-template-columns:repeat(4,minmax(0,1fr))}}",
  ".nf-links a{display:flex;justify-content:space-between;align-items:baseline;gap:var(--ps-space-3);min-height:3rem;padding-block:var(--ps-space-3);border-bottom:var(--ps-border) solid var(--ps-line);color:var(--ps-text);font-weight:var(--ps-weight-strong);text-decoration:none}",
  ".nf-path{font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-faint)}",
  "@media (hover:hover) and (pointer:fine){.nf-links a:hover{border-bottom-color:var(--ps-text)}.nf-links a:hover .nf-path{color:var(--ps-text)}}",
  ".state-error{display:grid;gap:var(--ps-space-4);justify-items:start;max-width:44rem}",
  ".state-actions{display:flex;flex-wrap:wrap;gap:var(--ps-space-3);margin-top:var(--ps-space-2)}",
].join("\n");

export interface StatusPageOptions {
  /** L'origine du site (publicBaseUrl) : la carte de partage y est annoncée en adresse absolue. */
  readonly baseUrl?: string;
}

const frame = (lang: Lang, title: string, description: string, main: string, o: StatusPageOptions): string => {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return typeset(
    lang,
    [
      "<!doctype html>",
      `<html lang="${lang}">`,
      "<head>",
      ...pageHead({ lang, title: withBrand(title), description, canonical: null, ...(o.baseUrl === undefined ? {} : { origin: o.baseUrl }) }),
      '<meta name="robots" content="noindex">',
      `<style>${STYLES}${STATUS_STYLES}</style>`,
      "</head>",
      "<body>",
      marketHeader(lang, `/${other}`),
      '<main id="contenu" class="wrap">',
      main,
      "</main>",
      marketFooter(lang),
      "</body>",
      "</html>",
      "",
    ].join("\n"),
  );
};

/**
 * La 404 d'une page du hub (profil, mission, entreprise, article, métier, poste, ville, publication) : ce qui s'est
 * passé, une recherche de missions (formulaire GET), et les pages publiques à ouvrir à la place, chacune avec son
 * adresse écrite (la trace). Des liens simples : chaque sortie marche sans JavaScript.
 */
export const notFoundPage = (lang: Lang, o: StatusPageOptions = {}): string => {
  const c = COPY[lang];
  const links = [
    [`/${lang}`, c.links.home],
    [`/${lang}/missions`, c.links.missions],
    [`/${lang}/freelances`, c.links.directory],
    [`/${lang}/entreprises`, c.links.companies],
  ] as const;
  const main =
    '<div class="nf"><div class="nf-text">' +
    `<p class="nf-code">${c.code}</p><h1 class="nf-title">${e(c.title)}</h1><p class="nf-lead">${e(c.lead)}</p>` +
    `<form class="nf-search" role="search" method="get" action="/${lang}/missions"><label for="nf-q">${c.searchLabel}</label>` +
    '<span class="nf-search-row"><input id="nf-q" type="search" name="q" maxlength="200" autocomplete="off" enterkeyhint="search">' +
    `<button class="btn btn-primary" type="submit">${c.searchSubmit}</button></span></form></div>` +
    `<figure class="nf-art">${punchAbsent()}<figcaption class="nf-mark">${c.mark}</figcaption></figure>` +
    `<nav class="nf-links" aria-labelledby="nf-elsewhere"><h2 id="nf-elsewhere" class="nf-links-title">${c.elsewhere}</h2><ul>` +
    links.map(([href, label]) => `<li><a href="${href}"><span>${e(label)}</span><span class="nf-path">${href}</span></a></li>`).join("") +
    "</ul></nav></div>";
  return frame(lang, c.title, c.lead, main, o);
};

/**
 * Une page du hub qui n'a pas pu être lue (base absente, erreur) : le même ton que l'erreur React, sans rien dire de
 * l'erreur elle-même. « Réessayer » est un lien vers la même adresse, pas un bouton : il marche sans JavaScript.
 */
export const unavailablePage = (lang: Lang, retryHref: string, o: StatusPageOptions = {}): string => {
  const c = COPY[lang].error;
  // Seul un chemin du site est accepté : jamais une adresse d'un autre hôte.
  const retry = retryHref.startsWith("/") && !retryHref.startsWith("//") ? retryHref : `/${lang}`;
  const main =
    `<div class="state-error"><p class="nf-code">${c.code}</p><h1 class="nf-title">${e(c.title)}</h1><p class="nf-lead">${e(c.lead)}</p>` +
    `<p class="state-actions"><a class="btn btn-primary" href="${e(retry)}">${c.retry}</a><a class="btn" href="/${lang}">${c.home}</a></p></div>`;
  return frame(lang, c.title, c.lead, main, o);
};
