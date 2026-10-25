import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRegistry, renderTemplate, type DocumentModel, type LoadedTemplate } from "@proofseen/documents";
import type { DocumentDetail, VersionSummary } from "@proofseen/db";
import { describe, expect, it } from "vitest";
import { AffairTabs, SectionTabs } from "../src/components/vault/AffairTabs";
import { ChangeSummary } from "../src/components/vault/ChangeSummary";
import { ClauseDiff, SameClauses, type ClauseView } from "../src/components/vault/ClauseDiff";
import { CompareHead } from "../src/components/vault/CompareHead";
import { Digests } from "../src/components/vault/Digests";
import { DocumentCard } from "../src/components/vault/DocumentCard";
import { DocumentView } from "../src/components/vault/DocumentView";
import { ErrorSummary } from "../src/components/vault/ErrorSummary";
import { VaultState } from "../src/components/vault/VaultState";
import { VaultStamp } from "../src/components/vault/VaultStamp";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { choiceGroups } from "../src/lib/vault/choices";
import { compareModels, groupIdentical } from "../src/lib/vault/compare";
import { demoContract } from "../../../packages/documents/test/support/demo";

/*
 * L1.6: the screens of the vault rendered by the server, as a browser without JavaScript receives them. Example data
 * only (fingerprints of the word « Exemple », the fictive parties of the engine's reference contract).
 */

const N = String.fromCharCode(0x202f);
/** The separator of the vault: a no-break space before « · », so it never begins a line. */
const D = `${String.fromCharCode(0xa0)}· `;
const html = (node: ReactElement) => renderToStaticMarkup(node);
const hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const ID = "00000000-0000-4000-8000-0000000000d1";

const version = (number: number, overrides: Partial<VersionSummary> = {}): VersionSummary => ({
  number,
  sha256: hex(`fichier ${number}`),
  contentDigest: hex(`Exemple ${number}`),
  size: 421_000,
  contentType: "application/pdf",
  templateVersion: "1",
  engine: "proofseen-documents@1",
  reason: number === 1 ? "première version" : "Délai de recette porté à 20 jours",
  createdAt: new Date(`2026-10-2${number + 1}T12:02:00Z`),
  by: number === 1 ? "other_party" : "you",
  side: number === 1 ? "company" : "freelance",
  ...overrides,
});

const detail = (count: number): DocumentDetail => {
  const versions = Array.from({ length: count }, (_, i) => version(count - i));
  return { id: ID, affair: { kind: "contract", id: "00000000-0000-4000-8000-0000000000c1" }, type: "service_agreement", slot: 1, templateId: "service-agreement", lang: "fr", createdAt: versions[versions.length - 1]!.createdAt, versionCount: count, latest: versions[0]!, versions };
};

describe("tabs and states of the affair (T5)", () => {
  it("draws the two tabs as links, the open one aria-current, and nothing when the vault is closed", () => {
    const tabs = html(createElement(AffairTabs, { lang: "fr", contractId: "c1", current: "documents", count: 2, open: true }));
    expect(tabs).toContain('<nav class="vault-tabs" aria-label="Sections de l&#x27;affaire">');
    expect(tabs).toContain('<a aria-current="page" href="/fr/app/contrats/c1/documents">Documents (2)</a>');
    expect(tabs).not.toContain("tablist");
    expect(html(createElement(AffairTabs, { lang: "fr", contractId: "c1", current: "affair", count: 2, open: false }))).toBe("");
    expect(html(createElement(SectionTabs, { lang: "fr", current: "contracts", open: true }))).toContain('<a href="/fr/app/documents">Documents</a>');
  });

  const states = [
    [{ kind: "closed" }, vaultFr.states.closed.title, "Revenir à l&#x27;affaire"],
    [{ kind: "monthly" }, "en régie n&#x27;est pas encore disponible", null],
    [{ kind: "cancelled" }, "Ce contrat a été annulé", null],
    [{ kind: "no-scope-accepted" }, "accepté sans objet de prestation décrit", null],
    [{ kind: "no-scope-pending" }, "Le freelance peut envoyer un nouveau devis", null],
    [{ kind: "empty-preparable" }, "Aucun document pour l&#x27;instant.", "Préparer le contrat de prestation"],
    [{ kind: "empty-late", acceptance: { by: "company", at: new Date("2026-10-25T09:00:00Z") } }, `accepté par l&#x27;entreprise le 25 octobre 2026${N}: aucun texte`, null],
    [{ kind: "error" }, "Les documents n&#x27;ont pas pu être lus.", "Réessayer"],
  ] as const;
  it.each(states)("renders the state %j with its exact text and only its own action", (state, text, action) => {
    const out = html(createElement(VaultState, { lang: "fr", state, side: "company", affairHref: "/a", prepareHref: "/p", retryHref: "/r" }));
    expect(out).toContain(text);
    if (action === null) expect(out).not.toContain("btn");
    else expect(out).toContain(action);
  });
});

