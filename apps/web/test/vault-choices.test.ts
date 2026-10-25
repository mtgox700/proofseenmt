import { createHash } from "node:crypto";
import { defaultRegistry, type LoadedTemplate } from "@proofseen/documents";
import { fingerprintMark } from "@proofseen/brand/fingerprint-mark";
import { describe, expect, it } from "vitest";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { allFields, choiceGroups, engineProblems, fieldId, initialDraft, readChoices } from "../src/lib/vault/choices";
import { downloadFallback } from "../src/lib/vault/download-fallback";
import { draftStore, DRAFT_TTL_MS } from "../src/lib/vault/drafts";
import { INK_BANDS, markBands } from "../src/lib/vault/mark-rows";
import { authorLabel, inkingVersion, INK_WINDOW_MS, kilobytes, readCompare } from "../src/lib/vault/versions";

/*
 * L1.6, T6 and T10: the choices of the form from the template's declaration, what the server keeps of a posted form,
 * the draft that brings a form back without JavaScript, the bands of ink of M1, and the small facts the screens share.
 * Example values only.
 */

const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const groups = choiceGroups(template.decl, "fr", vaultFr.prepare);
const form = (fields: Record<string, string>) => (name: string) => fields[name] ?? null;
const COMPLETE = {
  "input.workMode": "remote",
  "input.ipRegime": "retained",
  "input.acceptanceWindowDays": "15",
  "input.confidentialityYears": "5",
  "input.processesPersonalData": "false",
  "input.subcontractingAllowed": "false",
};

describe("choiceGroups (T10)", () => {
  it("lays the fieldsets in the storyboard's order, each control from the template's declaration", () => {
    expect(groups.map((g) => g.id)).toEqual(["work-mode", "ip-regime", "ip-rights", "acceptance", "confidentiality", "personal-data", "subcontracting", "optional"]);
    const workMode = groups[0]?.fields[0];
    expect(workMode).toMatchObject({ name: "input.workMode", id: "f-work-mode", control: "radio", label: "Lieu d'exécution" });
    expect(workMode?.options.map((o) => o.label)).toEqual(["à distance", "dans les locaux du Client", "en partie à distance, en partie dans les locaux du Client"]);
    expect(allFields(groups).find((f) => f.name === "input.acceptanceWindowDays")).toMatchObject({ control: "number", min: 1, max: 30 });
    expect(allFields(groups).find((f) => f.name === "input.dpaDetails")).toMatchObject({ control: "textarea", maxLength: 4000, condition: { kind: "var", name: "input.processesPersonalData", values: ["true"] } });
  });

  it("says whose choice it is, from `editableBy` and `toggledBy`", () => {
    const owner = (id: string) => groups.find((g) => g.id === id)?.owner;
    expect(owner("work-mode")).toBe("common");
    expect(owner("personal-data")).toBe("client");
    expect(owner("subcontracting")).toBe("client");
    const toggles = groups.find((g) => g.id === "optional")?.toggles ?? [];
    expect(toggles.map((t) => [t.clause, t.owner])).toEqual([
      ["insurance", "provider"],
      ["non-solicitation", "common"],
      ["reference", "client"],
    ]);
  });

  it("names a field id from its variable, never shows the variable", () => {
    expect(fieldId("input.ipDurationYears")).toBe("f-ip-duration-years");
    expect(JSON.stringify(groups.map((g) => g.legend))).not.toContain("input.");
  });
});

