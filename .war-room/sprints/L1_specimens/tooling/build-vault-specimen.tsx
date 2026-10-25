/*
 * Builds the specimens of the vault's screens (storyboard L1.6, T15) from the real components and the real
 * stylesheets: E1 (S3 and S5, the latter inking, M1), E2 with its error summary, E4, E5 (and E5 in grey), E6.
 * The pages need a database and a session; the specimens compose the same components with example data, said on each
 * page: fictive parties (« Exemple »), fingerprints of example texts, dates of October 2026. Not a real account.
 * Run from the root of the worktree:
 *   bash .war-room/sprints/L1_specimens/tooling/shoot-vault.sh
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRegistry, ENGINE_ID, renderTemplate, type DocumentModel, type LoadedTemplate } from "../../../../packages/documents/src/index";
import type { ContractDetail, DocumentDetail, DocumentSummary, VersionSummary } from "../../../../packages/db/src/index";
import { AffairHead } from "../../../../apps/web/src/components/vault/AffairHead";
import { AffairTabs, SectionTabs } from "../../../../apps/web/src/components/vault/AffairTabs";
import { AllDocumentsTable } from "../../../../apps/web/src/components/vault/AllDocumentsTable";
import { ChangeSummary } from "../../../../apps/web/src/components/vault/ChangeSummary";
import { ClauseDiff, SameClauses, type ClauseView } from "../../../../apps/web/src/components/vault/ClauseDiff";
import { CompareHead } from "../../../../apps/web/src/components/vault/CompareHead";
import { DiffLegend } from "../../../../apps/web/src/components/vault/DiffLegend";
import { Digests } from "../../../../apps/web/src/components/vault/Digests";
import { DocumentCard } from "../../../../apps/web/src/components/vault/DocumentCard";
import { DocumentRail } from "../../../../apps/web/src/components/vault/DocumentRail";
import { DocumentView } from "../../../../apps/web/src/components/vault/DocumentView";
import { PrepareForm } from "../../../../apps/web/src/components/vault/PrepareForm";
import { VaultState } from "../../../../apps/web/src/components/vault/VaultState";
import { dealsFr } from "../../../../apps/web/src/i18n/market/deals-fr";
import { vaultFr } from "../../../../apps/web/src/i18n/market/vault-fr";
import { attribute, type ChainLink } from "../../../../apps/web/src/lib/vault/attribution";
import { choiceGroups, initialDraft, legendOf } from "../../../../apps/web/src/lib/vault/choices";
import { compareModels, groupIdentical } from "../../../../apps/web/src/lib/vault/compare";
import { explainChanges } from "../../../../apps/web/src/lib/vault/explain";
import { demoContract } from "../../../../packages/documents/test/support/demo";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..", "..");
const web = createRequire(join(root, "apps", "web", "package.json"));
const { createElement: h } = web("react") as typeof import("react");
const { renderToStaticMarkup } = web("react-dom/server") as typeof import("react-dom/server");
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const lang = "fr" as const;
const t = vaultFr;

const CONTRACT_ID = "00000000-0000-4000-8000-0000000000c1";
const DOC_ID = "00000000-0000-4000-8000-0000000000d1";
const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const groups = choiceGroups(template.decl, lang, t.prepare);

const contract = {
  id: CONTRACT_ID,
  side: "company",
  status: "pending_signatures",
  counterpart: "Studio Exemple",
  totalCents: 300_000,
  currency: "EUR",
  startsOn: new Date("2026-11-02T00:00:00Z"),
  seller: { legalName: "Studio Exemple, Łukasz Nguyễn-Dvořák EI", siret: null },
  buyer: { legalName: "Société Exemple Çağrı & Fils SAS", siret: null },
  dailyRateCents: 50_000,
  days: 6,
  billing: "fixed",
  repeatClient: false,
  commissionBp: 1000,
  scope: "Refonte de l'espace client d'une application de réservation : audit de l'existant, maquettes, intégration responsive et recette avec l'équipe du Client.",
  deliverables: ["Audit de l'existant remis sous forme d'un rapport de dix pages au plus", "Maquettes validées de six écrans, au format source et en export", "Code des écrans intégrés, livré sur le dépôt du Client"],
  endsOn: new Date("2026-12-18T00:00:00Z"),
  costCenter: null,
  signedByFreelanceAt: null,
  signedByCompanyAt: null,
  role: "owner",
  approvals: { count: 0, mine: false, required: 1 },
  conversationId: null,
  reviewed: false,
} as unknown as ContractDetail;

// Two versions of the reference contract: version 1 by the company, version 2 by the freelancer (20 days, non-solicitation).
const model = (overrides: Record<string, unknown>, number: number, optional: Record<string, "included" | "excluded"> = {}): DocumentModel => {
  const out = renderTemplate("service-agreement", template.decl.version, "fr", demoContract({ "document.versionNumber": number, "document.issuedOn": `2026-10-2${3 + number}`, ...overrides }), { optionalClauses: optional });
  if (!out.ok) throw new Error(out.error.code);
  return out.value;
};
const v1Values = { "input.workMode": "remote" };
const v2Values = { "input.workMode": "remote", "input.acceptanceWindowDays": 20, "input.nonSolicitationMonths": 6 };
const m1 = model(v1Values, 1);
const m2 = model(v2Values, 2, { "non-solicitation": "included" });

const version = (number: number, m: DocumentModel, by: VersionSummary["by"], side: VersionSummary["side"], reason: string, at: string, size: number): VersionSummary => ({
  number,
  sha256: hex(`Fichier PDF d'exemple, version ${number}.`),
  contentDigest: m.contentDigest,
  size,
  contentType: "application/pdf",
  templateVersion: String(m.templateVersion),
  engine: "proofseen-documents@1",
  reason,
  createdAt: new Date(at),
  by,
  side,
});
const V1 = version(1, m1, "you", "company", "première version", "2026-10-24T12:02:00Z", 402_310);
const V2 = version(2, m2, "other_party", "freelance", "Délai de recette porté à 20 jours", "2026-10-25T08:41:00Z", 421_904);
const detail: DocumentDetail = { id: DOC_ID, affair: { kind: "contract", id: CONTRACT_ID }, type: "service_agreement", slot: 1, templateId: "service-agreement", lang: "fr", createdAt: V1.createdAt, versionCount: 2, latest: V2, versions: [V2, V1] };

const head = (title: string, where: string) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} (spécimen L1)</title>
<style>
${readFileSync(join(root, "packages", "brand", "tokens.css"), "utf8").replace(/url\(\/fonts\//g, "url(../../../apps/web/public/fonts/")}
${["packages/brand/chrome.css", "apps/web/src/styles/tokens.css", "apps/web/src/styles/base.css", "apps/web/src/styles/states.css", "apps/web/src/styles/workspace.css", "apps/web/src/styles/market.css", "apps/web/src/styles/app-affaire.css", "apps/web/src/styles/ui.css", "apps/web/src/styles/vault.css"].map((f) => readFileSync(join(root, f), "utf8")).join("\n")}
main.spec { padding: 24px clamp(16px, 3vw, 32px) 48px; max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
.spec-where { color: var(--ps-muted); font: 500 12px/1.3 var(--ps-font-mono); letter-spacing: .06em; text-transform: uppercase; }
.spec-note { color: var(--ps-muted); font-size: var(--ps-step--2); }
</style>
</head>
<body>
<main class="spec">
<p class="spec-where">${where}</p>
`;
const foot = `<p class="spec-note">Spécimen L1 : données d'exemple (parties « Exemple », empreintes de textes d'exemple, dates d'octobre 2026), rendues par les composants réels du coffre. Pas un compte réel ; l'en-tête et le menu de l'espace ne sont pas dessinés ici.</p>
</main>
</body>
</html>
`;
const out = join(here, "..", "vault");
mkdirSync(out, { recursive: true });
const write = (name: string, body: string, title: string, where: string) => {
  const page = head(title, where) + body + foot;
  writeFileSync(join(out, `${name}.html`), page);
  console.log(`wrote vault/${name}.html (${page.length} bytes)`);
};
const affair = (body: string, count = 1) =>
  html(h(AffairHead, { lang, deals: dealsFr, contract })) +
  html(h(AffairTabs, { lang, contractId: CONTRACT_ID, current: "documents", count, open: true })) +
  `<section class="vault-section"><h2>${t.affair.title}</h2><p class="vault-lead">${t.affair.lead}</p>${body}</section>`;

// E1, S3: empty, preparable.
write("e1-s3", `<div class="vault-page">${affair(html(h(VaultState, { lang, state: { kind: "empty-preparable" }, side: "company", affairHref: "#", prepareHref: "#", retryHref: "#" })), 0)}</div>`, "Documents de l'affaire, vide", "E1 · S3 · /fr/app/contrats/[id]/documents");
// E1, S2a: accepted without a scope.
write("e1-s2a", `<div class="vault-page">${affair(html(h(VaultState, { lang, state: { kind: "no-scope-accepted" }, side: "company", affairHref: "#", prepareHref: "#", retryHref: "#" })), 0)}</div>`, "Documents de l'affaire, sans objet", "E1 · S2a");
// E1, S5: the list, version 2 just filed by « vous » (the specimen reads as the freelancer for this one).
const asFreelancer: DocumentDetail = { ...detail, latest: { ...V2, by: "you" }, versions: [{ ...V2, by: "you" }, { ...V1, by: "other_party" }] };
write(
  "e1-s5",
  `<div class="vault-page">${affair(
    `<p class="vault-status" role="status">${t.card.deposited(2, V2.contentDigest.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 "))}</p><div class="vault-cards">${html(h(DocumentCard, { lang, document: asFreelancer, inking: 2, underReview: true, prepareHref: "#", closedLine: null }))}</div>`,
  )}</div>`,
  "Documents de l'affaire, deux versions",
  "E1 · S5 · M1 en cours (encre)",
);
// E2 with errors: two choices missing.
const values = { ...initialDraft(template.decl, groups, null), "input.workMode": "remote", "input.processesPersonalData": "false" };
write(
  "e2-errors",
  `<div class="vault-page"><header class="app-head"><h1>${t.prepare.title(1)}</h1><p class="muted small">Studio Exemple</p></header><p class="vault-lead">${t.prepare.lead}</p>${html(
    h(PrepareForm, {
      lang,
      action: async () => {},
      contractId: CONTRACT_ID,
      documentId: null,
      next: 1,
      facts: [
        { label: t.prepare.facts.provider, value: contract.seller.legalName },
        { label: t.prepare.facts.client, value: contract.buyer.legalName },
        { label: t.prepare.facts.scope, value: contract.scope },
        { label: t.prepare.facts.deliverables, value: h("ul", null, ...contract.deliverables.map((d, i) => h("li", { key: i }, d))) },
        { label: t.prepare.facts.price, value: dealsFr.quotes.line("500,00 €", 6, "3 000,00 €") },
        { label: t.prepare.facts.dates, value: "à partir du 2 novembre 2026 au 18 décembre 2026" },
        { label: t.prepare.facts.commission, value: t.prepare.commission(`10${String.fromCharCode(0x202f)}%`, t.prepare.payers.freelance) },
      ],
      groups,
      values,
      problems: [
        { name: "input.ipRegime", kind: "choose" },
        { name: "input.confidentialityYears", kind: "number" },
        { name: "input.subcontractingAllowed", kind: "choose" },
      ],
      missingFacts: [],
      refusal: null,
      message: null,
      cancelHref: "#",
    }),
  )}</div>`,
  "Préparer le contrat de prestation, erreurs",
  "E2 · le formulaire revenu du serveur, trois choix manquants",
);
// E4: the document, version 2.
write(
  "e4",
  `<div class="vault-page vault-doc"><p><a class="back-link" href="#"><span aria-hidden="true">←&nbsp;</span>${t.document.back}</a></p><header class="vault-doc-head"><h1>Contrat de prestation</h1><p class="vault-meta">${t.document.line(2, 2, "25 octobre 2026 à 10:41", "le freelance")}</p></header><div class="vault-doc-body">${html(
    h(DocumentRail, { lang, document: detail, version: V2, clauses: m2.clauses, article: t.document.article }),
  )}<div class="vault-article-wrap">${html(h(DocumentView, { model: m2, article: t.document.article, footer: t.document.footer(V2.contentDigest.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ")), label: t.document.textLabel }))}</div>${html(
    h(Digests, { lang, contentDigest: V2.contentDigest, sha256: V2.sha256, fileName: "contrat-de-prestation-v2.pdf" }),
  )}</div></div>`,
  "Contrat de prestation, version 2",
  "E4 · /fr/app/documents/[id]?version=2",
);
// E4, « Vérifier ce document » opened, and the footer of the text: the case decided in L1-147 (content in capitals,
// file in lower case).
write(
  "e4-verifier",
  `<div class="vault-page vault-doc">${html(h(Digests, { lang, contentDigest: V2.contentDigest, sha256: V2.sha256, fileName: "contrat-de-prestation-v2.pdf" })).replace("<details", "<details open")}<p class="vault-footer">${t.document.footer(V2.contentDigest.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 "))}</p></div>`,
  "Vérifier ce document",
  "E4 · « Vérifier ce document » ouvert, et le pied du texte",
);
// E5: the comparison of 1 and 2.
const comparison = compareModels(m1, m2);
const values1 = Object.fromEntries(Object.entries(m1.variables).map(([k, v]) => [k, v.value]));
const values2 = Object.fromEntries(Object.entries(m2.variables).map(([k, v]) => [k, v.value]));
const explanation = explainChanges({
  lang,
  template,
  older: { number: 1, templateVersion: m1.templateVersion, values: values1, optionalClauses: {}, model: m1 },
  newer: { number: 2, templateVersion: m2.templateVersion, values: values2, optionalClauses: { "non-solicitation": "included" }, model: m2 },
  comparison,
  t: t.compare,
  legendOf: (name) => legendOf(groups, name),
});
const chain: ChainLink[] = [
  { number: 1, by: "vous", values: values1, optionalClauses: {} },
  { number: 2, by: "le freelance", values: values2, optionalClauses: { "non-solicitation": "included" } },
];
const v: ClauseView = { lang, article: t.document.article, addedOn: "2026-10-25T08:41:00Z", removedOn: "2026-10-24T12:02:00Z", view: "texte" };
const changes = comparison.clauses.filter((c) => c.kind !== "identical");
const e5 =
  html(h(CompareHead, { lang, type: "service_agreement", older: V1, newer: V2 })) +
  html(h(ChangeSummary, { lang, changes: explanation.changes, attributionOf: (c) => (c.key === null ? null : attribute(c.key, chain)), role: "client" })) +
  html(h(DiffLegend, { lang, clauses: comparison.clauses })) +
  `<section class="vault-diffs"><h2>${t.compare.byClause}</h2>${groupIdentical(comparison.clauses)
    .map((group) => {
      if (group.kind === "identical") return html(h(SameClauses, { v, group }));
      const index = changes.findIndex((c) => c.clause.id === group.diff.clause.id);
      const next = changes[index + 1];
      return html(h(ClauseDiff, { v, diff: group.diff, byModel: false, next: next === undefined ? null : { id: next.clause.id, number: next.clause.number, heading: next.clause.heading } }));
    })
    .join("")}</section>`;
write("e5", `<div class="vault-page vault-compare">${e5}</div>`, "Ce qui a changé entre la version 1 et la version 2", "E5 · /fr/app/documents/[id]/comparer?de=1&a=2");
write("e5-gris", `<div class="vault-page vault-compare" style="filter: grayscale(1)">${e5}</div>`, "Comparaison en niveaux de gris", "E5 · la couleur retirée (niveaux de gris)");
// E6: all my documents.
const others: DocumentSummary[] = [
  { ...detail, latest: V2 },
  { id: "00000000-0000-4000-8000-0000000000d2", affair: { kind: "contract", id: "00000000-0000-4000-8000-0000000000c2" }, type: "service_agreement", slot: 1, templateId: "service-agreement", lang: "fr", createdAt: new Date("2026-10-20T09:00:00Z"), versionCount: 1, latest: { ...V1, number: 1, contentDigest: hex("Autre contrat d'exemple."), createdAt: new Date("2026-10-20T09:00:00Z") } },
];
const names = new Map([[CONTRACT_ID, "Studio Exemple"], ["00000000-0000-4000-8000-0000000000c2", "Atelier Exemple"]]);
write(
  "e6",
  `<div class="vault-page">${html(h(SectionTabs, { lang, current: "documents", open: true }))}<header class="app-head"><h1>${t.all.title}</h1><p class="vault-lead">${t.all.lead}</p></header>${html(
    h(AllDocumentsTable, { lang, path: "/fr/app/documents", params: {}, items: others, affairName: (d) => (d.affair.kind === "contract" ? (names.get(d.affair.id) ?? null) : null), types: ["service_agreement"], sort: { key: "depose", direction: "descending" }, total: 2, page: 1, pages: 1, pageSize: 50, filtered: false, error: false }),
  )}</div>`,
  "Documents",
  "E6 · /fr/app/documents",
);
console.log(`E5 HTML: ${Buffer.byteLength(e5, "utf8")} bytes of body for a comparison of the reference contract`);

// T14: the server's work for one comparison of the reference contract, measured (never assumed): both versions
// replayed and verified, the clauses compared, « En bref » computed. Twenty runs on this machine, the median.
const { previewVersion } = await import("../../../../apps/web/src/lib/vault/replay");
const stored = (m: DocumentModel, optionalClauses: Record<string, "included" | "excluded">) => ({
  templateId: m.templateId,
  templateVersion: String(m.templateVersion),
  engine: ENGINE_ID,
  contentDigest: m.contentDigest,
  variables: { language: m.language, issuedOn: m.issuedOn, contentDigest: m.contentDigest, templateDigest: m.templateDigest, hypotheses: m.hypotheses, optionalClauses, reviewNotice: m.reviewNotice !== null, values: Object.fromEntries(Object.entries(m.variables).map(([k, x]) => [k, x.value])) },
});
const runs: number[] = [];
for (let i = 0; i < 20; i += 1) {
  const start = performance.now();
  const a = previewVersion(stored(m1, {}));
  const b = previewVersion(stored(m2, { "non-solicitation": "included" }));
  if (a.kind !== "ready" || b.kind !== "ready") throw new Error(`replay refused: ${a.kind === "unavailable" ? a.code : ""} ${b.kind === "unavailable" ? b.code : ""}`);
  const cmp = compareModels(a.model, b.model);
  explainChanges({ lang, template, older: { number: 1, templateVersion: 1, values: values1, optionalClauses: {}, model: a.model }, newer: { number: 2, templateVersion: 1, values: values2, optionalClauses: { "non-solicitation": "included" }, model: b.model }, comparison: cmp, t: t.compare, legendOf: (name) => legendOf(groups, name) });
  runs.push(performance.now() - start);
}
runs.sort((x, y) => x - y);
console.log(`E5 server work: median ${runs[10]?.toFixed(1)} ms, min ${runs[0]?.toFixed(1)} ms, max ${runs[19]?.toFixed(1)} ms over 20 runs`);
