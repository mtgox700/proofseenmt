/*
 * Builds .war-room/sprints/L1_specimens/ui-primitives.html: the primitives of components/ui composed as the Tower's
 * « Aujourd'hui » would use them, from the real components and the real stylesheets (brand tokens, chrome, base, ui).
 * Every reference, count and date is an example, said on the page, and they agree with each other (L1-091 K7): the
 * active search matches every row, the late tile has its late row, the ages are measured at the time the page states.
 * Run from the root of the worktree:
 *   bash .war-room/sprints/L1_specimens/tooling/shoot.sh ui-primitives
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FilterBar } from "../../../../apps/web/src/components/ui/filter/FilterBar";
import { FingerprintStamp } from "../../../../apps/web/src/components/ui/fingerprint/FingerprintMark";
import { Inspector } from "../../../../apps/web/src/components/ui/inspector/Inspector";
import { closeInspectorHref, inspectHref } from "../../../../apps/web/src/components/ui/inspector/inspector-url";
import { KpiGrid, MeasuredAt } from "../../../../apps/web/src/components/ui/kpi/KpiTile";
import { DataTable } from "../../../../apps/web/src/components/ui/table/DataTable";
import { parseSort, type Column } from "../../../../apps/web/src/components/ui/table/table-state";
import { Timeline } from "../../../../apps/web/src/components/ui/timeline/Timeline";
import { waited } from "../../../../apps/web/src/components/ui/when";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..", "..");
const web = createRequire(join(root, "apps", "web", "package.json"));
const { createElement: h } = web("react") as typeof import("react");
const { renderToStaticMarkup } = web("react-dom/server") as typeof import("react-dom/server");

const PATH = "/fr/app/operateur";
// The view: everything that waits, searched « FR-EX » (every example reference), sorted by deadline, ex2 inspected.
const params = { q: "FR-EX", tri: "echeance", voir: "ex2" };
const MEASURED = new Date("2026-10-24T07:42:00Z"); // 09:42 in Paris

interface Item {
  readonly id: string;
  readonly ref: string;
  readonly queue: string;
  readonly subject: string;
  readonly since: Date;
  readonly due: Date;
  readonly owner: string;
}
const ITEMS: readonly Item[] = [
  { id: "ex1", ref: "FR-EX001", queue: "Attestations", subject: "Attestation URSSAF déclarée, à vérifier par le code de sécurité", since: new Date("2026-10-22T07:42:00Z"), due: new Date("2026-10-27T16:00:00Z"), owner: "Libre" },
  { id: "ex2", ref: "FR-EX002", queue: "Signatures", subject: "Enveloppe expirée, 1 signature sur 2", since: new Date("2026-10-24T06:13:00Z"), due: new Date("2026-10-25T09:00:00Z"), owner: "Vous" },
  { id: "ex3", ref: "FR-EX003", queue: "Versements", subject: "Versement à revoir, fonds retenus après l'échéance", since: new Date("2026-10-21T07:42:00Z"), due: new Date("2026-10-23T16:00:00Z"), owner: "Libre" },
];
const day = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(d);
const COLUMNS: readonly Column<Item>[] = [
  { key: "ref", label: "Référence", cell: (r) => r.ref, sortBy: (r) => r.ref, rowHeader: true },
  { key: "file", label: "File", cell: (r) => r.queue, sortBy: (r) => r.queue, card: "label" },
  { key: "sujet", label: "Sujet", cell: (r) => r.subject, truncate: true, card: "body" },
  { key: "age", label: "Âge", cell: (r) => waited(r.since, MEASURED, "fr"), sortBy: (r) => -r.since.getTime(), numeric: true, card: "aside" },
  {
    key: "echeance",
    label: "Échéance",
    cell: (r) => (r.due < MEASURED ? h("span", { className: "spec-late" }, `En retard, ${day(r.due)}`) : day(r.due)),
    sortBy: (r) => r.due,
    numeric: true,
    card: "end",
  },
  { key: "pris", label: "Pris par", cell: (r) => r.owner },
];

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const fingerprint = createHash("sha256").update("Contrat d'exemple, version 3.", "utf8").digest("hex");

const kpis = html(
  h(KpiGrid, {
    lang: "fr",
    label: "Files de revue",
    measuredAt: MEASURED,
    tiles: [
      { label: "Signatures", value: 1, definition: "Enveloppes bloquées : expirées, trop d'essais de code, ou contestées.", oldestSince: ITEMS[1]!.since, href: "#" },
      { label: "Attestations", value: 1, definition: "Attestations URSSAF déclarées qu'aucun opérateur n'a encore vérifiées.", oldestSince: ITEMS[0]!.since, href: "#" },
      { label: "Versements", value: 1, definition: "Paiements marqués à revoir, ou fonds retenus après leur échéance.", oldestSince: ITEMS[2]!.since, overdue: 1, href: "#" },
      { label: "Modération", value: 0, definition: "Contenus signalés par un utilisateur et pas encore tranchés.", href: "#" },
    ],
  }),
);

const filter = html(
  h(FilterBar, {
    lang: "fr",
    id: "flt",
    path: PATH,
    params,
    keep: ["tri"],
    fields: [
      { kind: "search", name: "q", label: "Référence ou empreinte", hint: "Une référence (FR-EX001) ou les seize premiers caractères d'une empreinte." },
      {
        kind: "select",
        name: "file",
        label: "File",
        anyLabel: "Toutes",
        options: [
          { value: "attestations", label: "Attestations" },
          { value: "signatures", label: "Signatures" },
          { value: "versements", label: "Versements" },
        ],
      },
    ],
    views: [
      { label: "Tout ce qui attend", href: PATH, current: true },
      { label: "Pris par moi", href: `${PATH}?pris=moi` },
      { label: "En retard", href: `${PATH}?retard=1` },
    ],
  }),
);

// One box checked, to show the checked state: the page's batch form would hold it.
const table = html(
  h(DataTable<Item>, {
    lang: "fr",
    id: "today",
    caption: "Ce qui attend une décision",
    columns: COLUMNS,
    rows: ITEMS,
    rowKey: (r) => r.id,
    rowHref: (r) => inspectHref(PATH, params, r.id),
    current: "ex2",
    path: PATH,
    params,
    sort: parseSort(params, COLUMNS),
    selection: { formId: "lot", name: "ids", label: (r) => `Sélectionner ${r.ref}` },
    empty: "Rien n'attend.",
    pages: { summary: "1 à 3 sur 3" },
  }),
).replace('value="ex1"/>', 'value="ex1" checked=""/>');

const cancel = h(
  "details",
  { className: "ui-confirm" },
  h("summary", { className: "btn ui-danger" }, "Annuler l'enveloppe"),
  h(
    "form",
    { method: "post", action: "#" },
    h("label", { htmlFor: "motif" }, "Motif de l'annulation (obligatoire)"),
    h("textarea", { id: "motif", name: "motif", required: true }),
    h("button", { type: "submit", className: "btn ui-danger" }, "Confirmer l'annulation"),
  ),
);

const inspector = html(
  h(
    Inspector,
    {
      lang: "fr",
      id: "insp-ex2",
      title: "Signature de FR-EX002",
      meta: "File Signatures, prise par vous. Enveloppe expirée le 24 octobre 2026 à 08:13.",
      closeHref: closeInspectorHref(PATH, params),
      actions: h("div", { className: "spec-actions" }, h("a", { className: "btn btn-primary", href: "#" }, "Relancer le signataire"), cancel),
    },
    h("div", { className: "spec-doc" }, h("p", { className: "spec-k" }, "Document"), h("p", null, "Contrat d'exemple, version 3"), h(FingerprintStamp, { lang: "fr", fingerprint, size: 32, subject: "du contrat, version 3", state: { kind: "pending", word: "1 signature sur 2" } })),
    h(Timeline, {
      lang: "fr",
      label: "Historique de l'enveloppe",
      events: [
        { id: "t1", at: "2026-10-17T06:12:00Z", title: "Contrat figé, empreinte calculée", actor: "Système" },
        { id: "t2", at: "2026-10-17T06:13:00Z", title: "Envoyé aux deux signataires", actor: "Entreprise" },
        { id: "t3", at: "2026-10-17T12:03:00Z", title: "Signé par l'entreprise", actor: "Entreprise" },
        { id: "t4", at: "2026-10-24T06:13:00Z", title: "Délai de signature dépassé", actor: "Système", status: { word: "Expirée", tone: "danger" }, detail: "Le freelance n'a pas signé dans les 7 jours" },
      ],
      upcoming: [{ id: "u1", title: "Signature du freelance", when: "après une relance" }],
    }),
  ),
);

const brand = readFileSync(join(root, "packages", "brand", "tokens.css"), "utf8").replace(/url\(\/fonts\//g, "url(../../../apps/web/public/fonts/");
const sheets = [join(root, "packages", "brand", "chrome.css"), join(root, "apps", "web", "src", "styles", "base.css"), join(root, "apps", "web", "src", "styles", "ui.css")].map((f) => readFileSync(f, "utf8")).join("\n");

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aujourd'hui, Tour de contrôle (spécimen L1)</title>
<style>
${brand}
${sheets}
main { padding: 24px clamp(16px, 3vw, 32px) 48px; max-width: 1320px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.spec-head { display: grid; gap: 4px; }
.spec-where { color: var(--ps-muted); font-size: var(--ps-step--1); }
.spec-head h1 { font-size: var(--ps-step-3); line-height: var(--ps-lead-3); letter-spacing: var(--ps-track-3); }
.spec-note { color: var(--ps-muted); font-size: var(--ps-step--2); }
.spec-doc { display: grid; gap: 6px; }
.spec-k { font: 500 12px/1.3 var(--ps-font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ps-muted); }
.spec-actions { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
.spec-late { color: var(--ps-signal); font-weight: 600; }
</style>
</head>
<body>
<main>
<div class="spec-head">
<p class="spec-where">Tour de contrôle</p>
<h1>Aujourd'hui</h1>
${html(h(MeasuredAt, { lang: "fr", at: MEASURED }))}
<p class="spec-note">Spécimen L1 : données d'exemple (références FR-EX), aucun compte, aucune mesure réelle.</p>
</div>
${kpis}
${filter}
<div class="ui-split">
${table}
${inspector}
</div>
</main>
</body>
</html>
`;

const out = join(here, "..", "ui-primitives.html");
writeFileSync(out, page);
console.log(`wrote ${out} (${page.length} bytes)`);