describe("readChoices (T10)", () => {
  it("keeps a complete form, typed", () => {
    const read = readChoices(groups, form(COMPLETE));
    expect(read.problems).toEqual([]);
    expect(read.inputs).toEqual({ "input.workMode": "remote", "input.ipRegime": "retained", "input.acceptanceWindowDays": 15, "input.confidentialityYears": 5, "input.processesPersonalData": false, "input.subcontractingAllowed": false });
    expect(read.optionalClauses).toEqual({ insurance: "excluded", "non-solicitation": "excluded", reference: "excluded" });
  });

  it("ignores ipPurpose when the rights are retained, even if the hidden field was sent", () => {
    const read = readChoices(groups, form({ ...COMPLETE, "input.ipPurpose": "un usage d'exemple", "input.ipDurationYears": "10" }));
    expect(read.inputs).not.toHaveProperty("input.ipPurpose");
    expect(read.inputs).not.toHaveProperty("input.ipDurationYears");
  });

  it("asks for the rights' purpose, territory and duration once they are assigned", () => {
    const read = readChoices(groups, form({ ...COMPLETE, "input.ipRegime": "assignment" }));
    expect(read.problems).toEqual([
      { name: "input.ipPurpose", kind: "text" },
      { name: "input.ipTerritory", kind: "choose" },
      { name: "input.ipDurationYears", kind: "number" },
    ]);
  });

  it("names each problem: a choice not made, a number out of bounds, contact details in a text", () => {
    const read = readChoices(groups, form({ ...COMPLETE, "input.ipRegime": "", "input.acceptanceWindowDays": "45", "input.processesPersonalData": "true", "input.dpaDetails": "Écrire à exemple@exemple.fr" }));
    expect(read.problems).toEqual([
      { name: "input.ipRegime", kind: "choose" },
      { name: "input.acceptanceWindowDays", kind: "number" },
      { name: "input.dpaDetails", kind: "contact" },
    ]);
    expect(read.draft["input.acceptanceWindowDays"]).toBe("45");
  });

  it("reads an optional article and its own fields only when it is added", () => {
    const without = readChoices(groups, form({ ...COMPLETE, "input.nonSolicitationMonths": "6" }));
    expect(without.inputs).not.toHaveProperty("input.nonSolicitationMonths");
    const added = readChoices(groups, form({ ...COMPLETE, "clause.non-solicitation": "included", "input.nonSolicitationMonths": "6" }));
    expect(added.inputs["input.nonSolicitationMonths"]).toBe(6);
    expect(added.optionalClauses["non-solicitation"]).toBe("included");
  });

  it("starts a version 1 from decisions only, never an HYPOTHESIS default; a version 2 from the current one", () => {
    const first = initialDraft(template.decl, groups, null);
    expect(first["input.acceptanceWindowDays"]).toBe("15");
    expect(first).not.toHaveProperty("input.confidentialityYears");
    expect(first).not.toHaveProperty("input.subcontractingAllowed");
    const next = initialDraft(template.decl, groups, { values: { "input.confidentialityYears": 3, "input.subcontractingAllowed": false }, optionalClauses: { reference: "included" } });
    expect(next).toMatchObject({ "input.confidentialityYears": "3", "input.subcontractingAllowed": "false", "clause.reference": "included" });
  });

  it("splits the names the engine found missing into fields and facts of the contract", () => {
    expect(engineProblems(groups, ["input.ipRegime", "contract.commissionBp"])).toEqual({ fields: [{ name: "input.ipRegime", kind: "choose" }], facts: ["contract.commissionBp"] });
  });
});

describe("drafts (T10)", () => {
  const draft = { userId: "u1", contractId: "c1", values: { "input.workMode": "remote" }, problems: [], facts: [], refusal: null, message: null } as const;
  it("gives a draft back to its person, on its contract, for ten minutes", () => {
    const store = draftStore();
    const now = new Date("2026-10-25T10:00:00Z");
    const key = store.keep(draft, now);
    expect(store.take(key, "u1", "c1", now)).toEqual(draft);
    expect(store.take(key, "u2", "c1", now)).toBeNull();
    expect(store.take(key, "u1", "c2", now)).toBeNull();
    expect(store.take(key, "u1", "c1", new Date(now.getTime() + DRAFT_TTL_MS))).toBeNull();
    expect(store.take("pas-une-cle", "u1", "c1", now)).toBeNull();
  });
});

