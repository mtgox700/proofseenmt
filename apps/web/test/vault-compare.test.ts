import { renderTemplate, type DocumentModel, type ModelClause } from "@proofseen/documents";
import { describe, expect, it } from "vitest";
import { compareModels, groupIdentical } from "../src/lib/vault/compare";
import { diffWords, MAX_WORDS, tokenize } from "../src/lib/vault/words";
import { demoContract } from "../../../packages/documents/test/support/demo";

/*
 * L1.6, T8: the comparison of two versions, clause by clause, by clause id (never by article number), and word by word
 * inside a changed paragraph, a value from the data counting as one word. Played on the reference contract of the
 * document engine (fictive parties, « Exemple »), rendered twice.
 */

const render = (overrides: Record<string, unknown> = {}, optionalClauses: Record<string, "included" | "excluded"> = {}, version = 1): DocumentModel => {
  const rendered = renderTemplate("service-agreement", 1, "fr", demoContract({ "document.versionNumber": version, ...overrides }), { optionalClauses });
  if (!rendered.ok) throw new Error(rendered.error.code);
  return rendered.value;
};

describe("words (T8)", () => {
  it("15 replaced by 20 gives one removal and one addition, nothing else", () => {
    const pieces = diffWords([{ text: "Le Client dispose de " }, { text: "15", value: true }, { text: " jours." }], [{ text: "Le Client dispose de " }, { text: "20", value: true }, { text: " jours." }]);
    expect(pieces).toEqual([
      { op: "same", text: "Le Client dispose de " },
      { op: "removed", text: "15" },
      { op: "added", text: "20" },
      { op: "same", text: " jours." },
    ]);
  });

  it("keeps a value from the data whole: a changed name is one word, not a letter", () => {
    const pieces = diffWords([{ text: "Signé par " }, { text: "Atelier Exemple Un", value: true }], [{ text: "Signé par " }, { text: "Atelier Exemple Deux", value: true }]);
    expect(pieces?.filter((piece) => piece.op !== "same")).toEqual([
      { op: "removed", text: "Atelier Exemple Un" },
      { op: "added", text: "Atelier Exemple Deux" },
    ]);
  });

  it("gives up past the word ceiling: before and after are shown whole instead", () => {
    const long = [{ text: Array.from({ length: MAX_WORDS + 1 }, (_, i) => `mot${i}`).join(" ") }];
    expect(diffWords(long, [{ text: "court" }])).toBeNull();
    expect(tokenize([{ text: "a b  c" }]).map((token) => token.text)).toEqual(["a ", "b  ", "c"]);
  });
});

describe("compareModels (T8)", () => {
  it("finds nothing between two renders that differ only by their number and date of issue", () => {
    const comparison = compareModels(render({}, {}, 1), render({ "document.issuedOn": "2026-10-25" }, {}, 2));
    expect(comparison.counts).toEqual({ modified: 0, added: 0, removed: 0, total: 0 });
    expect(comparison.clauses.every((clause) => clause.kind === "identical")).toBe(true);
  });

  it("marks the acceptance clause modified, word by word, when the window goes from 15 to 20 days", () => {
    const comparison = compareModels(render(), render({ "input.acceptanceWindowDays": 20 }, {}, 2));
    expect(comparison.counts).toEqual({ modified: 1, added: 0, removed: 0, total: 1 });
    const modified = comparison.clauses.find((clause) => clause.kind === "modified");
    expect(modified?.clause.id).toBe("acceptance");
    if (modified?.kind !== "modified") return;
    const changed = modified.blocks.filter((block) => block.kind === "changed");
    expect(changed.length).toBeGreaterThan(0);
    const ops = changed.flatMap((block) => (block.kind === "changed" ? (block.pieces ?? []) : [])).filter((piece) => piece.op !== "same");
    expect(ops).toContainEqual({ op: "removed", text: "15" });
    expect(ops).toContainEqual({ op: "added", text: "20" });
  });

  it("aligns by id: an added optional article renumbers the next ones without counting them as changes", () => {
    const before = render();
    const after = render({}, { "non-solicitation": "included" }, 2);
    const comparison = compareModels(before, after);
    expect(comparison.counts).toEqual({ modified: 0, added: 1, removed: 0, total: 1 });
    const added = comparison.clauses.find((clause) => clause.kind === "added");
    expect(added?.clause.id).toBe("non-solicitation");
    const renumbered = comparison.clauses.filter((clause) => clause.kind === "identical" && clause.before.number !== clause.clause.number);
    expect(renumbered.length).toBeGreaterThan(0);
  });

  it("puts a removed article at its old place, after the article that preceded it", () => {
    const before = render({}, { "non-solicitation": "included" });
    const after = render({}, {}, 2);
    const comparison = compareModels(before, after);
    expect(comparison.counts.removed).toBe(1);
    const ids = comparison.clauses.map((clause) => clause.clause.id);
    const previous = before.clauses[before.clauses.findIndex((clause) => clause.id === "non-solicitation") - 1] as ModelClause;
    expect(ids.indexOf("non-solicitation")).toBe(ids.indexOf(previous.id) + 1);
  });

  it("adds a conditional article and its paragraphs when personal data is processed", () => {
    const comparison = compareModels(render(), render({ "input.processesPersonalData": true, "input.dpaDetails": "Gestion des comptes clients d'exemple, pendant la mission." }, {}, 2));
    expect(comparison.clauses.some((clause) => clause.kind === "added" && clause.clause.id === "data-processing")).toBe(true);
  });

  it("groups consecutive identical clauses, in order, and leaves the changes between them", () => {
    const comparison = compareModels(render(), render({ "input.acceptanceWindowDays": 20 }, {}, 2));
    const groups = groupIdentical(comparison.clauses);
    expect(groups.map((group) => group.kind)).toEqual(["identical", "change", "identical"]);
    const total = groups.reduce((sum, group) => sum + (group.kind === "identical" ? group.clauses.length : 1), 0);
    expect(total).toBe(comparison.clauses.length);
  });
});
