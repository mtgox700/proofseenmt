import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AffairSchema, DOCUMENT_LANGS, DOCUMENT_TYPES, documents, getDb, RenderRefusedError, type Actor, type Db, type DocumentRenderer, type VersionTarget } from "@proofseen/db";
import { deleteStored, readStored, writeStored } from "@/data/uploads";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, sameOrigin, type Caller } from "@/lib/api";
import { createDocumentRenderer } from "@/lib/document-renderer";
import { logError } from "@/lib/log";
import { fileName } from "@/lib/vault/file-name";

/*
 * The vault API (L1): the documents of an affair, their versions, the download of one version, and the creation of a
 * version from a rendering. The logic lives here, behind explicit dependencies, so a test plays it on a real database
 * with a fake renderer and a temporary folder; the route files only wire the real ones.
 *
 * Rules that matter:
 *  - a document is read and written only by the parties of its affair; everyone else gets 404, the same answer as for a
 *    document that does not exist, so identifiers cannot be probed;
 *  - the bytes of a version come from the server's own renderer, never from the client; the fingerprint (SHA-256) is
 *    computed here from the exact bytes kept;
 *  - a download answers `Cache-Control: no-store`, `X-Robots-Tag: noindex` and an attachment disposition, and is served
 *    only if the bytes still match the recorded fingerprint;
 *  - the vault stays closed in production until the founder opens it (documents are personal data and the volume is not
 *    yet encrypted at rest): `PROOFSEEN_VAULT_OPEN=GO`.
 */

/** Un PDF de 20 Mo au plus : la même borne que la base. */
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const WRITE_RULE = { windowMs: 60 * 60_000, max: 30 };

