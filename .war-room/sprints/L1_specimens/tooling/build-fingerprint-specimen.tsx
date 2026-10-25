/*
 * Builds .war-room/sprints/L1_specimens/fingerprint-mark.html from the real component and the real stylesheet, so the
 * specimen cannot drift from the code. Run from the root of the worktree (it also takes the captures):
 *   bash .war-room/sprints/L1_specimens/tooling/shoot.sh fingerprint-mark
 * The fingerprints are SHA-256 of short example sentences: no real document, no real person.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FingerprintMark,
  FingerprintStamp,
  type FingerprintMarkProps,
  type FingerprintState,
} from "../../../../apps/web/src/components/ui/fingerprint/FingerprintMark";
import { fingerprintMark, fingerprintPrefix, fullGrid, MARK_SIZES } from "../../../../packages/brand/src/fingerprint-mark";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..", "..");
const out = join(here, "..", "fingerprint-mark.html");

const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

const SAMPLES = [
  "Contrat d'exemple, version 3.",
  "Contrat d'exemple, version 3,",
  "Devis d'exemple numéro 1",
  "Procès-verbal de recette d'exemple",
  "Facture d'exemple",
  "Accord de confidentialité d'exemple",
].map((text) => ({ text, hex: sha(text) }));

const first = SAMPLES[0]!;
const comma = SAMPLES[1]!;

const STATES: readonly { readonly name: string; readonly state: FingerprintState }[] = [
  { name: "Déposé", state: { kind: "filed" } },
  { name: "À l'essai", state: { kind: "pending", word: "À signer", due: "2026-11-07" } },
  { name: "Poinçonné", state: { kind: "sealed", sentence: "Signé électroniquement sur Proofseen par les deux parties le 24 octobre 2026", date: "2026-10-24" } },
];

// React lives in apps/web: load it from there, the same copy the component's JSX resolves to.
const web = createRequire(join(root, "apps", "web", "package.json"));
const { createElement } = web("react") as typeof import("react");
const { renderToStaticMarkup } = web("react-dom/server") as typeof import("react-dom/server");
const mark = (props: FingerprintMarkProps): string => renderToStaticMarkup(createElement(FingerprintMark, props));
const stamp = (props: FingerprintMarkProps): string => renderToStaticMarkup(createElement(FingerprintStamp, props));

/** A coarser level drawn at 128 px, to see that a small mark is the large one seen from further away. */
const levelAt128 = (hex: string, nominal: number): string => {
  const g = fingerprintMark(hex, nominal);
  return `<svg class="ui-fpm" data-state="filed" viewBox="${g.viewBox}" width="128" height="128" aria-hidden="true"><path class="ui-fpm-frame" d="${g.frame}" stroke-width="${g.stroke}"/><path class="ui-fpm-cells" d="${g.cells}"/></svg>`;
};

/**
 * One cell of the states table. Under 48 px a pending mark never stands without its word (rule of the component,
 * L1-120): the drawing is taken from the real stamp, with the word written under it.
 */
const stateCell = (hex: string, size: number, state: FingerprintState): string => {
  if (state.kind !== "pending" || size > 32) return mark({ lang: "fr", fingerprint: hex, size, state });
  const drawing = /<svg[\s\S]*?<\/svg>/.exec(stamp({ lang: "fr", fingerprint: hex, size, state }))?.[0] ?? "";
  return `<div class="cell">${drawing}<span class="cap word">${state.word}</span></div>`;
};

const differingBits = (a: string, b: string): number => {
  const ga = fullGrid(a).flat();
  const gb = fullGrid(b).flat();
  return ga.filter((bit, k) => bit !== gb[k]).length;
};

