import { createHash } from "node:crypto";
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { documents, RenderRefusedError, type Actor, type RenderRequest } from "@proofseen/db";
import { createDocument, type VaultDeps } from "../src/app/api/documents/vault";
import { createDocumentRenderer, splitInputs } from "../src/lib/document-renderer";
import { amendmentVariables, ndaVariables, quoteVariables, reportVariables, vigilanceOf, type Context } from "../src/lib/document-variables";
import { activeContract, type ActiveContract } from "../../../packages/db/test/support/active-contract";
import { DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { extractFromStreams } from "../../../packages/documents/test/support/pdf-text";

/*
 * The adapter between the vault and the document engine, played on a real test database with the REAL engine (templates,
 * fonts, pdfmake): what a party may type, what the facts of the contract fill in, what the engine refuses and how that
 * reaches the API (409 « gabarit incomplet » with the names of the variables to supply, never a value).
 */

let t: TestDatabase;
let engine: Context["engine"];

beforeAll(async () => {
  t = await openTestDatabase();
  engine = await import("@proofseen/documents");
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

afterEach(() => vi.unstubAllEnvs());

const NOW = new Date("2026-11-20T10:00:00Z");
const SCOPE = "Refonte de l'espace client : audit, maquettes et intégration des écrans.";
const DELIVERABLES = ["Audit de l'existant", "Maquettes validées"];

/** Les choix des parties que le contrat de prestation exige et que le gabarit ne devine pas (aucune valeur par défaut qui soit une hypothèse). */
const CHOICES = { "input.workMode": "remote", "input.ipRegime": "retained", "input.processesPersonalData": false, "input.confidentialityYears": 5, "input.subcontractingAllowed": false };

const pending = (days = 5): Promise<ActiveContract> => activeContract(t.db, { days, scope: SCOPE, deliverables: DELIVERABLES, signed: false });

const rig = (actor: Actor, verifyPage?: boolean): { readonly deps: VaultDeps; readonly files: Map<string, Buffer> } => {
  const files = new Map<string, Buffer>();
  const deps: VaultDeps = {
    open: true,
    db: () => t.db,
    authenticate: async () => ({ kind: "actor", actor }) as Awaited<ReturnType<VaultDeps["authenticate"]>>,
    renderer: createDocumentRenderer({ db: () => t.db, ...(verifyPage === undefined ? {} : { verifyPage }) }),
    storage: {
      write: async (key, bytes) => void files.set(key, Buffer.from(bytes)),
      read: async (key) => files.get(key) ?? null,
      remove: async (keys) => void keys.forEach((key) => files.delete(key)),
    },
    now: () => NOW,
    tooMany: async () => false,
  };
  return { deps, files };
};

const post = (body: unknown): Request => new Request("http://localhost/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const open = (c: ActiveContract, extra: Record<string, unknown>): Request => post({ attendu: 0, affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr", ...extra });

/** La demande de rendu que le coffre remettrait au moteur pour cette affaire. */
const requestFor = async (actor: Actor, affair: { kind: "contract" | "quote" | "conversation"; id: string }, type: RenderRequest["type"], inputs: Record<string, unknown> = {}): Promise<RenderRequest> => {
  const prepared = await documents(t.db).prepare(actor, { affair, type, lang: "fr" }, 0);
  if (prepared.kind !== "ready") throw new Error(`${prepared.kind}`);
  return { type, lang: "fr", facts: prepared.facts, version: prepared.nextVersion, slot: prepared.slot, at: NOW, inputs };
};

const refusal = async (promise: Promise<unknown>): Promise<RenderRefusedError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RenderRefusedError) return error;
    throw error;
  }
  throw new Error("un refus était attendu");
};

const json = async (response: Response): Promise<Record<string, unknown>> => (await response.json()) as Record<string, unknown>;

describe("what a party may type", () => {
  const allowed = new Set(["input.workMode", "input.ipRegime"]);

  it("accepts the inputs the template declares and the choice of optional clauses", () => {
    expect(splitInputs({ "input.workMode": "remote", optionalClauses: { insurance: "included" } }, allowed)).toEqual({ values: { "input.workMode": "remote" }, optionalClauses: { insurance: "included" } });
    expect(splitInputs({}, allowed)).toEqual({ values: {}, optionalClauses: {} });
  });

  it("refuses a fact of the contract, a computation, a decision and the object that the contract already carries", () => {
    for (const key of ["contract.totalCents", "seller", "computed.moneyAfterPayout", "decision.d8MonthlyFunding", "input.scope", "document.issuedOn", "platform.feePayer"]) {
      try {
        splitInputs({ "input.workMode": "remote", [key]: "x" }, allowed);
        throw new Error(`${key} aurait dû être refusé`);
      } catch (error) {
        expect(error).toBeInstanceOf(RenderRefusedError);
        expect((error as RenderRefusedError).missing).toEqual([key]);
      }
    }
  });

  it("refuses a malformed choice of clauses", () => {
    expect(() => splitInputs({ optionalClauses: { insurance: "yes" } }, allowed)).toThrow(RenderRefusedError);
    expect(() => splitInputs({ optionalClauses: "all" }, allowed)).toThrow(RenderRefusedError);
  });
});

