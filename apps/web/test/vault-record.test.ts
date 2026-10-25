import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contracts, documents, RenderRefusedError, type DocumentRenderer } from "@proofseen/db";
import { defaultRegistry, type LoadedTemplate } from "@proofseen/documents";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { createDocumentRenderer } from "../src/lib/document-renderer";
import { choiceGroups, readChoices } from "../src/lib/vault/choices";
import { previewVersion } from "../src/lib/vault/replay";
import { recordVersion, type RecordDeps } from "../src/lib/vault/record-version";
import { activeContract, type ActiveContract } from "../../../packages/db/test/support/active-contract";
import { DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";

/*
 * L1.6, T10: « Préparer », played on a real test database. The choices of a posted form go through the real adapter and
 * the real engine to a version kept in the vault, whose preview replays to the same content fingerprint; a second
 * submission of the same form (a double click without JavaScript) records nothing and names the version that won; the
 * engine's refusal names the variables it needs, never a value. Example parties only (the fixtures of packages/db).
 */

let t: TestDatabase;
beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);
afterAll(async () => {
  await t.close();
});

const SCOPE = "Refonte d'exemple de l'espace client : audit, maquettes et intégration des écrans.";
const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const groups = choiceGroups(template.decl, "fr", vaultFr.prepare);
const COMPLETE: Record<string, string> = {
  "input.workMode": "remote",
  "input.ipRegime": "retained",
  "input.acceptanceWindowDays": "15",
  "input.confidentialityYears": "5",
  "input.processesPersonalData": "false",
  "input.subcontractingAllowed": "false",
};

const rig = (renderer: DocumentRenderer | null, now = new Date()): { readonly deps: RecordDeps; readonly files: Map<string, Uint8Array> } => {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    deps: { db: t.db, renderer, storage: { write: async (key, bytes) => void files.set(key, bytes), remove: async (keys) => void keys.forEach((key) => files.delete(key)) }, now: () => now },
  };
};

const inputsOf = (fields: Record<string, string>) => {
  const read = readChoices(groups, (name) => fields[name] ?? null);
  return { read, inputs: { ...read.inputs, optionalClauses: read.optionalClauses } };
};

const pending = (): Promise<ActiveContract> => activeContract(t.db, { scope: SCOPE, deliverables: ["Maquettes d'exemple validées"], signed: false });

describe("recordVersion, from the form to the vault (T10)", () => {
  it("records version 1 from a complete form, through the real engine, and its preview is the PDF's text", async () => {
    const c = await pending();
    const { deps, files } = rig(createDocumentRenderer({ db: () => t.db }));
    const { read, inputs } = inputsOf(COMPLETE);
    expect(read.problems).toEqual([]);
    const outcome = await recordVersion({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", inputs, deps);
    expect(outcome.kind).toBe("recorded");
    if (outcome.kind !== "recorded") return;
    expect(outcome.number).toBe(1);
    expect(files.size).toBe(1);
    const frozen = await documents(t.db).frozen({ userId: c.recruiter }, outcome.documentId, 1);
    expect(frozen?.contentDigest).toBe(outcome.contentDigest);
    const preview = previewVersion({ ...(frozen as NonNullable<typeof frozen>), contentDigest: outcome.contentDigest });
    expect(preview.kind).toBe("ready");
    // The second party, or the same form posted twice, saw version 0: nothing is recorded, the file is deleted.
    const again = await recordVersion({ userId: c.freelanceUser }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", inputs, deps);
    expect(again).toEqual({ kind: "stale", latest: 1 });
    expect(files.size).toBe(1);
  }, 120_000);

  it("names what the engine needs, never a value, when a choice is missing", async () => {
    const c = await pending();
    const { deps, files } = rig(createDocumentRenderer({ db: () => t.db }));
    const { inputs } = inputsOf({ ...COMPLETE, "input.ipRegime": "" });
    const outcome = await recordVersion({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", inputs, deps);
    expect(outcome.kind).toBe("engine");
    if (outcome.kind === "engine") expect(outcome.missing).toContain("input.ipRegime");
    expect(files.size).toBe(0);
  }, 120_000);

  it("refuses a new version once a party has accepted, before any rendering", async () => {
    const c = await pending();
    let rendered = 0;
    const fake: DocumentRenderer = {
      async render() {
        rendered += 1;
        throw new RenderRefusedError("never");
      },
    };
    await contracts(t.db).sign({ userId: c.freelanceUser }, c.id, new Date());
    const outcome = await recordVersion({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", {}, rig(fake).deps);
    expect(outcome).toEqual({ kind: "refused", reason: "state" });
    expect(rendered).toBe(0);
  });

  it("says the engine is not plugged, rather than failing, and refuses bytes that are not a PDF", async () => {
    const c = await pending();
    expect(await recordVersion({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", {}, rig(null).deps)).toEqual({ kind: "unconfigured" });
    const notPdf: DocumentRenderer = { render: async () => ({ bytes: new TextEncoder().encode("<html>"), templateId: "service-agreement", templateVersion: "1", engine: "fake@1", contentDigest: createHash("sha256").update("x").digest("hex"), variables: {} }) };
    const { deps, files } = rig(notPdf);
    expect(await recordVersion({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" }, 0, "première version", {}, deps)).toEqual({ kind: "server" });
    expect(files.size).toBe(0);
  });
});