const brand = readFileSync(join(root, "packages", "brand", "tokens.css"), "utf8").replace(/url\(\/fonts\//g, "url(../../../apps/web/public/fonts/");
const ui = readFileSync(join(root, "apps", "web", "src", "styles", "ui.css"), "utf8");

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Poinçon d'empreinte, spécimen L1</title>
<style>
${brand}
${ui}
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--ps-bg); color: var(--ps-text); font: 400 16px/1.6 var(--ps-font-text); }
main { padding: 40px 48px 64px; max-width: 1180px; }
h1 { margin: 0 0 8px; font: 600 40px/1.05 var(--ps-font-display); letter-spacing: -0.024em; }
h2 { margin: 48px 0 6px; font: 600 24px/1.2 var(--ps-font-display); }
p { margin: 0 0 8px; color: var(--ps-muted); max-width: 72ch; }
.kick { font: 500 12px/1.2 var(--ps-font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ps-aura-text); margin-bottom: 12px; }
table { border-collapse: collapse; margin-top: 16px; }
th, td { padding: 12px 20px 12px 0; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--ps-line); }
th { font: 500 12px/1.2 var(--ps-font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ps-faint); white-space: nowrap; }
td.src { font: 500 13px/1.4 var(--ps-font-mono); color: var(--ps-muted); max-width: 18rem; }
td.code { font: 500 13px/1.4 var(--ps-font-mono); color: var(--ps-text); white-space: nowrap; }
.bg-surface td { background: var(--ps-surface); }
.row { display: flex; gap: 32px; align-items: flex-end; flex-wrap: wrap; margin-top: 16px; }
.cell { display: grid; gap: 8px; justify-items: start; }
.cap { font: 500 12px/1.4 var(--ps-font-mono); color: var(--ps-faint); }
.cap.word { font-family: var(--ps-font-text); color: var(--ps-signal); white-space: nowrap; }
.list { list-style: none; margin: 16px 0 0; padding: 0; max-width: 900px; }
.list li { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 16px; align-items: center; justify-items: start; padding: 10px 14px; border-bottom: 1px solid var(--ps-line); background: var(--ps-surface); }
.list .doc { font-size: 15px; color: var(--ps-text); }
.cards { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
.card { width: 280px; padding: 18px; border: 1px solid var(--ps-line); border-radius: 20px; background: var(--ps-surface); display: grid; gap: 10px; }
.card b { font: 600 18px/1.2 var(--ps-font-display); }
</style>
</head>
<body>
<main>
<div class="kick">Proofseen, Légion, sprint L1, piste B</div>
<h1>Poinçon d'empreinte</h1>
<p>Un losange calculé depuis les 256 bits de l'empreinte SHA-256 d'un document. À 128 px, une grille de 16 sur 16 cases en miroir autour de l'axe vertical, comme un poinçon : chaque bit est replié (ou exclusif) dans l'une des 136 cases de la moitié droite, lues comme une page. Changer un seul bit change une case et son reflet. À 64 et 32 px, c'est le même dessin vu de plus loin : chaque case est la majorité des quatre cases qu'elle recouvre. À 16 px, le cadre et son état seulement : l'identité est portée par les seize caractères posés à côté. Un document imprimé porte le niveau 64, réduit en vecteur.</p>
<p>Empreintes d'exemple : SHA-256 de courtes phrases, aucun document réel. Le dessin aide l'oeil ; les seize caractères font foi.</p>

<h2>Six empreintes, quatre tailles</h2>
<table>
<thead><tr><th>Phrase d'exemple</th><th>Seize caractères</th>${MARK_SIZES.map((s) => `<th>${s} px</th>`).join("")}</tr></thead>
<tbody>
${SAMPLES.map(
  (s) =>
    `<tr><td class="src">${s.text}</td><td class="code">${fingerprintPrefix(s.hex)}</td>${MARK_SIZES.map((size) => `<td>${mark({ lang: "fr", fingerprint: s.hex, size })}</td>`).join("")}</tr>`,
).join("\n")}
</tbody>
</table>

<h2>Trois états, la forme avant la couleur</h2>
<p>Déposé : cadre fermé. À l'essai : le même cadre, ambre, laissé ouvert au milieu de chaque côté (14 % du côté), et son mot ; entier à 16 px. Poinçonné : à 64 et 128 px, la langue du cartouche (fond de preuve, cadre et cases verts, halo) ; à 16 et 32 px, plaque verte où les cases sont percées ; toujours avec sa phrase datée, et seulement pour un acte signé lu en base.</p>
<table>
<thead><tr><th>État</th>${MARK_SIZES.map((s) => `<th>${s} px</th>`).join("")}<th>Avec sa chaîne</th></tr></thead>
<tbody>
${STATES.map(
  (st) =>
    `<tr><td class="src">${st.name}</td>${MARK_SIZES.map((size) => `<td>${stateCell(first.hex, size, st.state)}</td>`).join("")}<td>${stamp({ lang: "fr", fingerprint: first.hex, size: 16, state: st.state })}</td></tr>`,
).join("\n")}
</tbody>
</table>

<h2>Une virgule change le dessin</h2>
<p>« ${first.text} » et « ${comma.text} » : ${differingBits(first.hex, comma.hex)} cases sur 256 diffèrent.</p>
<div class="row">
<div class="cell">${mark({ lang: "fr", fingerprint: first.hex, size: 128 })}<span class="cap">${fingerprintPrefix(first.hex)}</span></div>
<div class="cell">${mark({ lang: "fr", fingerprint: comma.hex, size: 128 })}<span class="cap">${fingerprintPrefix(comma.hex)}</span></div>
</div>

<h2>Le même dessin, vu de plus loin</h2>
<p>Les niveaux de 64 et 32 px agrandis à 128 px, à côté du dessin complet.</p>
<div class="row">
${[128, 64, 32].map((n) => `<div class="cell">${levelAt128(first.hex, n)}<span class="cap">niveau ${n} px</span></div>`).join("\n")}
</div>

<h2>En situation</h2>
<p>Une liste du coffre (16 px) et des cartes de document (32 px), sur la surface des cartes.</p>
<ul class="list">
${SAMPLES.map((s, k) => `<li><span class="doc">${s.text}</span>${stamp({ lang: "fr", fingerprint: s.hex, size: 16, state: STATES[k % 3]!.state })}</li>`).join("\n")}
</ul>
<div class="cards">
${SAMPLES.slice(2, 5).map((s, k) => `<div class="card"><b>${s.text}</b>${stamp({ lang: "fr", fingerprint: s.hex, size: 32, state: STATES[k % 3]!.state })}</div>`).join("\n")}
</div>
</main>
</body>
</html>
`;

writeFileSync(out, page);
console.log(`wrote ${out} (${page.length} bytes)`);