describe("a document of the affair (T6)", () => {
  it("shows the latest version with its content fingerprint, never the file's, and its strata", () => {
    const doc = detail(3);
    const out = html(createElement(DocumentCard, { lang: "fr", document: doc, inking: null, underReview: true, prepareHref: "/fr/app/contrats/c1/documents/preparer", closedLine: null }));
    expect(out).toContain(`Version 3${D}déposée le 24 octobre 2026 à 14:02 par vous`);
    expect(out).toContain(doc.latest!.contentDigest.slice(0, 4).toUpperCase());
    expect(out).not.toContain(doc.latest!.sha256.slice(0, 4).toUpperCase() + " ");
    expect(out).toContain(`Télécharger le PDF, 412${N}Ko`);
    expect(out).toContain('download="contrat-de-prestation-v3.pdf"');
    expect(out).toContain("Ce qui a changé depuis la version 2");
    expect(out).toContain(`Version 2${D}23 octobre 2026${D}par vous`);
    expect(out).toContain(`Version 1${D}22 octobre 2026${D}par l&#x27;entreprise`);
    expect(out).toContain("Remplacée par la version 2");
    expect(out).toContain('action="/fr/app/documents/00000000-0000-4000-8000-0000000000d1/comparer"');
    expect(out).toContain(vaultFr.card.review);
  });

  it("says why no new version may be prepared, instead of a button", () => {
    const out = html(createElement(DocumentCard, { lang: "fr", document: detail(1), inking: null, underReview: false, prepareHref: null, closedLine: "Plus de nouvelle version." }));
    expect(out).not.toContain("Préparer une nouvelle version");
    expect(out).toContain("Plus de nouvelle version.");
    expect(out).not.toContain(vaultFr.card.review);
  });

  it("inks (M1) the stamp of a version just born: the same drawing, ink in bands, the same words", () => {
    const rest = html(createElement(VaultStamp, { lang: "fr", contentDigest: hex("Exemple 1"), size: 32, subject: "du contrat de prestation, version 1" }));
    const ink = html(createElement(VaultStamp, { lang: "fr", contentDigest: hex("Exemple 1"), size: 32, subject: "du contrat de prestation, version 1", inking: true }));
    expect(ink).toContain('class="vault-ink-base"');
    expect(ink.match(/vault-ink-band/g)?.length).toBeGreaterThan(1);
    const words = (s: string) => s.replace(/<[^>]+>/g, "");
    expect(words(ink)).toBe(words(rest));
  });
});

const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const render = (overrides: Record<string, unknown> = {}, version = 1): DocumentModel => {
  const out = renderTemplate("service-agreement", template.decl.version, "fr", demoContract({ "document.versionNumber": version, ...overrides }));
  if (!out.ok) throw new Error(out.error.code);
  return out.value;
};

describe("the form « Préparer » (T10)", () => {
  it("names each missing choice by its fieldset and the template's label, a link to its first control", () => {
    const groups = choiceGroups(template.decl, "fr", vaultFr.prepare);
    const out = html(createElement(ErrorSummary, { lang: "fr", groups, problems: [{ name: "input.ipRegime", kind: "choose" }, { name: "input.confidentialityYears", kind: "number" }], facts: [], refusal: null, message: null }));
    expect(out).toContain('role="alert"');
    expect(out).toContain(`Il manque 2 choix pour préparer le contrat${N}:`);
    expect(out).toContain(`<a href="#f-ip-regime">Propriété intellectuelle${N}: régime de propriété intellectuelle</a>`);
    expect(out).toContain(`<a href="#f-confidentiality-years">Confidentialité${N}: durée de la confidentialité après la fin du contrat, en années</a>`);
    expect(out).not.toContain("input.");
  });
});

