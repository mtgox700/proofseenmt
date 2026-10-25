import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRegistry, renderTemplate, type DocumentModel, type LoadedTemplate } from "@proofseen/documents";
import type { DocumentDetail, VersionSummary } from "@proofseen/db";
import { describe, expect, it } from "vitest";
import { ChoiceField } from "../src/components/vault/ChoiceField";
import { ClauseDiff, type ClauseView } from "../src/components/vault/ClauseDiff";
import { DiffLegend } from "../src/components/vault/DiffLegend";
import { Digests } from "../src/components/vault/Digests";
import { DocumentCard } from "../src/components/vault/DocumentCard";
import { DocumentRail } from "../src/components/vault/DocumentRail";
import { PrepareForm } from "../src/components/vault/PrepareForm";
import { vaultEn } from "../src/i18n/market/vault-en";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { acceptanceLine } from "../src/lib/vault/acceptance";
import { choiceGroups, legendOf } from "../src/lib/vault/choices";
import { compareModels } from "../src/lib/vault/compare";
import { downloadFallback, isNavigation } from "../src/lib/vault/download-fallback";
import { explainChanges } from "../src/lib/vault/explain";
import { fileName } from "../src/lib/vault/file-name";
import { defaultReason } from "../src/lib/vault/versions";
import { demoContract } from "../../../packages/documents/test/support/demo";

/*
 * L1-159: what Kensa measured on the vault, each defect pinned by a test before its fix. Example data only.
 */

