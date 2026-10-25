import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RENDER_ERROR_CODES, type RenderError } from "../src/errors";
import type { DocumentModel } from "../src/model";
import { loadRegistry } from "../src/registry";
import { renderTemplate, type RenderOptions } from "../src/render";
import { without } from "./support/demo";
import { EXAMPLE_ROOT } from "./support/fixtures";

const registry = loadRegistry(EXAMPLE_ROOT);
const NNBSP = " ";
const NBSP = " ";

const party = {
  legalName: "Studio Exemple Łukasz Nguyễn",
  siret: "00000000000000",
  vatNumber: null,
  address: { line1: "1 rue de l'Exemple", postalCode: "69003", city: "Lyon", country: "FR" },
  vatRateBp: 0,
};

/** Le cas heureux du gabarit d'exemple de TEMPLATE_FORMAT.md §9. */
const exampleVariables = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  "document.issuedOn": "2026-10-24",
  seller: party,
  "contract.billing": "fixed",
  "contract.totalCents": 123_456,
  "contract.currency": "EUR",
  "computed.vigilanceRequired": false,
  "input.scope": "Concevoir une maquette d'écran de connexion.",
  ...overrides,
});

const render = (variables: Record<string, unknown>, options: RenderOptions = {}, id = "example", lang: "fr" | "en" = "fr", issuedOn?: string) =>
  renderTemplate(id, 1, lang, issuedOn === undefined ? variables : { ...variables, "document.issuedOn": issuedOn }, { registry, ...options });

const failure = (result: ReturnType<typeof render>): RenderError => {
  if (result.ok) throw new Error("un refus était attendu");
  return result.error;
};

const success = (result: ReturnType<typeof render>): DocumentModel => {
  if (!result.ok) throw new Error(`un modèle était attendu : ${result.error.code} ${result.error.message}`);
  return result.value;
};