describe("markBands (T6, M1)", () => {
  const fingerprint = createHash("sha256").update("Contrat d'exemple, version 1.", "utf8").digest("hex");
  it("cuts the cells of the 32 px level into four bands whose union is the frozen drawing", () => {
    const { geometry, bands } = markBands(fingerprint, 32);
    expect(bands).toHaveLength(INK_BANDS);
    expect(bands.join("")).toBe(fingerprintMark(fingerprint, 32).cells);
    expect(geometry).toEqual(fingerprintMark(fingerprint, 32));
    expect(bands.filter((band) => band !== "").length).toBeGreaterThan(1);
  });
  it("has no band at 16 px, where the mark draws no cell", () => {
    expect(markBands(fingerprint, 16).bands).toEqual(["", "", "", ""]);
  });
});

describe("versions (T5, T6, T9)", () => {
  const who = vaultFr.who;
  it("names an author by side, never by name", () => {
    expect(authorLabel({ by: "you", side: "company" }, who)).toBe("vous");
    expect(authorLabel({ by: "colleague", side: "company" }, who)).toBe("votre entreprise");
    expect(authorLabel({ by: "other_party", side: "freelance" }, who)).toBe("le freelance");
    expect(authorLabel({ by: "other_party", side: "company" }, who)).toBe("l'entreprise");
    expect(authorLabel({ by: "former_member", side: null }, who)).toBe("un ancien membre de l'entreprise");
    expect(authorLabel({ by: "removed", side: null }, who)).toBe("un compte supprimé");
  });

  it("rounds a size up to the kilobyte", () => {
    expect(kilobytes(421_000)).toBe(412);
    expect(kilobytes(1)).toBe(1);
  });

  it("inks only your latest version, born less than ten minutes ago, named in the address", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    const latest = { number: 3, by: "you" as const, createdAt: new Date(now.getTime() - 60_000) };
    expect(inkingVersion("3", latest, now)).toBe(3);
    expect(inkingVersion("2", latest, now)).toBeNull();
    expect(inkingVersion("3", { ...latest, by: "other_party" }, now)).toBeNull();
    expect(inkingVersion("3", { ...latest, createdAt: new Date(now.getTime() - INK_WINDOW_MS - 1) }, now)).toBeNull();
    expect(inkingVersion(null, latest, now)).toBeNull();
  });

  it("reads the two versions of a comparison address", () => {
    expect(readCompare("2", "3", 3)).toEqual({ kind: "ok", from: 2, to: 3 });
    expect(readCompare("3", "2", 3)).toEqual({ kind: "redirect", from: 2, to: 3 });
    expect(readCompare(null, "3", 3)).toEqual({ kind: "ok", from: 2, to: 3 });
    expect(readCompare(null, null, 3)).toEqual({ kind: "ok", from: 2, to: 3 });
    expect(readCompare("2", "2", 3)).toEqual({ kind: "same", number: 2 });
    expect(readCompare("1", "9", 3)).toEqual({ kind: "unknown" });
    expect(readCompare("x", "2", 3)).toEqual({ kind: "unknown" });
    expect(readCompare(null, null, 1)).toEqual({ kind: "single" });
  });
});

describe("downloadFallback (T11)", () => {
  const id = "00000000-0000-4000-8000-0000000000d1";
  const failed = () => new Response(JSON.stringify({ ok: false, error: "erreur serveur" }), { status: 500 });
  it("sends a navigation that failed back to the document, with the error in words", () => {
    const request = new Request(`https://exemple.test/api/documents/${id}/versions/2`, { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", referer: `https://exemple.test/en/app/documents/${id}` } });
    const response = downloadFallback(request, failed(), id, "2");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/en/app/documents/${id}?version=2&erreur=telechargement`);
  });
  it("leaves a script's request, and a success, exactly as the API answered", () => {
    const fetchRequest = new Request(`https://exemple.test/api/documents/${id}/versions/2`, { headers: { "sec-fetch-mode": "cors" } });
    const original = failed();
    expect(downloadFallback(fetchRequest, original, id, "2")).toBe(original);
    const ok = new Response("%PDF-", { status: 200 });
    expect(downloadFallback(new Request("https://exemple.test/x", { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" } }), ok, id, "2")).toBe(ok);
  });
});
