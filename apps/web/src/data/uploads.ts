import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { storedFiles, type Actor, type Db } from "@proofseen/db";
import { inspectUpload, UPLOAD_RULES, type UploadKind, type UploadProblem } from "../lib/file-sniff";
import { logError } from "../lib/log";
import { reencodeImage } from "./image-processing";

/*
 * File storage on the server's own disk: in production a Docker named volume mounted at /data/uploads (see
 * deploy/vps/docker-compose.yml), elsewhere a folder of the system temp directory, or PROOFSEEN_UPLOADS_DIR.
 *
 * A file is named after a random id drawn here, never after anything the person sent, and lives at
 * <root>/<first two characters>/<id>. The id is checked to be a uuid before any path is built: no input can walk out
 * of the root. A file is written next to its final place then renamed, so a reader never sees half a file. The
 * database row (owner, use, type, size, sha256) is written after the file and checks the account quota; when it is
 * refused, the file is removed again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const uploadsRoot = (): string => {
  const configured = process.env.PROOFSEEN_UPLOADS_DIR?.trim() ?? "";
  if (configured !== "") return configured;
  return process.env.NODE_ENV === "production" ? "/data/uploads" : join(tmpdir(), "proofseen-uploads");
};

/** Where a stored file lives; `null` for anything that is not a lowercase uuid. */
export const storedPath = (id: string, root: string = uploadsRoot()): string | null => (UUID.test(id) ? join(root, id.slice(0, 2), id) : null);

export const writeStored = async (id: string, bytes: Uint8Array, root: string = uploadsRoot()): Promise<void> => {
  const path = storedPath(id, root);
  if (path === null) throw new Error("uploads: invalid file id");
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const partial = `${path}.${randomUUID()}.part`;
  await writeFile(partial, bytes, { mode: 0o600, flag: "wx" });
  await rename(partial, path);
};

/** The stored bytes, or `null` when the file is not on disk. */
export const readStored = async (id: string, root: string = uploadsRoot()): Promise<Buffer | null> => {
  const path = storedPath(id, root);
  if (path === null) return null;
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") logError("uploads: read failed", error);
    return null;
  }
};

/** Removes files from disk; a missing file is not an error, any other failure is logged and does not stop the rest. */
export const deleteStored = async (ids: readonly string[], root: string = uploadsRoot()): Promise<void> => {
  for (const id of ids) {
    const path = storedPath(id, root);
    if (path === null) continue;
    try {
      await rm(path, { force: true });
    } catch (error) {
      logError("uploads: delete failed", error);
    }
  }
};

export type SaveResult = { readonly kind: "stored"; readonly id: string } | { readonly kind: UploadProblem | "missing" | "unreadable" | "quota" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** The bytes to store and what they are: images re-encoded, PDFs as uploaded once inspected. */
const prepare = async (kind: UploadKind, bytes: Uint8Array): Promise<{ readonly bytes: Uint8Array; readonly contentType: "image/webp" | "application/pdf"; readonly width: number | null; readonly height: number | null } | UploadProblem | "unreadable"> => {
  const inspection = inspectUpload(kind, bytes);
  if (!inspection.ok) return inspection.problem;
  if (inspection.contentType === "application/pdf" || kind === "cv") return { bytes, contentType: "application/pdf", width: null, height: null };
  try {
    const image = await reencodeImage(bytes, kind);
    return { bytes: image.bytes, contentType: image.contentType, width: image.width, height: image.height };
  } catch {
    // A file whose header looks right but that the decoder refuses: a broken or hostile image, never stored.
    return "unreadable";
  }
};

/** Validates, transforms, writes and records one uploaded file for `actor`. */
export const saveUpload = async (db: Db, actor: Actor, kind: UploadKind, upload: FormDataEntryValue | null, root: string = uploadsRoot()): Promise<SaveResult> => {
  if (upload === null || typeof upload === "string" || upload.size === 0) return { kind: "missing" };
  // The declared size is checked before reading anything: an oversized body is not buffered for nothing.
  if (upload.size > UPLOAD_RULES[kind].maxBytes) return { kind: "too_large" };
  return saveBytes(db, actor, kind, new Uint8Array(await upload.arrayBuffer()), root);
};

/** Same as `saveUpload`, for bytes the caller has already read (and inspected for its own needs). */
export const saveBytes = async (db: Db, actor: Actor, kind: UploadKind, bytes: Uint8Array, root: string = uploadsRoot()): Promise<SaveResult> => {
  if (bytes.length === 0) return { kind: "missing" };
  const prepared = await prepare(kind, bytes);
  if (typeof prepared === "string") return { kind: prepared };
  const id = randomUUID();
  await writeStored(id, prepared.bytes, root);
  try {
    const recorded = await storedFiles(db).record(actor, { id, kind, contentType: prepared.contentType, size: prepared.bytes.length, sha256: sha256(prepared.bytes), width: prepared.width, height: prepared.height });
    if (recorded === "recorded") return { kind: "stored", id };
    await deleteStored([id], root);
    return { kind: recorded === "quota" ? "quota" : "unreadable" };
  } catch (error) {
    await deleteStored([id], root);
    throw error;
  }
};