const N = String.fromCharCode(0x202f);
const html = (node: ReactElement) => renderToStaticMarkup(node);
const hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const web = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const css = readFileSync(join(web, "styles", "vault.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const ID = "00000000-0000-4000-8000-0000000000d1";

const version = (number: number): VersionSummary => ({
  number,
  sha256: hex(`fichier ${number}`),
  contentDigest: hex(`Exemple ${number}`),
  size: 421_000,
  contentType: "application/pdf",
  templateVersion: "1",
  engine: "proofseen-documents/1",
  reason: "première version",
  createdAt: new Date(`2026-10-2${number + 1}T12:02:00Z`),
  by: "you",
  side: "company",
});
const detail = (count: number): DocumentDetail => {
  const versions = Array.from({ length: count }, (_, i) => version(count - i));
  return { id: ID, affair: { kind: "contract", id: "00000000-0000-4000-8000-0000000000c1" }, type: "service_agreement", slot: 1, templateId: "service-agreement", lang: "fr", createdAt: versions[versions.length - 1]!.createdAt, versionCount: count, latest: versions[0]!, versions };
};
const render = (overrides: Record<string, unknown> = {}, number = 1): DocumentModel => {
  const out = renderTemplate("service-agreement", template.decl.version, "fr", demoContract({ "document.versionNumber": number, ...overrides }));
  if (!out.ok) throw new Error(out.error.code);
  return out.value;
};

describe("B2: « Vérifier ce document » never widens the page", () => {
  it("gives its grid a shrinking column and lets long commands wrap", () => {
    expect(css).toMatch(/\.vault-digests[^{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/\.vault-digests dl[^{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/\.vault-command[^{]*\{[^}]*white-space:\s*pre-wrap/);
  });
});

describe("B3: radio groups hold no list item", () => {
  const groups = choiceGroups(template.decl, "fr", vaultFr.prepare, "fixed");
  it("draws a group of radios as a div, its options as divs", () => {
    const field = groups[0]!.fields[0]!;
    const out = html(createElement(ChoiceField, { lang: "fr", field, value: undefined, problem: undefined }));
    expect(out).toMatch(/<div class="vault-choices" role="radiogroup"/);
    expect(out).not.toContain("<li");
    expect(out).not.toContain("<ul");
  });
  it("does the same for the language of the document", () => {
    const out = html(createElement(PrepareForm, { lang: "fr", action: async () => {}, contractId: "c1", documentId: null, next: 1, facts: [], groups, values: {}, problems: [], missingFacts: [], refusal: null, message: null, cancelHref: "#" }));
    expect(out).not.toMatch(/<ul[^>]*role="radiogroup"/);
    expect(out).not.toMatch(/role="radiogroup"[^>]*>\s*<li/);
  });
});

describe("B4: a failed download shows the page, a good one keeps the PDF's name", () => {
  it("has no `download` attribute: the browser follows the 303 to the page instead of saving it as a PDF", () => {
    const out = html(createElement(DocumentCard, { lang: "fr", document: detail(2), inking: null, underReview: true, prepareHref: null, closedLine: null }));
    expect(out).not.toMatch(/\sdownload=/);
  });
  it("counts as a navigation only a document request of the browser", () => {
    const url = `https://exemple.test/api/documents/${ID}/versions/2`;
    expect(isNavigation(new Request(url, { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" } }))).toBe(true);
    expect(isNavigation(new Request(url, { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "iframe" } }))).toBe(false);
    expect(isNavigation(new Request(url, { headers: { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" } }))).toBe(false);
    const failed = new Response("{}", { status: 500 });
    expect(downloadFallback(new Request(url, { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" } }), failed, ID, "2").status).toBe(303);
  });
  it("names the file by its type, its version and the first eight characters of its content fingerprint", () => {
    expect(fileName("service_agreement", 3, "6763A4FEdeadbeef")).toBe("contrat-de-prestation-v3-6763a4fe.pdf");
    const vault = readFileSync(join(web, "app", "api", "documents", "vault.ts"), "utf8");
    expect(vault).not.toMatch(/const FILE_NAMES/);
  });
});

describe("M4: « Vérifier » says what the paper prints and what to compare", () => {
  it("says sixteen characters are printed, and compares the command's output to the file fingerprint above", () => {
    const out = html(createElement(Digests, { lang: "fr", contentDigest: hex("a"), sha256: hex("b"), fileName: "contrat-de-prestation-v2-ca978112.pdf" }));
    expect(out).toContain("seize premiers caractères");
    expect(out).toContain("identique à l&#x27;empreinte du fichier ci-dessus");
  });
});

describe("M5: an acceptance by one party only is said with who and when", () => {
  const base = { status: "pending_signatures" as const, billing: "fixed" as const, scope: "x", side: "company" as const };
  it("names who accepted, the day, and who has not yet", () => {
    const line = acceptanceLine({ ...base, signedByFreelanceAt: new Date("2026-10-25T09:00:00Z"), signedByCompanyAt: null }, "fr", 3);
    expect(line).toBe(`Plus de nouvelle version${N}: le contrat a été accepté par le freelance le 25 octobre 2026${N}; vous ne l'avez pas encore accepté. Le texte rédigé le plus récent est la version 3.`);
  });
  it("says both acceptances once both parties accepted", () => {
    const line = acceptanceLine({ ...base, status: "active", signedByFreelanceAt: new Date("2026-10-25T09:00:00Z"), signedByCompanyAt: new Date("2026-10-26T09:00:00Z") }, "fr", 3);
    expect(line).toBe(`Plus de nouvelle version${N}: le contrat a été accepté par le freelance le 25 octobre 2026, puis par vous le 26 octobre 2026. Le texte rédigé le plus récent est la version 3.`);
  });
  it("says nothing while nobody has accepted", () => {
    expect(acceptanceLine({ ...base, signedByFreelanceAt: null, signedByCompanyAt: null }, "fr", 3)).toBeNull();
  });
});

describe("M6, M7, M9: movement, disclosure marks, the rail", () => {
  it("moves only the poinçon in M2, never the texts", () => {
    expect(css).toMatch(/\.vault-pair > li:last-child \.ui-fp-mark \{[^}]*animation:/);
    expect(css).not.toMatch(/\.vault-pair > li:last-child \{[^}]*animation:/);
  });
  it("keeps the native mark of every <details>: no summary is turned into a flex box", () => {
    expect(css).not.toMatch(/summary[^{,]*\{[^}]*display:\s*(?:flex|grid|block)/);
  });
  it("folds the versions on a phone (closed), lists them from 64 rem, and keeps the rail in view there", () => {
    const out = html(createElement(DocumentRail, { lang: "fr", document: detail(3), version: version(3), clauses: [], article: vaultFr.document.article }));
    expect(out).toMatch(/<details class="vault-phone-block">/);
    expect(out).not.toMatch(/<details[^>]*\sopen/);
    expect(out).toContain('class="vault-desk-block"');
    expect(css).toMatch(/@media \(min-width: 64rem\)[^@]*\.vault-rail \{[^}]*position:\s*sticky/);
  });
});

describe("M8, M10: targets and bullets in the comparison", () => {
  const older = render();
  const newer = render({ "input.acceptanceWindowDays": 20 }, 2);
  const comparison = compareModels(older, newer);
  const v: ClauseView = { lang: "fr", article: vaultFr.document.article, addedOn: "2026-10-24T12:02:00Z", removedOn: "2026-10-23T12:02:00Z", view: "texte" };
  const modified = comparison.clauses.find((c) => c.kind === "modified");
  it("links to the clause itself, which :target then marks", () => {
    if (modified?.kind !== "modified") throw new Error("no modified clause");
    expect(html(createElement(ClauseDiff, { v, diff: modified, byModel: false, next: { id: "liability", number: 19, heading: "Responsabilité" } }))).toContain('href="#clause-liability"');
    expect(html(createElement(DiffLegend, { lang: "fr", clauses: comparison.clauses }))).toContain(`href="#clause-${modified.clause.id}"`);
    expect(css).toMatch(/\.vault-diff \{[^}]*scroll-margin-top/);
  });
  it("keeps a bullet a bullet", () => {
    if (modified?.kind !== "modified") throw new Error("no modified clause");
    expect(html(createElement(ClauseDiff, { v, diff: modified, byModel: false, next: null }))).toContain('data-block="bullet"');
  });
});

describe("M11, M1, M2: the words of the template's variant, and no promise", () => {
  it("calls the acceptance window of a fixed-price contract « Délai de recette »", () => {
    const groups = choiceGroups(template.decl, "fr", vaultFr.prepare, "fixed");
    expect(groups.flatMap((g) => g.fields).find((f) => f.name === "input.acceptanceWindowDays")?.label).toBe("Délai de recette, en jours");
    const values = (m: DocumentModel) => Object.fromEntries(Object.entries(m.variables).map(([k, x]) => [k, x.value]));
    const a = render();
    const b = render({ "input.acceptanceWindowDays": 20 }, 2);
    const { changes } = explainChanges({ lang: "fr", template, older: { number: 1, templateVersion: 1, values: values(a), optionalClauses: {}, model: a }, newer: { number: 2, templateVersion: 1, values: values(b), optionalClauses: {}, model: b }, comparison: compareModels(a, b), t: vaultFr.compare, legendOf: (name) => legendOf(groups, name) });
    expect(changes[0]?.sentence).toBe(`Délai de recette${N}: 15${String.fromCharCode(0xa0)}jours devient 20${String.fromCharCode(0xa0)}jours.`);
  });
  it("does not promise that accepting the contract confirms a version", () => {
    expect(vaultFr.prepare.lead).not.toContain("le confirme en acceptant");
    expect(vaultEn.prepare.lead).not.toContain("confirms it by accepting");
  });
  it("says the template is not yet reviewed, with its own version", () => {
    expect(vaultFr.card.review("2")).toBe("Modèle Proofseen v2, pas encore relu par un avocat.");
    expect(vaultFr.prepare.reviewNote).toContain("pas encore été relu par un avocat");
  });
});

describe("minor fixes of L1-159", () => {
  it("names the other filter « Pas vous »: a colleague is not « l'autre partie »", () => {
    expect(vaultFr.all.filters.other).toBe("Pas vous");
  });
  it("writes the default reason in the language of the page", () => {
    expect(defaultReason("fr", 0)).toBe("première version");
    expect(defaultReason("en", 2)).toBe("new version");
  });
});

describe("the remaining minors of L1-159", () => {
  const NBSP = String.fromCharCode(0xa0);
  it("binds a number to its unit: « 15 jours » never splits", () => {
    const values = (m: DocumentModel) => Object.fromEntries(Object.entries(m.variables).map(([k, x]) => [k, x.value]));
    const a = render();
    const b = render({ "input.acceptanceWindowDays": 20 }, 2);
    const groups = choiceGroups(template.decl, "fr", vaultFr.prepare, "fixed");
    const { changes } = explainChanges({ lang: "fr", template, older: { number: 1, templateVersion: 1, values: values(a), optionalClauses: {}, model: a }, newer: { number: 2, templateVersion: 1, values: values(b), optionalClauses: {}, model: b }, comparison: compareModels(a, b), t: vaultFr.compare, legendOf: (name) => legendOf(groups, name) });
    expect(changes[0]?.sentence).toBe(`Délai de recette${N}: 15${NBSP}jours devient 20${NBSP}jours.`);
  });
  it("does not repeat a legend its label already says", async () => {
    const { ErrorSummary } = await import("../src/components/vault/ErrorSummary");
    const groups = choiceGroups(template.decl, "fr", vaultFr.prepare, "fixed");
    const out = html(createElement(ErrorSummary, { lang: "fr", groups, problems: [{ name: "input.ipRegime", kind: "choose" }, { name: "input.workMode", kind: "choose" }], facts: [], refusal: null, message: null }));
    expect(out).toContain('<a href="#f-ip-regime">Régime de propriété intellectuelle</a>');
    expect(out).toContain('<a href="#f-work-mode">Lieu d&#x27;exécution</a>');
  });
  it("captions the table by the order it is really in", async () => {
    const { AllDocumentsTable } = await import("../src/components/vault/AllDocumentsTable");
    const props = { lang: "fr" as const, path: "/fr/app/documents", params: {}, items: [], affairName: () => null, types: [], total: 0, page: 1, pages: 1, pageSize: 50, filtered: false, error: false };
    expect(html(createElement(AllDocumentsTable, { ...props, sort: { key: "depose", direction: "ascending" } }))).toContain("Vos documents, du plus ancien au plus récent");
    expect(html(createElement(AllDocumentsTable, { ...props, sort: { key: "depose", direction: "descending" } }))).toContain("Vos documents, du plus récent au plus ancien");
  });
  it("writes the amount of the affair once in its head", async () => {
    const { AffairHead } = await import("../src/components/vault/AffairHead");
    const { dealsFr } = await import("../src/i18n/market/deals-fr");
    const contract = { counterpart: "Studio Exemple", status: "pending_signatures", totalCents: 300_000, currency: "EUR", dailyRateCents: 50_000, days: 6 } as unknown as Parameters<typeof AffairHead>[0]["contract"];
    const out = html(createElement(AffairHead, { lang: "fr", deals: dealsFr, contract }));
    expect(out.match(/3\D000,00/g)?.length ?? out.match(/3\D000/g)?.length).toBe(1);
  });
  it("keeps the day under each poinçon of E5 whole, and two groups of the fingerprint per line on a phone", async () => {
    const { CompareHead } = await import("../src/components/vault/CompareHead");
    const out = html(createElement(CompareHead, { lang: "fr", type: "service_agreement", older: version(2), newer: version(3) }));
    expect(out).toContain(`23${NBSP}octobre${NBSP}2026`);
    expect(css).toMatch(/\.vault-pair \.ui-fp-code \{[^}]*max-width:\s*10ch/);
  });
  it("aligns a radio with the first line of a long label, and gives « Lire » a 44 px target", () => {
    expect(css).toMatch(/\.vault-choice \{[^}]*align-items:\s*flex-start/);
    expect(css).toMatch(/\.vault-stratum-links a[^{]*\{[^}]*min-width:\s*2\.75rem/);
  });
});
