import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contracts, RenderRefusedError, type Actor, type DocumentRenderer, type RenderRequest } from "@proofseen/db";
import { addDocumentVersion, createDocument, downloadVersion, listDocuments, showDocument, vaultOpen, type VaultDeps } from "../src/app/api/documents/vault";
import { activeContract, type ActiveContract } from "../../../packages/db/test/support/active-contract";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";

/*
 * The vault API (L1.3), played on a real test database with a fake renderer and an in-memory volume: a party reads and
 * writes, everyone else gets the same 404 as for a document that does not exist, a download is never cached, never
 * indexed and only served if the bytes still match their fingerprint. No network, no Stripe, no real renderer.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T10:00:00Z");
const SCOPE = "Développement de la plateforme de données : ingestion, modèles dbt et tableaux de bord.";

const pdfOf = (label: string): Uint8Array => new TextEncoder().encode(`%PDF-1.7\n% ${label}\n%%EOF\n`);

/** L'empreinte du contenu rendu (celle du pied de page), distincte de l'empreinte du fichier. */
const digestOf = (label: string): string => createHash("sha256").update(`contenu:${label}`).digest("hex");

interface Rig {
  readonly deps: VaultDeps;
  readonly files: Map<string, Buffer>;
  readonly requests: RenderRequest[];
  readonly setActor: (actor: Actor | null) => void;
}

const rig = (overrides: Partial<VaultDeps> = {}, renderer: DocumentRenderer | null | "default" = "default"): Rig => {
  const files = new Map<string, Buffer>();
  const requests: RenderRequest[] = [];
  let current: Actor | null = null;
  const fake: DocumentRenderer = {
    async render(request) {
      requests.push(request);
      return { bytes: pdfOf(`${request.type} v${request.version} ${request.at.toISOString()}`), templateId: "service-agreement", templateVersion: "1.0.0", engine: "fake@1", contentDigest: digestOf(`${request.type} v${request.version}`), variables: { kind: request.facts.kind } };
    },
  };
  const deps: VaultDeps = {
    open: true,
    db: () => t.db,
    authenticate: async () => (current === null ? { kind: "refused", response: NextResponse.json({ ok: false, error: "non-connecté" }, { status: 401 }) } : { kind: "actor", actor: current }),
    renderer: renderer === "default" ? fake : renderer,
    storage: {
      write: async (key, bytes) => void files.set(key, Buffer.from(bytes)),
      read: async (key) => files.get(key) ?? null,
      remove: async (keys) => void keys.forEach((key) => files.delete(key)),
    },
    now: () => NOW,
    tooMany: async () => false,
    ...overrides,
  };
  return { deps, files, requests, setActor: (actor) => void (current = actor) };
};