export interface VaultStorage {
  write(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(keys: readonly string[]): Promise<void>;
}

export interface VaultDeps {
  /** Faux : le coffre est fermé (503 « non-configuré »). */
  readonly open: boolean;
  readonly db: () => Db;
  readonly authenticate: () => Promise<Caller>;
  /** Le moteur de rendu ; `null` tant qu'aucun n'est branché : les lectures marchent, la création répond « non-configuré ». */
  readonly renderer: DocumentRenderer | null;
  readonly storage: VaultStorage;
  readonly now: () => Date;
  /** Vrai quand la personne a dépassé son quota de créations. */
  readonly tooMany: (userId: string, now: Date) => Promise<boolean>;
}

/** Le coffre est ouvert hors production, et en production seulement sur décision explicite du founder. */
export const vaultOpen = (env: Readonly<Record<string, string | undefined>>): boolean => env.NODE_ENV !== "production" || env.PROOFSEEN_VAULT_OPEN === "GO";

/**
 * The renderer plugged in the application: the document engine (`@proofseen/documents`) behind the adapter of
 * `lib/document-renderer.ts`. The engine itself is loaded on the first creation, not when a route is imported.
 */
export const configuredRenderer = (): DocumentRenderer | null => createDocumentRenderer({ db: getDb });

export const defaultDeps = (): VaultDeps => ({
  open: vaultOpen(process.env),
  db: getDb,
  authenticate: () => caller(),
  renderer: configuredRenderer(),
  storage: {
    write: (key, bytes) => writeStored(key, bytes),
    read: (key) => readStored(key),
    remove: (keys) => deleteStored(keys),
  },
  now: () => new Date(),
  tooMany: (userId, now) => throttled("document-write", userId, WRITE_RULE, now),
});

type VaultRefusal = "objet de la prestation manquant" | "état de l'affaire" | "version invalide";
const REFUSAL_STATUS: Readonly<Record<VaultRefusal, number>> = { "objet de la prestation manquant": 409, "état de l'affaire": 409, "version invalide": 400 };
const refuse = (error: VaultRefusal): NextResponse => NextResponse.json({ ok: false, error }, { status: REFUSAL_STATUS[error] });

/** Une autre version est arrivée depuis celle que la personne a vue : 409, avec le numéro de la dernière pour que l'écran se recharge. */
const outdated = (latest: number): NextResponse => NextResponse.json({ ok: false, error: "une version plus récente existe", latest }, { status: 409, headers: { "cache-control": "no-store" } });

const json = <T>(data: T, status = 200): NextResponse => NextResponse.json({ ok: true, data }, { status, headers: { "cache-control": "no-store" } });

const NOT_FOUND = (): NextResponse => fail("introuvable");

/** Vérifie que le coffre est ouvert et qui appelle ; sinon la réponse à rendre. */
const gate = async (deps: VaultDeps): Promise<{ readonly actor: Actor } | { readonly response: NextResponse }> => {
  if (!deps.open) return { response: fail("non-configuré") };
  const who = await deps.authenticate();
  return who.kind === "refused" ? { response: who.response } : { actor: who.actor };
};

const Uuid = z.uuid();

/** Les documents d'une affaire : `?kind=contract&id=...`. */
export const listDocuments = async (request: Request, deps: VaultDeps): Promise<NextResponse> => {
  const entered = await gate(deps);
  if ("response" in entered) return entered.response;
  const params = new URL(request.url).searchParams;
  const affair = AffairSchema.safeParse({ kind: params.get("kind"), id: params.get("id") });
  if (!affair.success) return fail("requête invalide");
  try {
    const list = await documents(deps.db()).list(entered.actor, affair.data);
    return list === null ? NOT_FOUND() : json({ documents: list });
  } catch (error) {
    logError("vault: list failed", error);
    return fail("erreur serveur");
  }
};

/** Un document et toutes ses versions. */
export const showDocument = async (id: string, deps: VaultDeps): Promise<NextResponse> => {
  const entered = await gate(deps);
  if ("response" in entered) return entered.response;
  try {
    const detail = await documents(deps.db()).find(entered.actor, id);
    return detail === null ? NOT_FOUND() : json({ document: detail });
  } catch (error) {
    logError("vault: show failed", error);
    return fail("erreur serveur");
  }
};

/**
 * Le numéro de la dernière version que la personne a vue (0 : aucune). Obligatoire : sans lui, deux envois simultanés (double
 * clic, ou l'autre partie) se croiraient seuls et la seconde version écraserait en pratique la première à l'écran.
 */
const Expected = z.number().int().min(0).max(999_999);

const CreateSchema = z.object({
  attendu: Expected,
  affair: AffairSchema,
  type: z.enum(DOCUMENT_TYPES),
  lang: z.enum(DOCUMENT_LANGS).default("fr"),
  /** Un document de plus de même sorte (l'avenant suivant), plutôt que le document existant. */
  additional: z.boolean().optional(),
  reason: z.string().trim().min(1).max(300).optional(),
  /** Les choix des parties que le gabarit demande (mode de travail, régime des droits…) : validés par le moteur. */
  inputs: z.record(z.string(), z.unknown()).optional(),
});

const VersionSchema = z.object({ attendu: Expected, reason: z.string().trim().min(1).max(300).optional(), inputs: z.record(z.string(), z.unknown()).optional() });

const isPdf = (bytes: Uint8Array): boolean => bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

/** Rend, écrit puis enregistre une version ; le fichier écrit est effacé si l'enregistrement est refusé. */
const renderAndRecord = async (actor: Actor, target: VersionTarget, expected: number, requestedReason: string | undefined, inputs: Readonly<Record<string, unknown>>, deps: VaultDeps): Promise<NextResponse> => {
  const repo = documents(deps.db());
  const prepared = await repo.prepare(actor, target, expected);
  if (prepared.kind === "absent") return NOT_FOUND();
  if (prepared.kind === "stale") return outdated(prepared.latest);
  if (prepared.kind === "refused") {
    if (prepared.reason === "invalid") return fail("requête invalide");
    return refuse(prepared.reason === "scope_missing" ? "objet de la prestation manquant" : "état de l'affaire");
  }
  if (deps.renderer === null) return fail("non-configuré");
  const at = deps.now();
  let rendered;
  try {
    rendered = await deps.renderer.render({ type: prepared.type, lang: prepared.lang, facts: prepared.facts, version: prepared.nextVersion, slot: prepared.slot, at, inputs });
  } catch (error) {
    // Le moteur refuse (gabarit pas prêt, variable manquante, source expirée…) : l'écran sait ce qu'il doit demander.
    if (error instanceof RenderRefusedError) return NextResponse.json({ ok: false, error: "gabarit incomplet", code: error.code, missing: error.missing }, { status: 409 });
    throw error;
  }
  if (!isPdf(rendered.bytes) || rendered.bytes.length > MAX_PDF_BYTES) return fail("erreur serveur");
  const storageKey = randomUUID();
  await deps.storage.write(storageKey, rendered.bytes);
  try {
    const recorded = await repo.record(
      actor,
      target,
      {
        storageKey,
        sha256: createHash("sha256").update(rendered.bytes).digest("hex"),
        size: rendered.bytes.length,
        contentType: "application/pdf",
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        contentDigest: rendered.contentDigest,
        engine: rendered.engine,
        variables: { ...rendered.variables },
        reason: requestedReason ?? (prepared.nextVersion === 1 ? "première version" : "nouvelle version"),
      },
      at,
      expected,
    );
    if (recorded.kind === "recorded") return json({ document: recorded.document, version: recorded.version }, 201);
    await deps.storage.remove([storageKey]);
    if (recorded.kind === "absent") return NOT_FOUND();
    if (recorded.kind === "stale") return outdated(recorded.latest);
    if (recorded.kind === "invalid") return refuse("version invalide");
    return refuse(recorded.reason === "scope_missing" ? "objet de la prestation manquant" : recorded.reason === "invalid" ? "version invalide" : "état de l'affaire");
  } catch (error) {
    await deps.storage.remove([storageKey]);
    throw error;
  }
};

/** Ouvre un document (ou l'avenant suivant) avec sa première version rendue. */
export const createDocument = async (request: Request, deps: VaultDeps): Promise<NextResponse> => {
  if (!sameOrigin(request)) return fail("origine refusée");
  const entered = await gate(deps);
  if ("response" in entered) return entered.response;
  if (await deps.tooMany(entered.actor.userId, deps.now())) return fail("trop de demandes");
  const parsed = CreateSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { attendu, affair, type, lang, additional, reason, inputs } = parsed.data;
  try {
    return await renderAndRecord(entered.actor, { affair, type, lang, ...(additional === true ? { additional: true } : {}) }, attendu, reason, inputs ?? {}, deps);
  } catch (error) {
    logError("vault: create failed", error);
    return fail("erreur serveur");
  }
};

/** Ajoute une version rendue à un document existant. */
export const addDocumentVersion = async (request: Request, id: string, deps: VaultDeps): Promise<NextResponse> => {
  if (!sameOrigin(request)) return fail("origine refusée");
  const entered = await gate(deps);
  if ("response" in entered) return entered.response;
  if (!Uuid.safeParse(id).success) return NOT_FOUND();
  if (await deps.tooMany(entered.actor.userId, deps.now())) return fail("trop de demandes");
  const body = (await jsonBody(request)) ?? {};
  const parsed = VersionSchema.safeParse(body);
  if (!parsed.success) return fail("requête invalide");
  try {
    return await renderAndRecord(entered.actor, { documentId: id }, parsed.data.attendu, parsed.data.reason, parsed.data.inputs ?? {}, deps);
  } catch (error) {
    logError("vault: add version failed", error);
    return fail("erreur serveur");
  }
};

/** Sert les octets d'une version : jamais mis en cache, jamais indexés, toujours en téléchargement, et seulement s'ils correspondent à l'empreinte enregistrée. */
export const downloadVersion = async (id: string, rawNumber: string, deps: VaultDeps): Promise<Response> => {
  const entered = await gate(deps);
  if ("response" in entered) return entered.response;
  const number = /^[0-9]{1,6}$/.test(rawNumber) ? Number(rawNumber) : 0;
  try {
    const opened = await documents(deps.db()).open(entered.actor, id, number, deps.now());
    if (opened === null) return NOT_FOUND();
    const bytes = await deps.storage.read(opened.storageKey);
    if (bytes === null) return NOT_FOUND();
    // Un fichier altéré sur le volume ne se sert pas comme s'il était celui qu'on a empreint.
    if (createHash("sha256").update(bytes).digest("hex") !== opened.version.sha256) {
      logError("vault: stored bytes do not match their fingerprint");
      return fail("erreur serveur");
    }
    // One name for the file, shared with the screens (L1-159): kind, version, eight characters of the content fingerprint.
    const name = fileName(opened.document.type, opened.version.number, opened.version.contentDigest);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${name}"`,
        "content-length": String(bytes.length),
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "referrer-policy": "no-referrer",
        "cross-origin-resource-policy": "same-site",
        etag: `"${opened.version.sha256}"`,
        "x-document-sha256": opened.version.sha256,
      },
    });
  } catch (error) {
    logError("vault: download failed", error);
    return fail("erreur serveur");
  }
};