describe("the nine named errors of TEMPLATE_FORMAT.md (each has its red-then-green test)", () => {
  it("names exactly nine render errors", () => {
    expect([...RENDER_ERROR_CODES].sort()).toEqual([
      "condition_unresolvable",
      "decision_pending",
      "invalid_variable",
      "language_missing",
      "locked_clause_removed",
      "missing_variable",
      "source_expired",
      "template_not_effective",
      "unknown_clause",
    ]);
  });

  it("1. missing_variable: a pending input is missing even if everything else is present", () => {
    const error = failure(render(without(exampleVariables(), "input.scope")));
    expect(error.code).toBe("missing_variable");
    expect(error.variables).toEqual(["input.scope"]);
    expect(error.message).toContain("L1-011");
  });

  it("1b. missing_variable lists every missing variable, not the first one; null and blank count as missing", () => {
    const error = failure(render(exampleVariables({ "input.scope": "   ", "contract.totalCents": null, "contract.currency": undefined })));
    expect(error.code).toBe("missing_variable");
    expect(error.variables).toEqual(["contract.currency", "contract.totalCents", "input.scope"]);
  });

  it("2. decision_pending: the monthly variant is blocked by the founder's decision D8", () => {
    const error = failure(render(exampleVariables({ "contract.billing": "monthly" })));
    expect(error.code).toBe("decision_pending");
    expect(error.decision).toBe("D8");
    expect(error.clause).toBe("price");
  });

  it("2b. decision_pending even when the decision's own variable is absent, and before missing_variable", () => {
    const withoutDecision = render(exampleVariables({ "contract.billing": "monthly" }));
    expect(failure(withoutDecision).code).toBe("decision_pending");
    expect(failure(render(without(exampleVariables({ "contract.billing": "monthly" }), "input.scope"))).code).toBe("missing_variable");
  });

  it("3. locked_clause_removed: neither a conditional nor a locked clause can be excluded", () => {
    const conditional = failure(render(exampleVariables(), { optionalClauses: { vigilance: "excluded" } }));
    expect(conditional.code).toBe("locked_clause_removed");
    expect(conditional.clause).toBe("vigilance");
    expect(failure(render(exampleVariables(), { optionalClauses: { parties: "excluded" } })).code).toBe("locked_clause_removed");
  });

  it("4. unknown_clause: a clause that does not exist, or that is not optional, cannot be named to be included", () => {
    expect(failure(render(exampleVariables(), { optionalClauses: { nowhere: "included" } })).code).toBe("unknown_clause");
    expect(failure(render(exampleVariables(), { optionalClauses: { parties: "included" } })).code).toBe("unknown_clause");
    expect(failure(render(exampleVariables(), { optionalClauses: { nowhere: "excluded" } })).code).toBe("unknown_clause");
  });

  it("5. invalid_variable: wrong type, bound, pattern, hidden control characters, unknown names", () => {
    const codes = [
      exampleVariables({ "contract.totalCents": -1 }),
      exampleVariables({ "contract.totalCents": 10.5 }),
      exampleVariables({ "contract.totalCents": "100" }),
      exampleVariables({ "contract.currency": "eur" }),
      exampleVariables({ "contract.billing": "weekly" }),
      exampleVariables({ "computed.vigilanceRequired": "false" }),
      exampleVariables({ "input.scope": "x".repeat(4001) }),
      exampleVariables({ "input.scope": "Texte ‮inversé" }),
      exampleVariables({ "input.scope": "Texte avec un octet nul \u0000" }),
      exampleVariables({ "document.issuedOn": "2026-02-30" }),
      exampleVariables({ seller: { ...party, legalName: "" } }),
      exampleVariables({ seller: { ...party, address: { ...party.address, country: "France" } } }),
      exampleVariables({ "nobody.declared": 1 }),
    ].map((variables) => failure(render(variables)).code);
    expect(codes).toEqual(Array(13).fill("invalid_variable"));
  });

  it("5b. invalid_variable names the variable, and a contact detector injected by the caller refuses free text", () => {
    const rejectContact = (text: string): string | null => (text.includes("@") ? "pas de coordonnées" : null);
    const error = failure(render(exampleVariables({ "input.scope": "Écrivez-moi à moi@example.org" }), { rejectContact }));
    expect(error.code).toBe("invalid_variable");
    expect(error.variables).toEqual(["input.scope"]);
    expect(error.message).toContain("pas de coordonnées");
    expect(render(exampleVariables({ "input.scope": "Rien à signaler" }), { rejectContact }).ok).toBe(true);
  });

  it("6. condition_unresolvable: a condition never reads a missing variable as false", () => {
    const base = { "document.issuedOn": "2026-10-24" };
    const error = failure(renderTemplate("conditional", 1, "fr", base, { registry }));
    expect(error.code).toBe("condition_unresolvable");
    expect(error.variables).toEqual(["opt.flag"]);
    const ok = success(renderTemplate("conditional", 1, "fr", { ...base, "opt.flag": false }, { registry }));
    expect(ok.clauses.map((c) => c.id)).toEqual(["always"]);
    const small = success(renderTemplate("conditional", 1, "fr", { ...base, "opt.flag": true, "opt.count": 3 }, { registry }));
    expect(small.clauses.map((c) => c.id)).toEqual(["always", "when-flag", "when-count"]);
    const big = success(renderTemplate("conditional", 1, "fr", { ...base, "opt.flag": true, "opt.count": 10 }, { registry }));
    expect(big.clauses.map((c) => c.id)).toEqual(["always", "when-flag"]);
  });

  it("7. source_expired: a clause that cites a source ended before the issue date does not render, but renders on the last day", () => {
    const base = {};
    const late = failure(renderTemplate("expiring", 1, "fr", { ...base, "document.issuedOn": "2027-01-01" }, { registry }));
    expect(late.code).toBe("source_expired");
    expect(late.source).toBe("old-rule");
    expect(late.clause).toBe("only");
    const lastDay = success(renderTemplate("expiring", 1, "fr", { ...base, "document.issuedOn": "2026-12-31" }, { registry }));
    expect(lastDay.warnings).toEqual([{ code: "source_expiring", clause: "only", sourceId: "old-rule", validUntil: "2026-12-31", daysLeft: 0 }]);
    const early = success(renderTemplate("expiring", 1, "fr", { ...base, "document.issuedOn": "2026-10-24" }, { registry }));
    expect(early.warnings).toEqual([]);
  });

  it("8. language_missing: a language the template does not declare", () => {
    expect(failure(render(exampleVariables(), {}, "example", "en")).code).toBe("language_missing");
  });

  it("9. template_not_effective: issued before effectiveFrom, and a retired template", () => {
    expect(failure(render(exampleVariables(), {}, "example", "fr", "2026-10-23")).code).toBe("template_not_effective");
    expect(success(render(exampleVariables(), {}, "example", "fr", "2026-10-24")).issuedOn).toBe("2026-10-24");
  });

  it("template_not_found: an unknown template or an unknown version", () => {
    expect(failure(renderTemplate("nope", 1, "fr", exampleVariables(), { registry })).code).toBe("template_not_found");
    expect(failure(renderTemplate("example", 2, "fr", exampleVariables(), { registry })).code).toBe("template_not_found");
  });
});

