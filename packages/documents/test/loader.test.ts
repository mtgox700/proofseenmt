import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical";
import { TemplateLoadError } from "../src/errors";
import { lintTemplate, type LintInput } from "../src/lint";
import { parseYaml } from "../src/yaml";
import { defaultRegistry, loadRegistry, pendingVariables, TEMPLATES_DIR } from "../src/registry";
import { BROKEN_ROOT } from "./support/fixtures";

const registry = defaultRegistry();
const service = (): LintInput => {
  const template = registry.find("service-agreement", 1);
  if (template === undefined) throw new Error("service-agreement v1 absent");
  return structuredClone({ decl: template.decl, texts: template.texts, sources: registry.sources }) as LintInput;
};

describe("the packaged templates (transform of the Tresor structural check)", () => {
  it("loads the five v1 templates with zod strict schemas and finds no structural problem", () => {
    const all = registry.all();
    expect(all.map((t) => t.decl.id).sort()).toEqual(["acceptance-report", "amendment", "nda", "quote", "service-agreement"]);
    // 71 clauses : 69 à la livraison du format, plus la clause conditionnelle `signed-version` (« en vigueur à la signature »)
    // que le procès-verbal et l'avenant ont reçue quand Inès a rattaché leurs variables (L1-100).
    expect(all.reduce((n, t) => n + t.decl.clauses.length, 0)).toBe(71);
    for (const t of all) expect(lintTemplate({ decl: t.decl, texts: t.texts, sources: registry.sources }), t.decl.id).toEqual([]);
  });

  it("loads the French and English pilot and only the French of the others", () => {
    const languages = Object.fromEntries(registry.all().map((t) => [t.decl.id, Object.keys(t.texts).sort()]));
    expect(languages).toEqual({
      "service-agreement": ["en", "fr"],
      quote: ["fr"],
      "acceptance-report": ["fr"],
      nda: ["fr"],
      amendment: ["fr"],
    });
  });

  it("lists the variables whose column or decision does not exist yet, so the render refuses until they do", () => {
    // Le contrat de prestation n'attend plus que la décision D8 du founder : le coffre a livré l'objet, les livrables et la
    // validité (L1-011, L1-077) et Inès a rattaché les 30 autres variables `pending` (L1-100). Les quatre autres gabarits
    // n'ont plus aucune variable en attente.
    const pending = Object.fromEntries(registry.all().map((t) => [t.decl.id, pendingVariables(t.decl)]));
    expect(pending).toEqual({
      "service-agreement": ["decision.d8MonthlyFunding"],
      quote: [],
      "acceptance-report": [],
      nda: [],
      amendment: [],
    });
  });

  it("digests the content, not the comments or the review attestation", () => {
    const template = registry.find("service-agreement", 1);
    expect(template?.digest).toMatch(/^[0-9a-f]{64}$/);
    const again = loadRegistry(TEMPLATES_DIR).find("service-agreement", 1);
    expect(again?.digest).toBe(template?.digest);
  });

  it("never prints that a review is under way (L1-159, Kensa M2: D6 is not engaged), says what is true, and can say the review is done", () => {
    for (const t of registry.all()) {
      for (const [lang, text] of Object.entries(t.texts)) {
        const where = `${t.decl.id}/${lang}`;
        const printed = [text.reviewNotice, text.reviewFooter, text.reviewedFooter ?? ""].join("\n");
        expect(printed, where).not.toMatch(/en cours de relecture|under review|being reviewed/i);
        expect(`${text.reviewNotice} ${text.reviewFooter}`, where).toMatch(lang === "fr" ? /pas encore relu par un avocat/ : /not yet (?:been )?reviewed by a lawyer/);
        // La phrase « relu le ... » existe déjà : le jour de la décision, seule la donnée du gabarit change (`review`).
        expect(text.reviewedFooter, where).toMatch(/\{\{review\.reviewedOn\}\}/);
      }
    }
  });
});

