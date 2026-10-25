import { createHash, randomUUID } from "node:crypto";
import { documents, RenderRefusedError, type Actor, type Db, type DocumentRenderer, type VersionTarget } from "@proofseen/db";

/*
 * Render, write and record one version, for the server action « Préparer » (storyboard L1.6, §4 E2, T10): the same
 * steps as the API's `renderAndRecord` (apps/web/src/app/api/documents/vault.ts), with a typed outcome instead of an
 * HTTP response, so that a plain form, without JavaScript, gets a page and not JSON. The rules are the vault's own:
 *  - `prepare` checks access, the rules of the affair and the version the person saw (`expected`) BEFORE any rendering;
 *  - the bytes come from the server's renderer, never from the client, and must be a PDF of 20 MB at most;
 *  - the file fingerprint is computed here, from the exact bytes written; the content fingerprint is the engine's;
 *  - `record` checks everything again under a lock; a refused record deletes the file it would have kept.
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface RecordStorage {
  write(key: string, bytes: Uint8Array): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
}

export interface RecordDeps {
  readonly db: Db;
  readonly renderer: DocumentRenderer | null;
  readonly storage: RecordStorage;
  readonly now: () => Date;
}

export type RecordOutcome =
  | { readonly kind: "recorded"; readonly documentId: string; readonly number: number; readonly contentDigest: string }
  /** Another version arrived since the one the person saw: `latest` is the newest number. */
  | { readonly kind: "stale"; readonly latest: number }
  | { readonly kind: "absent" }
  | { readonly kind: "refused"; readonly reason: "scope" | "state" | "invalid" }
  /** The engine would not render: its code, and the names of the variables it needs (never values). */
  | { readonly kind: "engine"; readonly code: string; readonly missing: readonly string[] }
  | { readonly kind: "unconfigured" }
  | { readonly kind: "invalid-version" }
  | { readonly kind: "server" };

const isPdf = (bytes: Uint8Array): boolean => bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

const refusal = (reason: string): RecordOutcome => ({ kind: "refused", reason: reason === "scope_missing" ? "scope" : reason === "invalid" ? "invalid" : "state" });

export async function recordVersion(actor: Actor, target: VersionTarget, expected: number, reason: string, inputs: Readonly<Record<string, unknown>>, deps: RecordDeps): Promise<RecordOutcome> {
  const repo = documents(deps.db);
  const prepared = await repo.prepare(actor, target, expected);
  if (prepared.kind === "absent") return { kind: "absent" };
  if (prepared.kind === "stale") return { kind: "stale", latest: prepared.latest };
  if (prepared.kind === "refused") return refusal(prepared.reason);
  if (deps.renderer === null) return { kind: "unconfigured" };
  const at = deps.now();
  let rendered;
  try {
    rendered = await deps.renderer.render({ type: prepared.type, lang: prepared.lang, facts: prepared.facts, version: prepared.nextVersion, slot: prepared.slot, at, inputs });
  } catch (error) {
    if (error instanceof RenderRefusedError) return { kind: "engine", code: error.code, missing: error.missing };
    throw error;
  }
  if (!isPdf(rendered.bytes) || rendered.bytes.length > MAX_PDF_BYTES) return { kind: "server" };
  const storageKey = randomUUID();
  await deps.storage.write(storageKey, rendered.bytes);
  try {
    const recorded = await repo.record(
      actor,
      target,
      {
        storageKey,
        sha256: createHash("sha256").update(rendered.bytes).digest("hex"),
        contentDigest: rendered.contentDigest,
        size: rendered.bytes.length,
        contentType: "application/pdf",
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        engine: rendered.engine,
        variables: { ...rendered.variables },
        reason,
      },
      at,
      expected,
    );
    if (recorded.kind === "recorded") return { kind: "recorded", documentId: recorded.document.id, number: recorded.version.number, contentDigest: recorded.version.contentDigest };
    await deps.storage.remove([storageKey]);
    if (recorded.kind === "absent") return { kind: "absent" };
    if (recorded.kind === "stale") return { kind: "stale", latest: recorded.latest };
    if (recorded.kind === "invalid") return { kind: "invalid-version" };
    return refusal(recorded.reason);
  } catch (error) {
    await deps.storage.remove([storageKey]);
    throw error;
  }
}