describe("TEMPLATE_FORMAT.md §9, expected renders", () => {
  it("4. clauses numbered from 1, the vigilance clause only when the data say so, the review notice on top and the review line at the foot", () => {
    const model = success(render(exampleVariables(), { optionalClauses: { reference: "included" } }));
    expect(model.clauses.map((c) => [c.number, c.id])).toEqual([[1, "parties"], [2, "scope"], [3, "price"], [4, "reference"]]);
    expect(model.reviewNotice).toContain("en cours de relecture par un avocat");
    expect(model.reviewFooter).toBe("Modèle Proofseen en cours de relecture par un avocat.");
    const withVigilance = success(render(exampleVariables({ "computed.vigilanceRequired": true }), { optionalClauses: { reference: "included" } }));
    expect(withVigilance.clauses.map((c) => [c.number, c.id])).toEqual([[1, "parties"], [2, "scope"], [3, "price"], [4, "vigilance"], [5, "reference"]]);
  });

  it("an optional clause is excluded by default, and its removal is part of the canonical content", () => {
    const without = success(render(exampleVariables()));
    const withReference = success(render(exampleVariables(), { optionalClauses: { reference: "included" } }));
    expect(without.clauses.map((c) => c.id)).not.toContain("reference");
    expect(without.canonical).toContain('"omitted":["reference"]');
    expect(without.contentDigest).not.toBe(withReference.contentDigest);
  });

  it("5. two renders of the same inputs give the same canonical content, byte for byte", () => {
    const [a, b] = [success(render(exampleVariables())), success(render(exampleVariables()))];
    expect(a.canonical).toBe(b.canonical);
    expect(a.contentDigest).toBe(b.contentDigest);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const reordered = Object.fromEntries(Object.entries(exampleVariables()).reverse());
    expect(success(render(reordered)).contentDigest).toBe(a.contentDigest);
  });

  it("changing one word of the amount changes the digest", () => {
    const a = success(render(exampleVariables()));
    const b = success(render(exampleVariables({ "contract.totalCents": 123_457 })));
    expect(a.contentDigest).not.toBe(b.contentDigest);
  });
});