const post = (path: string, body: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const get = (path: string): Request => new Request(`http://localhost${path}`);

const pending = (): Promise<ActiveContract> => activeContract(t.db, { scope: SCOPE, deliverables: ["Pipelines documentés"], signed: false });

/** `attendu` : la dernière version vue par l'écran (0 : aucune), obligatoire à chaque envoi. */
const create = (c: ActiveContract, r: Rig, extra: Record<string, unknown> = {}) => createDocument(post("/api/documents", { attendu: 0, affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr", ...extra }), r.deps);

const addVersion = (id: string, r: Rig, body: Record<string, unknown>) => addDocumentVersion(post(`/api/documents/${id}/versions`, body), id, r.deps);

describe("le coffre est fermé tant que le founder ne l'ouvre pas en production", () => {
  it("s'ouvre hors production, et en production seulement avec PROOFSEEN_VAULT_OPEN=GO", () => {
    expect(vaultOpen({ NODE_ENV: "development" })).toBe(true);
    expect(vaultOpen({})).toBe(true);
    expect(vaultOpen({ NODE_ENV: "production" })).toBe(false);
    expect(vaultOpen({ NODE_ENV: "production", PROOFSEEN_VAULT_OPEN: "yes" })).toBe(false);
    expect(vaultOpen({ NODE_ENV: "production", PROOFSEEN_VAULT_OPEN: "GO" })).toBe(true);
  });

  it("fermé, chaque route répond « non-configuré » avant de lire quoi que ce soit", async () => {
    const c = await pending();
    const r = rig({ open: false });
    r.setActor({ userId: c.recruiter });
    for (const response of [
      await listDocuments(get(`/api/documents?kind=contract&id=${c.id}`), r.deps),
      await showDocument(c.id, r.deps),
      await create(c, r),
      await addDocumentVersion(post("/api/documents/x/versions", {}), c.id, r.deps),
      await downloadVersion(c.id, "1", r.deps),
    ]) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, error: "non-configuré" });
    }
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(0);
  });

  it("sans personne connectée, la réponse de l'authentification passe telle quelle", async () => {
    const c = await pending();
    const r = rig();
    const response = await listDocuments(get(`/api/documents?kind=contract&id=${c.id}`), r.deps);
    expect(response.status).toBe(401);
  });
});

describe("créer, lire, télécharger", () => {
  it("une partie ouvre le contrat de prestation : la version est rendue par le serveur, empreinte, rangée sur le volume et consignée", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const response = await create(c, r);
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { document: { id: string; type: string; versionCount: number }; version: { number: number; sha256: string; contentDigest: string; size: number; by: string } } };
    expect(data.document).toMatchObject({ type: "service_agreement", versionCount: 1 });
    expect(data.version).toMatchObject({ number: 1, by: "you" });
    // L'empreinte est celle des octets exacts rangés.
    const [[key, stored]] = [...r.files.entries()];
    expect(data.version.sha256).toBe(createHash("sha256").update(stored ?? "").digest("hex"));
    expect(data.version.size).toBe(stored?.length);
    // L'empreinte du contenu (celle que le PDF imprime) vient du moteur, à côté de celle du fichier, et n'est pas la même.
    expect(data.version.contentDigest).toBe(digestOf("service_agreement v1"));
    expect(data.version.contentDigest).not.toBe(data.version.sha256);
    expect(await t.db.documentVersion.count({ where: { storageKey: key, documentId: data.document.id } })).toBe(1);
    // Le moteur reçoit les faits du contrat et la date de la version, jamais l'horloge du rendu.
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0]).toMatchObject({ type: "service_agreement", lang: "fr", version: 1, at: NOW, facts: { kind: "contract", contract: { id: c.id, scope: SCOPE } } });
    expect(await t.db.documentVersion.findFirstOrThrow({ where: { documentId: data.document.id } })).toMatchObject({ createdAt: NOW, engine: "fake@1" });
  });

  it("l'autre partie liste, lit le détail, télécharge ; chaque téléchargement est consigné", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string }; version: { sha256: string } } };
    const id = created.data.document.id;
    r.setActor({ userId: c.freelanceUser });
    const list = (await (await listDocuments(get(`/api/documents?kind=contract&id=${c.id}`), r.deps)).json()) as { data: { documents: { id: string; latest: { by: string } }[] } };
    expect(list.data.documents.map((d) => d.id)).toEqual([id]);
    expect(list.data.documents[0]?.latest.by).toBe("other_party");
    const detail = await showDocument(id, r.deps);
    expect(detail.status).toBe(200);
    // Les valeurs figées du rendu (données personnelles) ne sortent jamais en JSON ; l'empreinte du contenu, si.
    const text = JSON.stringify(await detail.json());
    expect(text).not.toContain("variables");
    expect(text).not.toContain("storageKey");
    expect(text).toContain(digestOf("service_agreement v1"));
    const file = await downloadVersion(id, "1", r.deps);
    expect(file.status).toBe(200);
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await t.db.documentAccess.count({ where: { documentId: id, action: "downloaded", userId: c.freelanceUser } })).toBe(1);
  });

  it("un téléchargement n'est jamais mis en cache ni indexé, toujours en pièce jointe, et porte l'empreinte", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string }; version: { sha256: string } } };
    const file = await downloadVersion(created.data.document.id, "1", r.deps);
    expect(file.headers.get("cache-control")).toBe("no-store");
    expect(file.headers.get("x-robots-tag")).toBe("noindex");
    expect(file.headers.get("content-disposition")).toBe('attachment; filename="contrat-de-prestation-v1.pdf"');
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(file.headers.get("content-security-policy")).toContain("sandbox");
    expect(file.headers.get("etag")).toBe(`"${created.data.version.sha256}"`);
    expect(file.headers.get("x-document-sha256")).toBe(created.data.version.sha256);
  });

  it("une nouvelle version se numérote à la suite et garde les précédentes lisibles", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string } } };
    const id = created.data.document.id;
    r.setActor({ userId: c.freelanceUser });
    const next = await addVersion(id, r, { attendu: 1, reason: "correction du prix" });
    expect(next.status).toBe(201);
    expect(((await next.json()) as { data: { version: { number: number; reason: string } } }).data.version).toMatchObject({ number: 2, reason: "correction du prix" });
    expect(r.requests.map((q) => q.version)).toEqual([1, 2]);
    const first = await downloadVersion(id, "1", r.deps);
    const second = await downloadVersion(id, "2", r.deps);
    expect(Buffer.from(await first.arrayBuffer()).toString()).toContain("v1");
    expect(Buffer.from(await second.arrayBuffer()).toString()).toContain("v2");
  });
});

