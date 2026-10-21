import { escapeHtml as e } from "./html";

/*
 * Ce que les annuaires publics (freelances, entreprises) partagent : la grille de cartes, l'avatar, les badges, le
 * panneau de filtres. Du HTML et du CSS seulement : aucune page de ces annuaires ne demande de JavaScript.
 *
 * L'avatar sans photo est un monogramme : les initiales du nom pour un profil nominatif ou une entreprise, les deux
 * premiers signes de la référence pour un profil pseudonyme. Sa teinte vient de la référence (tirée au hasard, jamais
 * dérivée du nom) : rien de la personne ne s'y lit.
 */

export const AVATAR_TONES = 5;

/** Une teinte stable pour une référence, parmi AVATAR_TONES. */
export const avatarTone = (seed: string): number => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  return hash % AVATAR_TONES;
};

const LETTER = /\p{L}/u;

/** Deux initiales d'un nom (« Camille Martin » → « CM ») ; « FR-ZK7M4 » → « ZK » pour une référence. */
export const monogram = (reference: string, name: string | null): string => {
  if (name !== null) {
    const initials = name
      .split(/[\s'-]+/)
      .map((word) => [...word].find((c) => LETTER.test(c)) ?? "")
      .filter((c) => c !== "")
      .slice(0, 2)
      .join("");
    if (initials !== "") return initials.toLocaleUpperCase("fr");
  }
  const code = reference.replace(/^[A-Z]{2}-/, "");
  return code.slice(0, 2).toUpperCase();
};

/** Le cadre des annuaires publics : la colonne de filtres, le panneau repliable, la grille, la pagination. */
export const DIRECTORY_FRAME_STYLES =
  ".wrap.wide{width:min(100% - 2*var(--ps-gutter),var(--ps-max))}" +
  ".dir{display:grid;gap:1.5rem 2rem;margin-top:2.2rem}" +
  "@media (min-width:62rem){.dir{grid-template-columns:17rem minmax(0,1fr);align-items:start}.dir>.drawer{position:sticky;top:1rem}}" +
  // Replié par défaut sur un téléphone ; sur grand écran, le panneau reste ouvert (sans script).
  "@media (min-width:62rem){.dir>.drawer::details-content{content-visibility:visible;display:block}.dir>.drawer>summary{cursor:default}.dir>.drawer>summary::after{content:none}}" +
  ".drawer{border:1px solid var(--ps-line);border-radius:var(--ps-radius);background:var(--ps-surface)}" +
  ".drawer>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:.6rem;min-height:2.9rem;padding:.6rem 1rem;font:600 var(--ps-step--1)/1.2 var(--ps-font-text)}" +
  ".drawer>summary::-webkit-details-marker{display:none}" +
  ".drawer>summary::after{content:\"+\";font:500 var(--ps-step-1)/1 var(--ps-font-mono);color:var(--ps-muted)}.drawer[open]>summary::after{content:\"−\"}" +
  ".drawer>summary:focus-visible{outline:2px solid var(--ps-focus);outline-offset:-2px;border-radius:var(--ps-radius)}" +
  ".facets{display:grid;gap:1.1rem;padding:.2rem 1rem 1.1rem}" +
  ".facets fieldset{margin:0;padding:0;border:0;display:grid;gap:.4rem}" +
  ".facets legend,.facets .lbl{margin-bottom:.35rem;font:500 var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ps-muted)}" +
  ".facets input[type=text],.facets input[type=search],.facets select{width:100%;min-height:2.6rem;font:inherit;font-size:max(16px,var(--ps-step-0));color:var(--ps-text);background:var(--ps-bg);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);padding:.4rem .6rem}" +
  ".facets input:focus-visible,.facets select:focus-visible{outline:2px solid var(--ps-focus);outline-offset:1px}" +
  ".facets .check{display:flex;align-items:center;gap:.55rem;min-height:2rem;font-size:var(--ps-step--1)}" +
  ".facets .check input{width:1.1rem;height:1.1rem;accent-color:var(--ps-text)}" +
  ".facets .n{margin-left:auto;font:500 var(--ps-step--2)/1 var(--ps-font-mono);color:var(--ps-muted)}" +
  ".facets .reset{font-size:var(--ps-step--1);color:var(--ps-muted)}.facets .hint{margin-top:-.7rem;font-size:var(--ps-step--2);color:var(--ps-muted)}" +
  ".grid{list-style:none;margin:0;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,18.5rem),1fr))}" +
  ".pager{display:flex;justify-content:space-between;gap:1rem;margin-top:2rem}" +
  ".next{list-style:none;margin:.75rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:.6rem}" +
  ".next a{display:inline-block;padding:.45rem .9rem;border:1px solid var(--ps-line);border-radius:var(--ps-radius);text-decoration:none}";

/*
 * La carte de l'annuaire des entreprises (lot e). L'annuaire des freelances a quitté ces règles pour la carte de
 * profil partagée avec la recherche connectée (`profile-card.ts`, `PROFILE_CARD_CSS`).
 */
const COMPANY_CARD_STYLES =
  ".avail{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem .6rem}" +
  ".res-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.4rem 1rem;margin-bottom:1rem}" +
  ".res-head h2{margin:0}" +
  ".pcard{position:relative;display:flex;flex-direction:column;gap:.7rem;height:100%;padding:1.2rem 1.25rem;border:1px solid var(--ps-line);border-radius:var(--ps-radius);" +
  "background:var(--ps-surface);transition:border-color var(--ps-dur-ui) var(--ps-ease-out)}" +
  "@media (hover:hover) and (pointer:fine){.pcard:hover{border-color:var(--ps-line-strong)}}" +
  ".pcard:focus-within{border-color:var(--ps-focus)}" +
  "@media (prefers-reduced-motion:reduce){.pcard{transition:none}}" +
  ".pc-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.85rem;align-items:center}" +
  ".avatar{width:56px;height:56px;flex:none;border-radius:50%;object-fit:cover;display:grid;place-items:center;border:1px solid var(--ps-line);" +
  "font:600 var(--ps-step-0)/1 var(--ps-font-text);letter-spacing:.04em;color:var(--ps-text);background:color-mix(in srgb,var(--ps-text) 10%,var(--ps-surface))}" +
  ".avatar.sq{border-radius:var(--ps-radius)}" +
  ".tone-1{background:color-mix(in srgb,var(--ps-focus) 26%,var(--ps-surface))}.tone-2{background:color-mix(in srgb,var(--ps-signal) 22%,var(--ps-surface))}" +
  ".tone-3{background:color-mix(in srgb,var(--ps-line-strong) 34%,var(--ps-surface))}.tone-4{background:color-mix(in srgb,var(--ps-text) 14%,var(--ps-surface))}" +
  ".pc-name{margin:0;font:600 var(--ps-step-1)/1.25 var(--ps-font-display);overflow-wrap:anywhere}.pc-name a{text-decoration:none}" +
  ".pc-name a::after{content:\"\";position:absolute;inset:0;border-radius:var(--ps-radius)}" +
  ".pc-name a:focus-visible{outline:none}.pc-name a:focus-visible::after{outline:2px solid var(--ps-focus);outline-offset:2px}" +
  ".pc-ref{font:500 var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-muted)}" +
  ".pc-headline{font-size:var(--ps-step-0);line-height:1.45;color:var(--ps-text)}" +
  ".pc-meta{display:flex;flex-wrap:wrap;gap:.25rem .9rem;color:var(--ps-muted);font-size:var(--ps-step--1)}.pc-meta b{color:var(--ps-text);font-weight:600}" +
  ".badge{display:inline-flex;align-items:center;gap:.45rem;justify-self:start;align-self:flex-start;padding:.22rem .65rem;border:1px solid currentColor;border-radius:var(--ps-radius);font:500 var(--ps-step--2)/1.3 var(--ps-font-mono)}" +
  ".badge i{width:.45rem;height:.45rem;border-radius:50%;background:currentColor}" +
  ".badge.now{color:var(--ps-text)}.badge.later{color:var(--ps-focus)}.badge.off{color:var(--ps-muted)}" +
  ".pcard ul.tags li{font-size:var(--ps-step--2);padding:.2rem .55rem}.pcard ul.tags li.plus{color:var(--ps-muted);border-style:dashed}" +
  ".pcard .verified{list-style:none;margin:0;padding:0;display:grid;gap:.25rem;font-size:var(--ps-step--1)}" +
  ".pcard .verified li{display:flex;gap:.45rem;align-items:baseline}.pcard .verified li::before{content:\"✓\";flex:none;color:var(--ps-proof);font-weight:700}" +
  ".pc-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding-top:.75rem;border-top:1px solid var(--ps-line);font:500 var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-muted)}" +
  ".pc-foot .go{position:relative;z-index:1;color:var(--ps-text);text-decoration:none;white-space:nowrap}";

/** L'annuaire des entreprises : le cadre commun et sa carte. */
export const DIRECTORY_STYLES = DIRECTORY_FRAME_STYLES + COMPANY_CARD_STYLES;

/** Un lien proposé par un annuaire vide (C23) : un texte écrit par nous et une adresse du site, jamais une donnée saisie. */
export interface NextLink {
  readonly text: string;
  readonly href: string;
}

/** Des paires (texte, chemin sous la langue) écrites dans les libellés, en liens du site. */
export const linksUnder = (lang: string, pairs: readonly (readonly [string, string])[]): readonly NextLink[] => pairs.map(([text, path]) => ({ text, href: `/${lang}/${path}` }));

/**
 * Ce que propose un annuaire vide : de simples liens, les mêmes pour chaque visiteur et chaque robot, sans JavaScript.
 * Jamais un lien d'invitation : inviter se fait depuis l'espace connecté.
 */
export const nextLinks = (title: string, links: readonly NextLink[]): string =>
  links.length === 0 ? "" : `<p class="muted">${e(title)}</p><ul class="next">${links.map((l) => `<li><a href="${e(l.href)}">${e(l.text)}</a></li>`).join("")}</ul>`;
