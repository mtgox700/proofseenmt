import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_ENGINE_ID, ENGINE_ID } from "../src/engine";
import type { DocumentModel } from "../src/model";
import { loadRegistry, type TemplateRegistry } from "../src/registry";
import { renderTemplate, type RenderOptions } from "../src/render";
import { replayVersion, type FrozenVersion } from "../src/replay";
import { demoContract, demoOptionals, demoOptionalVariables, without } from "./support/demo";
import { EXAMPLE_ROOT } from "./support/fixtures";

/*
 * `replayVersion` : le rejeu d'une version rangée redonne EXACTEMENT l'empreinte de contenu rangée, ou refuse avec un nom.
 * `freeze` écrit ce que l'adaptateur de l'application range (apps/web/src/lib/document-renderer.ts, `storedVariables`).
 */

const render = (variables: Record<string, unknown>, options: RenderOptions = {}, id = "service-agreement", registry?: TemplateRegistry): DocumentModel => {
  const rendered = renderTemplate(id, 1, "fr", variables, { ...(registry === undefined ? {} : { registry }), ...options });
  if (!rendered.ok) throw new Error(`${rendered.error.code} : ${rendered.error.message}`);
  return rendered.value;
};

const freeze = (model: DocumentModel, optionalClauses: Record<string, "included" | "excluded"> = {}, engine = ENGINE_ID): FrozenVersion => ({
  templateId: model.templateId,
  templateVersion: String(model.templateVersion),
  engine,
  variables: {
    language: model.language,
    issuedOn: model.issuedOn,
    contentDigest: model.contentDigest,
    templateDigest: model.templateDigest,
    hypotheses: model.hypotheses,
    optionalClauses,
    reviewNotice: model.reviewNotice !== null,
    watermark: model.watermark !== null,
    values: Object.fromEntries(Object.entries(model.variables).map(([name, resolved]) => [name, resolved.value])),
  },
});

const codeOf = (result: ReturnType<typeof replayVersion>): string => (result.ok ? "ok" : result.error.code);

describe("replay gives back exactly the stored content fingerprint", () => {
  it("the reference contract: same canonical content, byte for byte, and same model", () => {
    const model = render(demoContract());
    const replayed = replayVersion(freeze(model));
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.value.canonical).toBe(model.canonical);
    expect(replayed.value.contentDigest).toBe(model.contentDigest);
    expect(replayed.value).toEqual(model);
  });

  it("a test render (watermark) replays to its own fingerprint, which differs from the one of the real document", () => {
    const test = render(demoContract(), { watermark: true });
    const real = render(demoContract());
    expect(test.contentDigest).not.toBe(real.contentDigest);
    const replayed = replayVersion(freeze(test));
    expect(replayed.ok && replayed.value.contentDigest).toBe(test.contentDigest);
    expect(replayed.ok && replayed.value.watermark).toBe("Exemple, non signé");
  });

  it("with the optional clauses the parties chose", () => {
    const options = { optionalClauses: demoOptionals };
    const model = render({ ...demoContract(), ...demoOptionalVariables() }, options);
    const replayed = replayVersion(freeze(model, demoOptionals));
    expect(replayed.ok && replayed.value.contentDigest).toBe(model.contentDigest);
  });

  it("with the defaults the template supplied, hypotheses included (they come back from the template, not from the stored values)", () => {
    const model = render(without(demoContract(), "input.confidentialityYears", "input.subcontractingAllowed", "input.acceptanceWindowDays"));
    expect(model.hypotheses).toEqual(["input.confidentialityYears", "input.subcontractingAllowed"]);
    const replayed = replayVersion(freeze(model));
    expect(replayed.ok && replayed.value.contentDigest).toBe(model.contentDigest);
    expect(replayed.ok && replayed.value.hypotheses).toEqual(model.hypotheses);
  });

  it("in English, and with a stored fingerprint written by a JSON round trip (what the database gives back)", () => {
    const rendered = renderTemplate("service-agreement", 1, "en", demoContract());
    if (!rendered.ok) throw new Error(rendered.error.message);
    const stored = JSON.parse(JSON.stringify(freeze(rendered.value))) as FrozenVersion;
    const replayed = replayVersion(stored);
    expect(replayed.ok && replayed.value.contentDigest).toBe(rendered.value.contentDigest);
  });

  it("accepts a version drawn by another pdfmake (the content fingerprint does not depend on the drawing)", () => {
    const model = render(demoContract());
    expect(codeOf(replayVersion(freeze(model, {}, `${CONTENT_ENGINE_ID} pdfmake/0.4.0`)))).toBe("ok");
  });
});