describe("autorisation par objet : la personne étrangère reçoit exactement la réponse d'un document qui n'existe pas", () => {
  it("liste, détail, téléchargement, création et ajout de version", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string } } };
    const id = created.data.document.id;

    r.setActor({ userId: await createUser(t.db) });
    const unknown = "00000000-0000-7000-8000-000000000000";
    const body = async (response: Response) => ({ status: response.status, body: await response.json() });
    const before = r.files.size;

    expect(await body(await showDocument(id, r.deps))).toEqual(await body(await showDocument(unknown, r.deps)));
    expect(await body(await downloadVersion(id, "1", r.deps))).toEqual(await body(await downloadVersion(unknown, "1", r.deps)));
    expect(await body(await listDocuments(get(`/api/documents?kind=contract&id=${c.id}`), r.deps))).toEqual(await body(await listDocuments(get(`/api/documents?kind=contract&id=${unknown}`), r.deps)));
    expect(await body(await create(c, r))).toEqual(await body(await create({ ...c, id: unknown }, r)));
    expect(await body(await addVersion(id, r, { attendu: 1 }))).toEqual(await body(await addVersion(unknown, r, { attendu: 1 })));
    expect((await showDocument(id, r.deps)).status).toBe(404);
    // Rien n'a été rendu, rangé ni consigné pour l'étranger.
    expect(r.files.size).toBe(before);
    expect(await t.db.documentVersion.count({ where: { documentId: id } })).toBe(1);
  });

  it("le contrat d'une autre entreprise n'ouvre pas ce document, même pour un membre d'un contrat voisin", async () => {
    const a = await pending();
    const b = await pending();
    const r = rig();
    r.setActor({ userId: a.recruiter });
    const created = (await (await create(a, r)).json()) as { data: { document: { id: string } } };
    r.setActor({ userId: b.recruiter });
    expect((await showDocument(created.data.document.id, r.deps)).status).toBe(404);
    r.setActor({ userId: b.freelanceUser });
    expect((await downloadVersion(created.data.document.id, "1", r.deps)).status).toBe(404);
  });
});