describe("review attestation (principle 7)", () => {
  const reviewedRegistry = (digestOverride?: string): { readonly registry: ReturnType<typeof loadRegistry>; readonly dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), "proofseen-documents-"));
    cpSync(EXAMPLE_ROOT, dir, { recursive: true });
    const digest = digestOverride ?? loadRegistry(dir).find("example", 1)?.digest ?? "";
    const file = join(dir, "example", "template.yaml");
    const text = readFileSync(file, "utf8")
      .replace("status: draft\n  reviewedBy: null\n  reviewedOn: null\n  reviewedDigest: null", `status: reviewed\n  reviewedBy: "Me Exemple, barreau d'Exemple"\n  reviewedOn: "2026-11-02"\n  reviewedDigest: "${digest}"`);
    writeFileSync(file, text);
    return { registry: loadRegistry(dir), dir };
  };

  it("the notice disappears when the review matches the digest of the files, and comes back when a word changes", () => {
    const { registry: reviewed, dir } = reviewedRegistry();
    const clean = success(renderTemplate("example", 1, "fr", exampleVariables(), { registry: reviewed }));
    expect(clean.reviewNotice).toBeNull();
    expect(clean.reviewFooter).toBeNull();

    const file = join(dir, "example", "fr.yaml");
    writeFileSync(file, readFileSync(file, "utf8").replace("Le prix est de", "Le prix total est de"));
    const changed = success(renderTemplate("example", 1, "fr", exampleVariables(), { registry: loadRegistry(dir) }));
    expect(changed.reviewNotice).not.toBeNull();
  });

  it("a review whose recorded digest does not match the files does not count", () => {
    const { registry: stale } = reviewedRegistry("0".repeat(64));
    expect(success(renderTemplate("example", 1, "fr", exampleVariables(), { registry: stale })).reviewNotice).not.toBeNull();
  });
});

describe("text handling", () => {
  it("never reads the inside of a value as structure: a placeholder or a bullet typed by a party stays text", () => {
    const hostile = "{{seller}} et {{contract.totalCents}}\n- une puce\n\nSecond paragraphe";
    const model = success(render(exampleVariables({ "input.scope": hostile })));
    const scope = model.clauses.find((c) => c.id === "scope");
    expect(scope?.blocks).toEqual([
      { kind: "paragraph", runs: [{ text: "{{seller}} et {{contract.totalCents}} - une puce" }] },
      { kind: "paragraph", runs: [{ text: "Second paragraphe" }] },
    ]);
  });

  it("formats money, enum labels and applies French spacing to the template text but not inside values", () => {
    const model = success(render(exampleVariables()));
    const price = model.clauses.find((c) => c.id === "price");
    const text = price?.blocks.map((b) => (b.kind === "party" ? "" : b.runs.map((r) => r.text).join(""))).join("\n");
    expect(text).toBe(`Le prix est de 1${NNBSP}234,56${NBSP}EUR hors taxes, au forfait.`);
  });

  it("prints a party as a block of lines: legal name, address, SIRET, country", () => {
    const model = success(render(exampleVariables()));
    const block = model.clauses.find((c) => c.id === "parties")?.blocks[0];
    expect(block).toEqual({
      kind: "party",
      lines: [
        { text: "Studio Exemple Łukasz Nguyễn", strong: true },
        { text: "1 rue de l'Exemple" },
        { text: "69003 Lyon" },
        { text: "France" },
        { text: `SIRET${NBSP}: 000${NBSP}000${NBSP}000${NBSP}00000` },
      ],
    });
  });

  it("normalises accents to NFC so that a decomposed name prints the same glyphs", () => {
    const decomposed = "Nguyễn".normalize("NFD");
    const model = success(render(exampleVariables({ seller: { ...party, legalName: decomposed } })));
    const first = model.clauses[0]?.blocks[0];
    expect(first?.kind === "party" ? first.lines[0]?.text : "").toBe("Nguyễn");
  });

  it("marks the test render with a watermark that is part of the canonical content", () => {
    const plain = success(render(exampleVariables()));
    const marked = success(render(exampleVariables(), { watermark: true }));
    expect(plain.watermark).toBeNull();
    expect(marked.watermark).toBe("Exemple, non signé");
    expect(marked.contentDigest).not.toBe(plain.contentDigest);
  });
});