describe("the service agreement through the real engine", () => {
  it("asks for the choices the template needs and names them, never a value", async () => {
    const c = await pending();
    const { deps, files } = rig({ userId: c.recruiter });
    const response = await createDocument(open(c, {}), deps);
    expect(response.status).toBe(409);
    const body = await json(response);
    expect(body).toMatchObject({ ok: false, error: "gabarit incomplet", code: "missing_variable" });
    expect(body.missing).toEqual(["input.confidentialityYears", "input.ipRegime", "input.processesPersonalData", "input.subcontractingAllowed", "input.workMode"]);
    expect(JSON.stringify(body)).not.toContain(SCOPE);
    expect(files.size).toBe(0);
  });

  it("renders, stores and fingerprints a real PDF when the parties have chosen", async () => {
    const c = await pending();
    const { deps, files } = rig({ userId: c.recruiter });
    const response = await createDocument(open(c, { inputs: CHOICES }), deps);
    expect(response.status).toBe(201);
    const { data } = (await json(response)) as { data: { version: { number: number; sha256: string; contentDigest: string; templateVersion: string; engine: string } } };
    const [[, bytes]] = [...files.entries()];
    expect(bytes?.subarray(0, 8).toString("latin1")).toBe("%PDF-1.7");
    expect(data.version.sha256).toBe(createHash("sha256").update(bytes ?? "").digest("hex"));
    expect(data.version).toMatchObject({ number: 1, templateVersion: "1", engine: engine.ENGINE_ID });
    const stored = await t.db.documentVersion.findFirstOrThrow({ where: { document: { contractId: c.id } } });
    const variables = stored.variables as { issuedOn: string; contentDigest: string; values: Record<string, unknown> };
    expect(variables.issuedOn).toBe("2026-11-20");
    expect(variables.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    // L'empreinte du contenu (celle du pied de page, que le poinçon de l'écran dessine) est une colonne de la version, à côté de celle du fichier.
    expect(stored.contentDigest).toBe(variables.contentDigest);
    expect(data.version.contentDigest).toBe(variables.contentDigest);
    expect(data.version.contentDigest).not.toBe(data.version.sha256);
    expect(variables.values).toMatchObject({ "contract.feePayer": "freelance", "input.scope": SCOPE, "input.workMode": "remote", "document.versionNumber": 1, "computed.vigilanceRequired": false });
    // L1-133 : le rejeu des données figées redonne exactement l'empreinte de contenu rangée (aperçu vérifié, /verifier).
    const replayed = engine.replayVersion({ templateId: "service-agreement", templateVersion: data.version.templateVersion, engine: data.version.engine, variables: stored.variables });
    expect(replayed.ok && replayed.value.contentDigest).toBe(variables.contentDigest);
  });

  it("prints the verification address only when the verification page exists (option off by default, L1-159 Kensa M3)", async () => {
    const printed = async (verifyPage: boolean | undefined): Promise<string> => {
      const c = await pending();
      const { deps, files } = rig({ userId: c.recruiter }, verifyPage);
      expect((await createDocument(open(c, { inputs: CHOICES }), deps)).status).toBe(201);
      const [[, bytes]] = [...files.entries()];
      return extractFromStreams(bytes ?? Buffer.alloc(0)).replace(/\s+/g, " ");
    };
    const without = await printed(undefined);
    expect(without).toContain("non du fichier");
    expect(without).not.toContain("Vérification");
    expect(without).not.toContain("verifier");
    const withPage = await printed(true);
    expect(withPage).toContain("Vérification");
    expect(withPage).toContain("verifier");
  });

  it("never lets a typed value override a fact of the contract", async () => {
    const c = await pending();
    const { deps, files } = rig({ userId: c.recruiter });
    const response = await createDocument(open(c, { inputs: { ...CHOICES, "contract.totalCents": 1 } }), deps);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ error: "gabarit incomplet", code: "invalid_variable", missing: ["contract.totalCents"] });
    expect(files.size).toBe(0);
  });

  it("refuses a contact detail typed into a free text, naming the variable", async () => {
    const c = await pending();
    const { deps } = rig({ userId: c.recruiter });
    const inputs = { ...CHOICES, "input.processesPersonalData": true, "input.dpaDetails": "Écrivez à jean.exemple@gmail.com pour le détail." };
    const response = await createDocument(open(c, { inputs }), deps);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "invalid_variable", missing: ["input.dpaDetails"] });
  });

  it("asks for the attestation of vigilance clause when the contract alone reaches the threshold, and not below", async () => {
    const small = await pending(5);
    const large = await pending(10);
    const read = async (c: ActiveContract, days: number) => {
      const request = await requestFor({ userId: c.recruiter }, { kind: "contract", id: c.id }, "service_agreement");
      if (request.facts.kind !== "contract") throw new Error("contrat attendu");
      const row = await t.db.contract.findUniqueOrThrow({ where: { id: c.id }, select: { organisationId: true, profileId: true, costCenter: true, feePayer: true } });
      return { days, ...(await vigilanceOf(t.db, request.facts.contract, row, NOW)) };
    };
    expect(await read(small, 5)).toMatchObject({ required: false, thresholdCents: 500_000 });
    expect(await read(large, 10)).toMatchObject({ required: true, thresholdCents: 500_000 });
  });
});

