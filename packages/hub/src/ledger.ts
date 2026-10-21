import { escapeHtml as e } from "./html";

/*
 * La grammaire « registre » des pages missions, entreprises, blog et baromètres (lots e et f de la refonte), la même
 * que celle de la page de preuve d'un profil : une ligne de trace en mono (date, source, effectif), des titres en
 * PS Display, et le vert de la marque sur un seul objet, le carré plein qui précède un fait vérifié par un tiers.
 * Ce qui est déclaré ou simplement mesuré sur Proofseen porte un carré au filet, jamais de vert.
 *
 * CSS pur en jetons de la marque, aucune couleur écrite ici. Rien n'est caché (ni display:none, ni opacité nulle), le
 * survol n'existe que sous (hover:hover), chaque cible fait 44 px.
 */

export const LEDGER_STYLES = [
  // La feuille : une colonne sur un téléphone, une colonne et un rail à partir de 62 rem.
  ".sheet{width:min(100% - 2*var(--ps-gutter),var(--ps-max));margin-inline:auto;display:grid;grid-template-columns:minmax(0,1fr);column-gap:var(--ps-space-8)}",
  ".sheet>*{min-width:0}",
  ".rail{display:grid;gap:var(--ps-space-3);align-content:start;margin-top:var(--ps-space-6);padding:var(--ps-space-5) 0;border-block:1px solid var(--ps-line)}",
  ".rail .cta{width:100%;min-height:3rem;margin:0;padding-block:var(--ps-space-2);white-space:normal;text-align:center;line-height:1.3}",
  ".rail-note{color:var(--ps-muted);font-size:var(--ps-step--1)}",
  "@media (min-width:62rem){.sheet{grid-template-columns:minmax(0,1fr) 17rem;grid-template-areas:\"head rail\" \"body rail\"}" +
    ".sheet>.head{grid-area:head}.sheet>.body{grid-area:body}" +
    ".sheet>.rail{grid-area:rail;align-self:start;position:sticky;top:calc(4rem + var(--ps-space-5));margin-top:var(--ps-space-8);padding:var(--ps-space-5);border:1px solid var(--ps-line);border-radius:var(--ps-radius);background:var(--ps-surface)}}",
  // La trace : références, dates, effectifs, sources.
  ".ref{margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  ".trace{margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  ".head .title{margin-top:var(--ps-space-3);overflow-wrap:anywhere}",
  ".head .crumb{display:inline-flex;align-items:center;min-height:2.75rem}",
  // Le carré : plein et vert pour un fait vérifié par un tiers, au filet pour le reste.
  // `.pin`, pas `.sq` : l'annuaire des entreprises a déjà un `.avatar.sq` (monogramme carré).
  ".pin{flex:none;display:inline-block;width:8px;height:8px;background:var(--ps-proof)}",
  ".pin.open{background:none;border:1px solid var(--ps-line-strong)}",
  ".vline{display:flex;align-items:baseline;gap:var(--ps-space-3);margin:0}",
  ".vline.open{color:var(--ps-muted)}",
  ".legend{display:flex;flex-wrap:wrap;gap:var(--ps-space-2) var(--ps-space-6);margin-top:var(--ps-space-5);font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  // Les grands titres de partie, en PS Display, comme sur la page de preuve.
  "h2.part{display:block;margin:var(--ps-space-8) 0 var(--ps-space-3);font:var(--ps-weight-display) var(--ps-step-3)/var(--ps-lead-3) var(--ps-font-display);letter-spacing:var(--ps-track-3);text-transform:none;color:var(--ps-text)}",
  "h2.part::before{content:none}",
  ".part-note{max-width:var(--ps-measure);margin-bottom:var(--ps-space-4);color:var(--ps-muted);font-size:var(--ps-step--1)}",
  // Le contexte : des cellules séparées par des filets, la valeur en PS Display.
  ".ctx{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:var(--ps-space-6) 0 0;border-top:1px solid var(--ps-line)}",
  ".ctx div{padding:var(--ps-space-3) var(--ps-space-3) var(--ps-space-3) 0;border-bottom:1px solid var(--ps-line)}",
  ".ctx div:nth-child(even){padding-left:var(--ps-space-4);border-left:1px solid var(--ps-line)}",
  ".ctx dt{font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  ".ctx dd{margin:var(--ps-space-1) 0 0;font:var(--ps-weight-display) var(--ps-step-1)/1.3 var(--ps-font-display);overflow-wrap:anywhere}",
  "@media (min-width:48rem){.ctx{grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))}" +
    ".ctx div:nth-child(n){padding-left:var(--ps-space-4);border-left:1px solid var(--ps-line)}.ctx div:first-child{padding-left:0;border-left:0}}",
  // Une liste de faits, chacun sur sa ligne et sous un filet.
  ".lines{list-style:none;margin:0;padding:0;border-top:1px solid var(--ps-line)}",
  ".lines>li{padding:var(--ps-space-3) 0;border-bottom:1px solid var(--ps-line)}",
  // La page blanche honnête d'un état vide : ce qui manque, pourquoi, et quoi faire.
  ".blank{display:grid;gap:var(--ps-space-3);margin-top:var(--ps-space-5);padding:var(--ps-space-5);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius)}",
  ".blank-title{margin:0;font:var(--ps-weight-mono) var(--ps-step--1)/1.5 var(--ps-font-mono)}",
  ".blank>p{max-width:var(--ps-measure);color:var(--ps-muted)}",
  ".acts{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--ps-space-2) var(--ps-space-3)}",
  ".acts a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 var(--ps-space-4);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);text-decoration:none}",
  "@media (hover:hover) and (pointer:fine){.acts a:hover{border-color:var(--ps-text)}}",
  // Une fiche de liste (mission, article) : toute la carte mène au lien du titre, un seul arrêt de tabulation.
  ".entries{list-style:none;margin:0;padding:0;display:grid;gap:var(--ps-space-4)}",
  ".trace+.entries,.part-note+.entries,.trace+.lines{margin-top:var(--ps-space-4)}",
  ".entry{position:relative;display:grid;gap:var(--ps-space-2);padding:var(--ps-space-5);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius);transition:border-color var(--ps-dur-ui) var(--ps-ease-out)}",
  ".entry h3{font-size:var(--ps-step-2);line-height:var(--ps-lead-2);letter-spacing:var(--ps-track-2);overflow-wrap:anywhere}",
  ".entry h3 a{text-decoration:none}",
  ".entry h3 a::after{content:\"\";position:absolute;inset:0;border-radius:var(--ps-radius)}",
  ".entry h3 a:focus-visible{outline:none}.entry h3 a:focus-visible::after{outline:var(--ps-ring) solid var(--ps-focus);outline-offset:2px}",
  ".entry .over{position:relative;z-index:1}",
  ".entry .foot-line{margin-top:var(--ps-space-1);padding-top:var(--ps-space-3);border-top:1px solid var(--ps-line)}",
  "@media (hover:hover) and (pointer:fine){.entry:hover{border-color:var(--ps-line-strong)}.entry:hover h3 a{text-decoration:underline}}",
  ".pager{display:flex;justify-content:space-between;gap:var(--ps-space-4);margin-top:var(--ps-space-6)}",
  ".pager .crumb{display:inline-flex;align-items:center;min-height:2.75rem}",
].join("\n");

/** Le carré d'une ligne : plein (vérifié par un tiers) ou au filet. Toujours doublé d'un texte, jamais seul. */
export const square = (verified: boolean): string => `<span class="pin${verified ? "" : " open"}" aria-hidden="true"></span>`;

/** Une ligne de fait, le texte d'un seul tenant (une comparaison de chaînes sur le HTML décodé le retrouve). */
export const factLine = (text: string, verified: boolean, tag: "p" | "li" = "p"): string =>
  `<${tag} class="vline${verified ? "" : " open"}">${square(verified)}<span>${e(text)}</span></${tag}>`;

/**
 * La clé de lecture d'une liste (revue Kensa, M5) : aucune sur une liste vide, où l'état vide suffit ; le carré vert
 * seulement si un élément affiché porte un fait vérifié. Une page sans preuve n'a pas de vert.
 */
export const listLegend = (verified: string, open: string, shown: { readonly items: number; readonly anyVerified: boolean }): string =>
  shown.items === 0
    ? ""
    : `<p class="legend">${shown.anyVerified ? `<span class="vline">${square(true)}${e(verified)}</span>` : ""}<span class="vline">${square(false)}${e(open)}</span></p>`;

export interface Action {
  readonly text: string;
  readonly href: string;
}

/**
 * Un état vide honnête : ce qui manque, en mono, ce qui apparaîtra ici, et des liens utiles, les mêmes pour tous.
 * `detail` : du HTML déjà échappé par l'appelant (une jauge, une ligne de trace), placé avant les liens.
 */
export const blankState = (title: string, explanation: string, actions: readonly Action[], detail = ""): string =>
  `<div class="blank"><p class="blank-title">${square(false)} ${e(title)}</p>` +
  (explanation === "" ? "" : `<p>${e(explanation)}</p>`) +
  detail +
  (actions.length === 0 ? "" : `<ul class="acts">${actions.map((a) => `<li><a href="${e(a.href)}">${e(a.text)}</a></li>`).join("")}</ul>`) +
  "</div>";