describe("replay refuses with a name, never an approximate model", () => {
  const model = render(demoContract());
  const withValues = (change: (values: Record<string, unknown>) => Record<string, unknown>): FrozenVersion => {
    const frozen = freeze(model);
    const variables = frozen.variables as { values: Record<string, unknown> };
    return { ...frozen, variables: { ...variables, values: change({ ...variables.values }) } };
  };

  it("a stored value altered where nothing else depends on it: replay_mismatch", () => {
    expect(codeOf(replayVersion(withValues((v) => ({ ...v, "input.scope": `${String(v["input.scope"])} (modifié)` }))))).toBe("replay_mismatch");
  });

  it("a stored amount altered: the calculation no longer falls on the stored derived values, invalid_variable names it", () => {
    const result = replayVersion(withValues((v) => ({ ...v, "contract.totalCents": 400_000 })));
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe("invalid_variable");
    expect(!result.ok && result.error.variables).toContain("computed.vatCents");
  });

  it("a stored value removed: missing_variable", () => {
    expect(codeOf(replayVersion(withValues(({ "input.workMode": _w, ...rest }) => rest)))).toBe("missing_variable");
  });

  it("a stored fingerprint that is not the one of the content: replay_mismatch", () => {
    const frozen = freeze(model);
    const variables = frozen.variables as Record<string, unknown>;
    expect(codeOf(replayVersion({ ...frozen, variables: { ...variables, contentDigest: "0".repeat(64) } }))).toBe("replay_mismatch");
  });

  it("an engine that is not this content engine: engine_unavailable", () => {
    expect(codeOf(replayVersion(freeze(model, {}, "proofseen-documents/2 pdfmake/0.3.12")))).toBe("engine_unavailable");
    expect(codeOf(replayVersion(freeze(model, {}, "fake@1")))).toBe("engine_unavailable");
  });

  it("a template version that is no longer in the registry: template_unavailable", () => {
    expect(codeOf(replayVersion({ ...freeze(model), templateVersion: "2" }))).toBe("template_unavailable");
    expect(codeOf(replayVersion({ ...freeze(model), templateId: "nope" }))).toBe("template_unavailable");
  });

  it("a template whose content is no longer the one of the rendering: template_changed", () => {
    const dir = mkdtempSync(join(tmpdir(), "proofseen-replay-"));
    cpSync(EXAMPLE_ROOT, dir, { recursive: true });
    const first = render({ "document.issuedOn": "2026-10-24", seller: PARTY, "contract.billing": "fixed", "contract.totalCents": 100_000, "contract.currency": "EUR", "computed.vigilanceRequired": false, "input.scope": "Un objet." }, {}, "example", loadRegistry(dir));
    const file = join(dir, "example", "fr.yaml");
    writeFileSync(file, readFileSync(file, "utf8").replace("Le prix est de", "Le prix total est de"));
    expect(codeOf(replayVersion(freeze(first), { registry: loadRegistry(dir) }))).toBe("template_changed");
  });

  it("a review attested since the rendering does not change what the issued document said", () => {
    const dir = mkdtempSync(join(tmpdir(), "proofseen-replay-"));
    cpSync(EXAMPLE_ROOT, dir, { recursive: true });
    const draft = loadRegistry(dir);
    const first = render({ "document.issuedOn": "2026-10-24", seller: PARTY, "contract.billing": "fixed", "contract.totalCents": 100_000, "contract.currency": "EUR", "computed.vigilanceRequired": false, "input.scope": "Un objet." }, {}, "example", draft);
    expect(first.reviewNotice).not.toBeNull();
    const file = join(dir, "example", "template.yaml");
    const digest = draft.find("example", 1)?.digest ?? "";
    writeFileSync(file, readFileSync(file, "utf8").replace("status: draft\n  reviewedBy: null\n  reviewedOn: null\n  reviewedDigest: null", `status: reviewed\n  reviewedBy: "Me Exemple"\n  reviewedOn: "2026-11-02"\n  reviewedDigest: "${digest}"`));
    const reviewed = loadRegistry(dir);
    // Sans l'état de relecture rangé, le rejeu changerait d'empreinte ; avec lui, il redonne celle du document émis.
    const today = render({ "document.issuedOn": "2026-10-24", seller: PARTY, "contract.billing": "fixed", "contract.totalCents": 100_000, "contract.currency": "EUR", "computed.vigilanceRequired": false, "input.scope": "Un objet." }, {}, "example", reviewed);
    expect(today.contentDigest).not.toBe(first.contentDigest);
    const replayed = replayVersion(freeze(first), { registry: reviewed });
    expect(replayed.ok && replayed.value.contentDigest).toBe(first.contentDigest);
  });

  it("stored data that has not the expected shape: frozen_invalid", () => {
    for (const variables of [null, "x", {}, { ...(freeze(model).variables as object), contentDigest: "abc" }, { ...(freeze(model).variables as object), language: "de" }]) {
      expect(codeOf(replayVersion({ ...freeze(model), variables }))).toBe("frozen_invalid");
    }
    expect(codeOf(replayVersion({ ...freeze(model), templateVersion: "abc" }))).toBe("frozen_invalid");
  });
});

const PARTY = { legalName: "Studio Exemple", siret: "00000000000000", vatNumber: null, address: { line1: "1 rue de l'Exemple", postalCode: "69003", city: "Lyon", country: "FR" } };