describe("a document (T11)", () => {
  it("renders the text of the version, its clauses as sections, its fingerprint said in the footer", () => {
    const model = render();
    const out = html(createElement(DocumentView, { model, article: vaultFr.document.article, footer: vaultFr.document.footer("7F3A 91C2 0B4E D2A8"), label: "Texte du document" }));
    expect(out).toContain('<article id="texte" class="vault-article" lang="fr"');
    expect(out).toContain('<section id="clause-acceptance"');
    expect(out).toMatch(new RegExp(`<h2 id="clause-acceptance-h" tabindex="-1">Article [0-9]+${D}Recette</h2>`));
    expect(out).toContain((model.reviewNotice ?? "").replace(/'/g, "&#x27;"));
    expect(out).toContain("même empreinte de contenu, 7F3A 91C2 0B4E D2A8, vérifiée à l&#x27;affichage");
  });

  it("gives both fingerprints in full and the exact commands to check the file", () => {
    const out = html(createElement(Digests, { lang: "fr", contentDigest: hex("Exemple 3"), sha256: hex("fichier 3"), fileName: "contrat-de-prestation-v3.pdf" }));
    expect(out).toContain("certutil -hashfile contrat-de-prestation-v3.pdf SHA256");
    expect(out).toContain("shasum -a 256 contrat-de-prestation-v3.pdf");
    expect(out).toContain("sha256sum contrat-de-prestation-v3.pdf");
    expect(out).toContain(hex("fichier 3").slice(0, 16));
    // L1-147: the content fingerprint in capitals grouped by four, the file one in lower case as the commands print it.
    expect(out).toContain(`${hex("Exemple 3").slice(0, 4).toUpperCase()} ${hex("Exemple 3").slice(4, 8).toUpperCase()}`);
  });
});

describe("the comparison (T9)", () => {
  const older = render();
  const newer = render({ "input.acceptanceWindowDays": 20 }, 2);
  const comparison = compareModels(older, newer);
  const v: ClauseView = { lang: "fr", article: vaultFr.document.article, addedOn: "2026-10-24T12:02:00Z", removedOn: "2026-10-23T12:02:00Z", view: "texte" };
  const modified = comparison.clauses.find((c) => c.kind === "modified");

  it("marks a modified clause by its rule, its word, struck and underlined words with hidden prefixes, never by colour alone", () => {
    if (modified === undefined || modified.kind !== "modified") throw new Error("no modified clause");
    const out = html(createElement(ClauseDiff, { v, diff: modified, byModel: false, next: null }));
    expect(out).toContain('data-kind="modified"');
    expect(out).toContain('<span class="tag">Modifiée</span>');
    expect(out).toContain(`<del dateTime="2026-10-23T12:02:00Z"><span class="sr-only">Retiré${N}: </span>15</del>`);
    expect(out).toContain(`<ins dateTime="2026-10-24T12:02:00Z"><span class="sr-only">Ajouté${N}: </span>20<span class="sr-only"> fin de l&#x27;ajout</span></ins>`);
    expect(out).toContain('<a href="#en-bref">Fin des changements. Revenir au résumé.</a>');
    expect(out).not.toMatch(/proof|sealed/);
  });

  it("chains to the next change by a link, and folds identical clauses with their count", () => {
    if (modified === undefined || modified.kind !== "modified") throw new Error("no modified clause");
    const out = html(createElement(ClauseDiff, { v, diff: modified, byModel: false, next: { id: "liability", number: 19, heading: "Responsabilité" } }));
    expect(out).toContain(`<a href="#clause-liability-h">Changement suivant${N}: article 19, Responsabilité</a>`);
    const group = groupIdentical(comparison.clauses).find((g) => g.kind === "identical");
    if (group?.kind !== "identical") throw new Error("no identical group");
    const same = html(createElement(SameClauses, { v, group }));
    expect(same).toContain(`${group.clauses.length} clauses identiques`);
    expect(html(createElement(SameClauses, { v: { ...v, view: "complete" }, group }))).not.toContain("<details");
  });

  it("puts the two fingerprints side by side, with the sentence that says they are two documents", () => {
    const out = html(createElement(CompareHead, { lang: "fr", type: "service_agreement", older: version(2), newer: version(3) }));
    expect(out).toContain("Ce qui a changé entre la version 2 et la version 3");
    expect(out).toContain(`Deux empreintes différentes${N}: ce sont deux documents distincts.`);
    expect(out.match(/data-level="128"/g)?.length).toBe(2);
    // Two clean lines under each poinçon: never a « · » at the head of a line (seen on the specimen, fixed).
    expect(out).toContain(`<span class="vault-line">Version 2${D}23 octobre 2026</span><span class="vault-line">par vous</span>`);
    expect(out).not.toMatch(/> ?· /);
  });

  it("says each change and who made it, and the lines for each party only when the template gives them", () => {
    const changes = [{ kind: "number" as const, key: "input.acceptanceWindowDays", sentence: "Délai : 15 jours devient 20 jours.", clause: "acceptance", parties: null }];
    const out = html(createElement(ChangeSummary, { lang: "fr", changes, attributionOf: () => ({ kind: "one", number: 2, by: "le freelance" }), role: "client" }));
    expect(out).toContain("Changé par le freelance dans la version 2.");
    expect(out).not.toContain("Pour vous");
    const many = html(createElement(ChangeSummary, { lang: "fr", changes: [{ ...changes[0]!, parties: { client: "Vous disposez de 20 jours.", provider: "Le Client dispose de 20 jours." } }], attributionOf: () => ({ kind: "many", numbers: [2, 3] }), role: "client" }));
    expect(many).toContain("Changé dans la version 2, puis dans la version 3.");
    expect(many.indexOf(`Pour vous, Client${N}: `)).toBeLessThan(many.indexOf(`Pour le Prestataire${N}: `));
  });
});

describe("no green in the vault (T13)", () => {
  const web = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const files = readdirSync(join(web, "components", "vault")).map((name) => join(web, "components", "vault", name));
  it("builds no sealed fingerprint and reads no proof colour, in its components and its stylesheet", () => {
    for (const file of [...files, join(web, "styles", "vault.css")]) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(text, file).not.toMatch(/--ps-proof/);
      expect(text, file).not.toMatch(/kind:\s*["']sealed["']|kind=["']sealed["']/);
      expect(text, file).not.toMatch(/transition:[^;]*(box-shadow|filter)/);
    }
  });
});
