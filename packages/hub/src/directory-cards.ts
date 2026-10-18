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

export const DIRECTORY_STYLES =
  ".wrap.wide{width:min(100% - 2rem,76rem)}" +
  ".dir{display:grid;gap:1.5rem 2rem;margin-top:2.2rem}" +
  "@media (min-width:62rem){.dir{grid-template-columns:17rem minmax(0,1fr);align-items:start}.dir>.drawer{position:sticky;top:1rem}}" +
  // Replié par défaut sur un téléphone ; sur grand écran, le panneau reste ouvert (sans script).
  "@media (min-width:62rem){.dir>.drawer::details-content{content-visibility:visible;display:block}.dir>.drawer>summary{cursor:default}.dir>.drawer>summary::after{content:none}}" +
  ".drawer{border:1px solid var(--line);border-radius:14px;background:var(--surface)}" +
  ".drawer>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:.6rem;min-height:2.9rem;padding:.6rem 1rem;font:600 .95rem/1.2 var(--sans)}" +
  ".drawer>summary::-webkit-details-marker{display:none}" +
  ".drawer>summary::after{content:\"+\";font:500 1.2rem/1 var(--mono);color:var(--muted)}.drawer[open]>summary::after{content:\"−\"}" +
  ".drawer>summary:focus-visible{outline:2px solid var(--focus);outline-offset:-2px;border-radius:14px}" +
  ".facets{display:grid;gap:1.1rem;padding:.2rem 1rem 1.1rem}" +
  ".facets fieldset{margin:0;padding:0;border:0;display:grid;gap:.4rem}" +
  ".facets legend,.facets .lbl{margin-bottom:.35rem;font:500 .74rem/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}" +
  ".facets input[type=text],.facets input[type=search],.facets select{width:100%;min-height:2.6rem;font:inherit;font-size:16px;color:var(--ink);background:var(--bg);border:1px solid var(--strong);border-radius:8px;padding:.4rem .6rem}" +
  ".facets input:focus-visible,.facets select:focus-visible{outline:2px solid var(--focus);outline-offset:1px}" +
  ".facets .check{display:flex;align-items:center;gap:.55rem;min-height:2rem;font-size:.95rem}" +
  ".facets .check input{width:1.1rem;height:1.1rem;accent-color:var(--accent)}" +
  ".facets .n{margin-left:auto;font:500 .78rem/1 var(--mono);color:var(--muted)}" +
  ".facets button{font:inherit;font-weight:600;cursor:pointer;border:0;border-radius:999px;min-height:2.75rem;padding:.55rem 1.1rem;background:var(--accent);color:var(--on-accent)}" +
  ".facets button:focus-visible{outline:2px solid var(--focus);outline-offset:3px}" +
  ".facets .reset{font-size:.9rem;color:var(--muted)}.facets .hint{margin-top:-.7rem;font-size:.8rem;color:var(--muted)}" +
  ".avail{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem .6rem}" +
  ".res-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.4rem 1rem;margin-bottom:1rem}" +
  ".res-head h2{margin:0}" +
  ".grid{list-style:none;margin:0;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,18.5rem),1fr))}" +
  ".pcard{position:relative;display:flex;flex-direction:column;gap:.7rem;height:100%;padding:1.2rem 1.25rem;border:1px solid var(--line);border-radius:16px;" +
  "background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 90%,var(--ink)),var(--surface) 38%);transition:border-color .2s var(--ease),transform .2s var(--ease),box-shadow .2s var(--ease)}" +
  "@media (hover:hover){.pcard:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));transform:translateY(-2px);box-shadow:0 18px 40px -28px color-mix(in srgb,var(--accent) 55%,transparent)}}" +
  ".pcard:focus-within{border-color:var(--focus)}" +
  "@media (prefers-reduced-motion:reduce){.pcard{transition:none}.pcard:hover{transform:none}}" +
  ".pc-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.85rem;align-items:center}" +
  ".avatar{width:56px;height:56px;flex:none;border-radius:50%;object-fit:cover;display:grid;place-items:center;border:1px solid var(--line);" +
  "font:600 1.05rem/1 var(--sans);letter-spacing:.04em;color:var(--ink);background:color-mix(in srgb,var(--accent) 24%,var(--surface))}" +
  ".avatar.sq{border-radius:12px}" +
  ".tone-1{background:color-mix(in srgb,var(--focus) 26%,var(--surface))}.tone-2{background:color-mix(in srgb,var(--warn) 22%,var(--surface))}" +
  ".tone-3{background:color-mix(in srgb,var(--strong) 34%,var(--surface))}.tone-4{background:color-mix(in srgb,var(--accent) 12%,var(--focus) 14%)}" +
  ".pc-name{margin:0;font:600 1.12rem/1.25 var(--serif);overflow-wrap:anywhere}.pc-name a{text-decoration:none}" +
  ".pc-name a::after{content:\"\";position:absolute;inset:0;border-radius:16px}" +
  ".pc-name a:focus-visible{outline:none}.pc-name a:focus-visible::after{outline:2px solid var(--focus);outline-offset:2px}" +
  ".pc-ref{font:500 .76rem/1.3 var(--mono);color:var(--muted)}" +
  ".pc-headline{font-size:.98rem;line-height:1.45;color:var(--ink)}" +
  ".pc-meta{display:flex;flex-wrap:wrap;gap:.25rem .9rem;color:var(--muted);font-size:.9rem}.pc-meta b{color:var(--ink);font-weight:600}" +
  ".badge{display:inline-flex;align-items:center;gap:.45rem;justify-self:start;align-self:flex-start;padding:.22rem .65rem;border:1px solid currentColor;border-radius:999px;font:500 .76rem/1.3 var(--mono)}" +
  ".badge i{width:.45rem;height:.45rem;border-radius:50%;background:currentColor}" +
  ".badge.now{color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}.badge.later{color:var(--focus)}.badge.off{color:var(--muted)}" +
  ".pcard ul.tags li{font-size:.78rem;padding:.2rem .55rem}.pcard ul.tags li.plus{color:var(--muted);border-style:dashed}" +
  ".pcard .verified{list-style:none;margin:0;padding:0;display:grid;gap:.25rem;font-size:.88rem}" +
  ".pcard .verified li{display:flex;gap:.45rem;align-items:baseline}.pcard .verified li::before{content:\"✓\";flex:none;color:var(--accent);font-weight:700}" +
  ".pc-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding-top:.75rem;border-top:1px solid var(--line);font:500 .76rem/1.3 var(--mono);color:var(--muted)}" +
  ".pc-foot .go{position:relative;z-index:1;color:var(--accent);text-decoration:none;white-space:nowrap}" +
  ".pager{display:flex;justify-content:space-between;gap:1rem;margin-top:2rem}" +
  ".next{list-style:none;margin:.75rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:.6rem}" +
  ".next a{display:inline-block;padding:.45rem .9rem;border:1px solid var(--line);border-radius:999px;text-decoration:none}";

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