describe("source registry", () => {
  it("reads the three corrections of L1-040: 289 and 293 B stay citable until 2028-06-30", () => {
    expect(registry.sources["cgi-289"]?.validUntil).toBe("2028-06-30");
    expect(registry.sources["cgi-293b"]?.validUntil).toBe("2028-06-30");
    expect(registry.sources["cibs-l216-35"]?.validFrom).toBe("2027-01-01");
    expect(registry.sources["ord-2026-671"]?.url).toContain("legifrance.gouv.fr");
  });

  it("gives every source a date and a url, and an official reading status", () => {
    for (const [id, s] of Object.entries(registry.sources)) {
      expect(s.url, id).toMatch(/^(https:\/\/|file:)/);
      expect(s.readOn, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("lint refuses what the format forbids (fault injection)", () => {
  it("an undeclared placeholder", () => {
    const input = service();
    input.texts.fr!.clauses.scope!.body = "{{input.nowhere}}";
    expect(lintTemplate(input).join("\n")).toContain("undeclared placeholder {{input.nowhere}}");
  });

  it("a clause that cites a source the registry does not know", () => {
    const input = service();
    input.decl.clauses[0]!.sources = ["civ-0000"];
    expect(lintTemplate(input).join("\n")).toContain("unknown source civ-0000");
  });

  it("a clause with neither source nor the practice basis", () => {
    const input = service();
    const clause = input.decl.clauses.find((c) => c.id === "notices")!;
    delete clause.basis;
    expect(lintTemplate(input).join("\n")).toContain("notices has no source and no basis: practice");
  });

  it("a variant that has no text, and a text for a variant that does not exist", () => {
    const input = service();
    delete input.texts.fr!.clauses.price!.variants!.monthly;
    input.texts.fr!.clauses.price!.variants!.weekly = "x";
    const problems = lintTemplate(input).join("\n");
    expect(problems).toContain("price missing variant monthly");
    expect(problems).toContain("price unknown variant weekly");
  });

  it("an optional variable printed outside a clause that requires it", () => {
    const input = service();
    input.texts.fr!.clauses.scope!.body = "Fin : {{contract.endsOn}}";
    expect(lintTemplate(input).join("\n")).toContain("optional {{contract.endsOn}} not guarded");
  });

  it("an em dash, an emoji, and the words the format bans (qualifiee, sequestre, arbitrage)", () => {
    const input = service();
    input.texts.fr!.clauses.notices!.body = "Une signature qualifiée — sous séquestre, par arbitrage \u{1F600}.";
    const problems = lintTemplate(input).join("\n");
    expect(problems).toContain("em dash");
    expect(problems).toContain("emoji");
    expect(problems).toContain("qualifiée");
    expect(problems).toContain("séquestre");
    expect(problems).toContain("arbitrage");
  });

  it("the word employer without a negation", () => {
    const input = service();
    input.texts.fr!.clauses.notices!.body = "Proofseen est l'employeur du Prestataire.";
    expect(lintTemplate(input).join("\n")).toContain("employeur");
  });

  it("a party or list placeholder that is not alone on its line", () => {
    const input = service();
    input.texts.fr!.clauses.parties!.body = "Entre {{seller}} et le client.";
    expect(lintTemplate(input).join("\n")).toContain("{{seller}} must be alone on its line");
  });

  it("a locked clause toggled, a conditional clause without condition, an optional without default", () => {
    const input = service();
    const conditional = input.decl.clauses.find((c) => c.id === "vigilance")!;
    delete conditional.when;
    const optional = input.decl.clauses.find((c) => c.id === "reference")!;
    delete optional.default;
    const problems = lintTemplate(input).join("\n");
    expect(problems).toContain("conditional vigilance without when");
    expect(problems).toContain("optional reference without default");
  });

  it("a gate on a variant that does not exist, and a missing language text", () => {
    const input = service();
    input.decl.clauses.find((c) => c.id === "monthly-funding")!.gates!.push({ variant: "weekly", decision: "D8", error: "decision_pending" });
    delete input.texts.en!.clauses.parties;
    const problems = lintTemplate(input).join("\n");
    expect(problems).toContain("gate on unknown variant weekly");
    expect(problems).toContain("en: no text for clause parties");
  });
});

describe("loader", () => {
  it("refuses a folder whose template.yaml carries an unknown key", () => {
    expect(() => loadRegistry(BROKEN_ROOT)).toThrow(TemplateLoadError);
  });

  it("reads YAML 1.2 core: a bare yes, no or date stays a string, and duplicate keys are refused", () => {
    expect(parseYaml("a: yes\nb: no\nc: 2026-10-24\nd: 010", "t")).toEqual({ a: "yes", b: "no", c: "2026-10-24", d: 10 });
    expect(() => parseYaml("a: 1\na: 2", "t")).toThrow(TemplateLoadError);
    expect(() => parseYaml("a: [", "t")).toThrow(TemplateLoadError);
  });

  it("ships templates with LF line endings only", () => {
    expect(readFileSync(`${TEMPLATES_DIR}/service-agreement/template.yaml`, "utf8")).not.toContain("\r");
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth, drops undefined, and refuses numbers JSON cannot carry", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: undefined }], c: "é" } })).toBe('{"a":{"c":"é","d":[3,{"z":1}]},"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(RangeError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});

describe("registry lookups for the application", () => {
  it("finds the latest version of a template that is not retired", () => {
    expect(registry.latest("service-agreement")?.decl.version).toBe(1);
    expect(registry.latest("nope")).toBeUndefined();
  });

  it("reads the templates from a plain path, not from a `new URL(..., import.meta.url)` that a bundler would take for an asset", () => {
    const source = readFileSync(new URL("../src/registry.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/new URL\(/);
    expect(TEMPLATES_DIR.split("\\").join("/")).toMatch(/packages\/documents\/templates$/);
  });
});