describe("garde-fous", () => {
  it("refuse une écriture venue d'un autre site", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const response = await createDocument(post("/api/documents", { attendu: 0, affair: { kind: "contract", id: c.id }, type: "service_agreement" }, { origin: "https://evil.example" }), r.deps);
    expect(response.status).toBe(403);
    expect(r.files.size).toBe(0);
  });

  it("refuse des paramètres invalides sans rien rendre : affaire inconnue, sorte inconnue, identifiant mal formé, numéro de version absurde", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    expect((await listDocuments(get("/api/documents?kind=planet&id=x"), r.deps)).status).toBe(400);
    expect((await createDocument(post("/api/documents", { attendu: 0, affair: { kind: "contract", id: c.id }, type: "poem" }), r.deps)).status).toBe(400);
    expect((await createDocument(post("/api/documents", { attendu: 0, affair: { kind: "contract", id: "pas-un-uuid" }, type: "nda" }), r.deps)).status).toBe(400);
    expect((await addDocumentVersion(post("/api/documents/x/versions", {}), "pas-un-uuid", r.deps)).status).toBe(404);
    for (const number of ["abc", "0", "-1", "99999999999", "1.5"]) expect((await downloadVersion(c.id, number, r.deps)).status).toBe(404);
    expect(r.requests).toHaveLength(0);
  });

  it("limite le rythme des créations", async () => {
    const c = await pending();
    const r = rig({ tooMany: async () => true });
    r.setActor({ userId: c.recruiter });
    expect((await create(c, r)).status).toBe(429);
    expect(r.requests).toHaveLength(0);
  });

  it("un contrat sans objet (signé avant le coffre) n'a pas de contrat de prestation : 409, rien de rendu ni de rangé", async () => {
    const legacy = await activeContract(t.db, { signed: false });
    const r = rig();
    r.setActor({ userId: legacy.recruiter });
    const response = await create(legacy, r);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "objet de la prestation manquant" });
    expect(r.requests).toHaveLength(0);
    expect(r.files.size).toBe(0);
    expect(await t.db.document.count({ where: { contractId: legacy.id } })).toBe(0);
  });

  it("un contrat déjà accepté ne se réécrit pas : 409", async () => {
    const c = await activeContract(t.db, { scope: SCOPE });
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const response = await create(c, r);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "état de l'affaire" });
  });

  it("sans moteur de rendu branché : 503 « non-configuré », rien d'écrit ; les lectures restent possibles", async () => {
    const c = await pending();
    const withEngine = rig();
    withEngine.setActor({ userId: c.recruiter });
    expect((await create(c, withEngine)).status).toBe(201);
    const without = rig({}, null);
    without.setActor({ userId: c.recruiter });
    expect((await create(c, without, { additional: true })).status).toBe(503);
    expect(without.files.size).toBe(0);
    expect((await listDocuments(get(`/api/documents?kind=contract&id=${c.id}`), without.deps)).status).toBe(200);
  });

  it("remet au moteur les choix des parties tels que reçus, et ne range rien quand le moteur refuse : 409 « gabarit incomplet » avec les noms des variables manquantes", async () => {
    const c = await pending();
    const strict: DocumentRenderer = {
      render: async (request) => {
        if (request.inputs["input.workMode"] === undefined) throw new RenderRefusedError("missing_variable", ["input.workMode", "input.ipRegime"]);
        return { bytes: pdfOf("complet"), templateId: "service-agreement", templateVersion: "1.0.0", engine: "fake", contentDigest: digestOf("complet"), variables: { ...request.inputs } };
      },
    };
    const r = rig({}, strict);
    r.setActor({ userId: c.recruiter });
    const refused = await create(c, r);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ ok: false, error: "gabarit incomplet", code: "missing_variable", missing: ["input.workMode", "input.ipRegime"] });
    expect(r.files.size).toBe(0);
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(0);
    const accepted = await create(c, r, { inputs: { "input.workMode": "remote", "input.ipRegime": "assignment" } });
    expect(accepted.status).toBe(201);
    expect((await t.db.documentVersion.findFirstOrThrow({ where: { document: { contractId: c.id } } })).variables).toEqual({ "input.workMode": "remote", "input.ipRegime": "assignment" });
  });

  it("un rendu qui n'est pas un PDF n'est jamais rangé", async () => {
    const c = await pending();
    const bad: DocumentRenderer = { render: async () => ({ bytes: new TextEncoder().encode("<html>pas un pdf</html>"), templateId: "x", templateVersion: "1", engine: "fake", contentDigest: digestOf("x"), variables: {} }) };
    const r = rig({}, bad);
    r.setActor({ userId: c.recruiter });
    expect((await create(c, r)).status).toBe(500);
    expect(r.files.size).toBe(0);
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(0);
  });

  it("un enregistrement refusé efface le fichier déjà écrit (le contrat a été accepté pendant le rendu)", async () => {
    const c = await pending();
    const slow: DocumentRenderer = {
      render: async () => {
        await contracts(t.db).sign({ userId: c.freelanceUser }, c.id, NOW);
        return { bytes: pdfOf("rendu lent"), templateId: "service-agreement", templateVersion: "1.0.0", engine: "fake", contentDigest: digestOf("rendu lent"), variables: {} };
      },
    };
    const r = rig({}, slow);
    r.setActor({ userId: c.recruiter });
    const response = await create(c, r);
    expect(response.status).toBe(409);
    expect(r.files.size).toBe(0);
    expect(await t.db.documentVersion.count({ where: { document: { contractId: c.id } } })).toBe(0);
  });

  it("ne sert pas un fichier dont les octets ne correspondent plus à l'empreinte, ni un fichier disparu", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string } } };
    const id = created.data.document.id;
    const [key] = [...r.files.keys()];
    r.files.set(key ?? "", Buffer.from("%PDF-1.7\naltéré\n"));
    const tampered = await downloadVersion(id, "1", r.deps);
    expect(tampered.status).toBe(500);
    expect(await tampered.json()).toEqual({ ok: false, error: "erreur serveur" });
    r.files.delete(key ?? "");
    expect((await downloadVersion(id, "1", r.deps)).status).toBe(404);
  });
});