describe("the other documents", () => {
  it("quote: the reference of the freelance, the name of the company and the VAT rate come from the profile, the commission from the configuration", async () => {
    const c = await pending();
    vi.stubEnv("PROOFSEEN_COMMISSION_BP", "1000");
    const request = await requestFor({ userId: c.recruiter }, { kind: "quote", id: c.quoteId }, "quote");
    const variables = await quoteVariables({ db: t.db, request, engine, choices: {} });
    const profile = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: c.profile }, select: { reference: true } });
    expect(variables).toMatchObject({
      "quote.id": c.quoteId,
      "seller.reference": profile.reference,
      "buyer.name": "Acme SAS",
      "computed.vatRegime": "standard",
      "computed.vatRateBp": 2000,
      "platform.commissionBp": 1000,
      "platform.feePayer": "freelance",
      "input.scope": SCOPE,
    });
    expect(variables["input.validUntil"]).toBeNull();
  });

  it("quote: without a commission configured or a validity, the engine asks for them by name", async () => {
    const c = await pending();
    vi.stubEnv("PROOFSEEN_COMMISSION_BP", "");
    const { deps } = rig({ userId: c.recruiter });
    const response = await createDocument(post({ attendu: 0, affair: { kind: "quote", id: c.quoteId }, type: "quote", lang: "fr" }), deps);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "missing_variable", missing: ["input.validUntil", "platform.commissionBp"] });
  });

  it("nda: both identities come from the billing identities of the thread", async () => {
    const c = await pending();
    const request = await requestFor({ userId: c.recruiter }, { kind: "conversation", id: c.conversationId }, "nda");
    const variables = await ndaVariables({ db: t.db, request, engine, choices: {} });
    expect(variables).toMatchObject({ freelance: { legalName: "Camille Test EI" }, company: { legalName: "Acme SAS" }, "document.signatureMethod": "platform_acceptance" });
  });

  it("report: refuses a recipe deemed accepted (no deadline is coded), reads the approvals required and the last approval", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    const request = await requestFor({ userId: c.recruiter }, { kind: "contract", id: c.id }, "acceptance_report");
    expect((await refusal(reportVariables({ db: t.db, request, engine, choices: { "report.decision": "deemed_accepted" } }))).missing).toEqual(["report.decision"]);
    const variables = await reportVariables({ db: t.db, request, engine, choices: { "report.decision": "accepted" } });
    expect(variables).toMatchObject({ "buyer.approvalsRequired": 1, "report.decidedOn": null, "contract.deliverables": DELIVERABLES });
  });

  it("amendment: the rank is the slot of the document, the price never moves, the change lines are computed from the values", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    const request = { ...(await requestFor({ userId: c.recruiter }, { kind: "contract", id: c.id }, "amendment")), slot: 3 };
    const variables = await amendmentVariables({ db: t.db, request, engine, choices: { "input.newEndsOn": "2027-02-26", "input.newDeliverables": ["Audit de l'existant", "Prototype"] } });
    expect(variables).toMatchObject({ "amendment.rank": 3, "computed.moneyAfterPayout": "none", "contract.currency": "EUR" });
    expect(variables["computed.changeLines"]).toHaveLength(3);
  });

  it("any other kind of affair is refused rather than rendered with guessed facts", async () => {
    const c = await pending();
    const request = await requestFor({ userId: c.recruiter }, { kind: "contract", id: c.id }, "service_agreement");
    const wrongType = { ...request, type: "quote" as const };
    const { deps } = rig({ userId: c.recruiter });
    expect((await refusal(deps.renderer?.render(wrongType) ?? Promise.resolve())).code).toBe("affair_not_supported");
  });
});
