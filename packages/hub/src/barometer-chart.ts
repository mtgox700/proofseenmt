import { escapeHtml as e } from "./html";
import type { Lang } from "./market-shell";

/*
 * Les figures des baromètres, en SVG rendu côté serveur : quelques formes, aucun texte (les nombres sont dans le HTML
 * à côté, lisibles par tous et par les robots), aucun script, aucune couleur écrite ici. Encres neutres seulement :
 * ces chiffres sont des mesures de Proofseen, pas des faits vérifiés par un tiers, donc jamais le vert du poinçon.
 *
 * - l'intervalle : le motif de la marque pour une mesure (l'ancien symbole, BRAND_BOOK §2), du 1er au 3e quartile,
 *   la médiane en trait plein ;
 * - la barre : un compte rapporté au plus grand compte du tableau ;
 * - le seuil : combien de valeurs existent, face au minimum qui permet de publier.
 */

/** Une échelle commune à toutes les lignes d'un tableau, élargie de 5 % de chaque côté. */
export interface Scale {
  readonly lo: number;
  readonly hi: number;
}

export const scaleOf = (values: readonly number[]): Scale => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi === lo ? Math.max(1, lo * 0.05) : (hi - lo) * 0.05;
  return { lo: lo - pad, hi: hi + pad };
};

const at = (v: number, s: Scale): string => (((v - s.lo) / (s.hi - s.lo)) * 100).toFixed(2);

const svg = (cls: string, height: number, body: string): string =>
  `<svg class="${cls}" viewBox="0 0 100 ${height}" preserveAspectRatio="none" width="100%" height="${height}" aria-hidden="true" focusable="false">${body}</svg>`;

/** L'intervalle interquartile et la médiane, sur l'échelle du tableau. */
export const intervalSvg = (p25: number, median: number, p75: number, s: Scale, height = 12): string => {
  const a = at(p25, s);
  const w = (Number(at(p75, s)) - Number(a)).toFixed(2);
  const m = at(median, s);
  const mid = height / 2;
  return svg(
    "iv",
    height,
    `<line class="axis" x1="0" y1="${mid}" x2="100" y2="${mid}" vector-effect="non-scaling-stroke"/>` +
      `<rect class="iqr" x="${a}" y="${mid - height / 4}" width="${w}" height="${height / 2}"/>` +
      `<line class="med" x1="${m}" y1="0" x2="${m}" y2="${height}" vector-effect="non-scaling-stroke"/>`,
  );
};

/** Une barre proportionnelle au plus grand compte. */
export const barSvg = (value: number, max: number): string =>
  svg("bar", 10, `<rect class="fill" x="0" y="2" width="${max <= 0 ? "0" : ((value / max) * 100).toFixed(2)}" height="6"/>`);

/** Le seuil : la part déjà réunie (plafonnée au seuil) et le trait du minimum, au bout. */
export const thresholdSvg = (n: number, min: number): string =>
  svg(
    "gauge",
    10,
    `<rect class="track" x="0" y="3" width="100" height="4"/><rect class="fill" x="0" y="3" width="${min <= 0 ? "100" : (Math.min(n / min, 1) * 100).toFixed(2)}" height="4"/>` +
      `<line class="end" x1="100" y1="0" x2="100" y2="10" vector-effect="non-scaling-stroke"/>`,
  );

export const BAROMETER_STYLES =
  ".iv,.bar,.gauge{display:block;overflow:visible}" +
  ".iv .axis{stroke:var(--ps-line-strong);stroke-width:1}.iv .iqr{fill:var(--ps-muted)}.iv .med{stroke:var(--ps-text);stroke-width:3}" +
  ".bar .fill{fill:var(--ps-muted)}" +
  ".gauge .track{fill:var(--ps-line)}.gauge .fill{fill:var(--ps-muted)}.gauge .end{stroke:var(--ps-text);stroke-width:2}" +
  ".bnav{display:flex;flex-wrap:wrap;gap:var(--ps-space-2);margin-top:var(--ps-space-4)}" +
  ".bnav a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 var(--ps-space-4);border:1px solid var(--ps-line);border-radius:var(--ps-radius);color:var(--ps-muted);text-decoration:none;font-size:var(--ps-step--1)}" +
  ".bnav a[aria-current]{border-color:var(--ps-text);color:var(--ps-text)}" +
  "@media (hover:hover) and (pointer:fine){.bnav a:hover{color:var(--ps-text)}}" +
  ".head .ref{margin-top:var(--ps-space-4)}" +
  ".lede{font-size:var(--ps-step-0);line-height:1.65;max-width:var(--ps-measure)}" +
  "h3.sub{margin:var(--ps-space-6) 0 var(--ps-space-2)}" +
  ".fig+h3.sub{margin-top:var(--ps-space-7)}" +
  ".fig{margin:var(--ps-space-4) 0 0;padding:var(--ps-space-5);border:1px solid var(--ps-line);border-radius:var(--ps-radius);background:var(--ps-surface);display:grid;gap:var(--ps-space-3)}" +
  ".fig .big{margin:0;font:var(--ps-weight-display-light) var(--ps-step-4)/1 var(--ps-font-display);letter-spacing:var(--ps-track-4);font-variant-numeric:tabular-nums}" +
  ".fig .big span{font:var(--ps-weight-text) var(--ps-step-0)/1 var(--ps-font-text);letter-spacing:0;color:var(--ps-muted)}" +
  ".fig figcaption{max-width:var(--ps-measure)}" +
  "td.viz,th.viz{width:30%;min-width:7rem}" +
  "caption .trace{display:block;margin-top:var(--ps-space-1)}" +
  ".gauges{list-style:none;margin:0;padding:0;display:grid;gap:var(--ps-space-4)}" +
  ".gauges li{display:grid;gap:var(--ps-space-2)}" +
  ".data-links a{justify-content:flex-start}.data-links a::after{margin-left:auto}" +
  "tbody th{font:var(--ps-weight-strong) var(--ps-step--1)/1.3 var(--ps-font-text);letter-spacing:0;text-transform:none;color:var(--ps-text)}" +
  ".data-links small{font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-muted)}";

const NAV = {
  fr: { label: "Baromètres", rates: "TJM", skills: "Compétences demandées" },
  en: { label: "Barometers", rates: "Day rates", skills: "Skills in demand" },
} as const;

/** Les deux baromètres, l'un à côté de l'autre : l'adresse /[lang]/barometre mène au premier. */
export const barometerNav = (lang: Lang, current: "rates" | "skills"): string => {
  const l = NAV[lang];
  const link = (key: "rates" | "skills", path: string): string => `<a href="/${lang}/barometre/${path}"${current === key ? ' aria-current="page"' : ""}>${e(l[key])}</a>`;
  return `<nav class="bnav" aria-label="${l.label}">${link("rates", "tjm")}${link("skills", "competences")}</nav>`;
};
