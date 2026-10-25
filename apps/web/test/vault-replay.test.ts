import { ENGINE_ID, renderTemplate, type DocumentModel } from "@proofseen/documents";
import { describe, expect, it } from "vitest";
import { previewVersion, type StoredVersion } from "../src/lib/vault/replay";
import { demoContract } from "../../../packages/documents/test/support/demo";

/*
 * L1.6, T4: the preview of a version is the PDF's text or nothing. The reference contract of the document engine is
 * rendered, stored the way the vault stores it, replayed: same content fingerprint, byte for byte of the canonical
 * content. One altered value, or a column that disagrees: unavailable, never an approximate text.
 */

const render = (): DocumentModel => {
  const rendered = renderTemplate("service-agreement", 1, "fr", demoContract());
  if (!rendered.ok) throw new Error(rendered.error.code);
  return rendered.value;
};

const store = (model: DocumentModel): StoredVersion => ({
  templateId: model.templateId,
  templateVersion: String(model.templateVersion),
  engine: ENGINE_ID,
  contentDigest: model.contentDigest,
  variables: {
    language: model.language,
    issuedOn: model.issuedOn,
    contentDigest: model.contentDigest,
    templateDigest: model.templateDigest,
    hypotheses: model.hypotheses,
    optionalClauses: {},
    reviewNotice: model.reviewNotice !== null,
    values: Object.fromEntries(Object.entries(model.variables).map(([name, resolved]) => [name, resolved.value])),
  },
});

describe("the preview of a stored version (T4)", () => {
  it("replays the reference contract to the same content fingerprint and the same canonical content", () => {
    const model = render();
    const preview = previewVersion(store(model));
    expect(preview.kind).toBe("ready");
    if (preview.kind !== "ready") return;
    expect(preview.model.contentDigest).toBe(model.contentDigest);
    expect(preview.model.canonical).toBe(model.canonical);
  });

  it("refuses an altered value, by its name, rather than show an approximate text", () => {
    const stored = store(render());
    const variables = stored.variables as { values: Record<string, unknown> };
    const name = Object.keys(variables.values).find((key) => key.startsWith("input.acceptanceWindowDays")) ?? Object.keys(variables.values)[0] ?? "";
    const altered = { ...stored, variables: { ...variables, values: { ...variables.values, [name]: 29 } } };
    const preview = previewVersion(altered);
    expect(preview.kind).toBe("unavailable");
  });

  it("refuses when the vault's own column disagrees with the replayed fingerprint", () => {
    const stored = store(render());
    expect(previewVersion({ ...stored, contentDigest: "0".repeat(64) })).toEqual({ kind: "unavailable", code: "column_mismatch" });
  });

  it("refuses frozen values of the wrong shape, an unknown template, an engine that is gone", () => {
    const stored = store(render());
    expect(previewVersion({ ...stored, variables: {} })).toEqual({ kind: "unavailable", code: "frozen_invalid" });
    expect(previewVersion({ ...stored, templateId: "nope" })).toEqual({ kind: "unavailable", code: "template_unavailable" });
    expect(previewVersion({ ...stored, engine: "other-engine@9" }).kind).toBe("unavailable");
  });
});