describe("concurrence : `attendu` est le numéro de la dernière version vue (0 : aucune)", () => {
  it("est obligatoire : sans lui, ou mal formé, la requête est refusée avant tout rendu", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const base = { affair: { kind: "contract", id: c.id }, type: "service_agreement", lang: "fr" };
    for (const attendu of [undefined, -1, 1.5, "0", null, 1_000_000]) {
      const body = attendu === undefined ? base : { ...base, attendu };
      expect((await createDocument(post("/api/documents", body), r.deps)).status).toBe(400);
    }
    const created = (await (await create(c, r)).json()) as { data: { document: { id: string } } };
    const id = created.data.document.id;
    for (const attendu of [undefined, -1, 1.5, "1"]) {
      expect((await addVersion(id, r, attendu === undefined ? {} : { attendu })).status).toBe(400);
    }
    expect(r.requests).toHaveLength(1);
    expect(await t.db.documentVersion.count({ where: { documentId: id } })).toBe(1);
  });

  it("double clic : deux créations simultanées donnent un 201 et un 409 qui porte le numéro de la dernière version", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const responses = await Promise.all([create(c, r), create(c, r)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const refused = responses.find((response) => response.status === 409);
    expect(await refused?.json()).toEqual({ ok: false, error: "une version plus récente existe", latest: 1 });
    expect(refused?.headers.get("cache-control")).toBe("no-store");
    // Une seule version rangée, et le fichier de la perdante a été effacé du volume.
    expect(await t.db.documentVersion.count({ where: { document: { contractId: c.id } } })).toBe(1);
    expect(r.files.size).toBe(1);
  });

  it("course entre les parties : la seconde, qui n'a pas vu la version de l'autre, reçoit 409 sans l'écraser", async () => {
    const c = await pending();
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const id = ((await (await create(c, r)).json()) as { data: { document: { id: string } } }).data.document.id;
    // Les deux parties ont vu la version 1 ; l'entreprise dépose la 2, puis le freelance dépose la sienne sur la 1.
    expect((await addVersion(id, r, { attendu: 1, reason: "côté entreprise" })).status).toBe(201);
    r.setActor({ userId: c.freelanceUser });
    const late = await addVersion(id, r, { attendu: 1, reason: "côté freelance" });
    expect(late.status).toBe(409);
    expect(await late.json()).toEqual({ ok: false, error: "une version plus récente existe", latest: 2 });
    // Elle a été refusée avant le rendu : rien rendu, rien rangé en plus.
    expect(r.requests).toHaveLength(2);
    expect(r.files.size).toBe(2);
    expect(await t.db.documentVersion.count({ where: { documentId: id } })).toBe(2);
    // Après relecture de la version 2, la sienne se range à la suite.
    const again = await addVersion(id, r, { attendu: 2, reason: "côté freelance" });
    expect(again.status).toBe(201);
    expect(((await again.json()) as { data: { version: { number: number } } }).data.version.number).toBe(3);
  });

  it("une version arrivée PENDANT le rendu est détectée à l'enregistrement : 409 et le fichier écrit est effacé", async () => {
    const c = await pending();
    const other = rig();
    other.setActor({ userId: c.freelanceUser });
    let intruded = false;
    const intruding: DocumentRenderer = {
      render: async (request) => {
        if (!intruded) {
          intruded = true;
          // Pendant que ce rendu travaille, l'autre partie range la première version.
          expect((await create(c, other)).status).toBe(201);
        }
        return { bytes: pdfOf("rendu concurrent"), templateId: "service-agreement", templateVersion: "1.0.0", engine: "fake", contentDigest: digestOf(`v${request.version}`), variables: {} };
      },
    };
    const r = rig({}, intruding);
    r.setActor({ userId: c.recruiter });
    const response = await create(c, r);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "une version plus récente existe", latest: 1 });
    expect(r.files.size).toBe(0);
    expect(await t.db.documentVersion.count({ where: { document: { contractId: c.id } } })).toBe(1);
  });

  it("un avenant de plus s'ouvre avec attendu 0, même si un premier avenant existe", async () => {
    const c = await activeContract(t.db, { scope: SCOPE });
    const r = rig();
    r.setActor({ userId: c.recruiter });
    const open = (extra: Record<string, unknown>) => create(c, r, { type: "amendment", additional: true, ...extra });
    expect((await open({})).status).toBe(201);
    expect((await open({})).status).toBe(201);
    expect(await t.db.document.count({ where: { contractId: c.id, type: "amendment" } })).toBe(2);
  });
});
