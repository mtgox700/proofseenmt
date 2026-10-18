import { getDb, storedFiles, type ReadableFile } from "@proofseen/db";
import { accountUsers } from "@/data/accounts";
import { hasDatabase } from "@/data/intake-sink";
import { readStored } from "@/data/uploads";
import { logError } from "@/lib/log";
import { session } from "@/lib/session";

/*
 * Serves a stored file to whoever may read it: a public photo or portfolio image to anyone, a message attachment to the
 * parties of its conversation (C15), a CV to the company members of a live application it is attached to (C21),
 * anything else to its owner only. A file the caller may not read answers 404 exactly like a file that does not exist, so ids cannot be probed.
 *
 * The answer can never run in the browser: the type is the one recognised and re-encoded at upload, the browser may
 * not guess another (nosniff), and the document policy forbids every resource and script (sandbox). A CV is always a
 * download, never shown inline. Public images are cached briefly, so a profile withdrawn from publication stops
 * showing them within minutes; a private file is never cached.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const NOT_FOUND = (): Response => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

const EXTENSIONS: Readonly<Record<string, string>> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

/** The caller's own files: only looked up when the file is not public, so a public image costs no session lookup. */
const readableBy = async (id: string): Promise<ReadableFile | null> => {
  const db = getDb();
  const open = await storedFiles(db).readable(id, null);
  if (open !== null) return open;
  const state = await session();
  if (state.kind !== "signed-in" || state.person.email === "") return null;
  const { userId, suspension } = await accountUsers(db).ensure({ clerkId: state.person.id, email: state.person.email, displayName: state.person.name, emailVerified: state.person.emailVerified });
  const readable = await storedFiles(db).readable(id, { userId });
  // A suspended account (C19) keeps its own files (they are its data) but no longer reads what others shared with it:
  // its conversations' attachments, the CVs attached to its company's applications.
  return suspension !== null && (readable?.audience === "participant" || readable?.audience === "recipient" || readable?.audience === "member") ? null : readable;
};

/*
 * A PDF is always a download, never shown inline (a CV, a message attachment). A message attachment gets a generic
 * name: the name it was uploaded under was never kept, so it cannot carry contact details either.
 */
const headersFor = ({ file, audience }: ReadableFile): Record<string, string> => {
  const stem = file.kind === "cv" ? "cv" : file.kind === "message_attachment" ? "piece-jointe" : file.id;
  const name = `${stem}.${EXTENSIONS[file.contentType] ?? "bin"}`;
  const download = file.kind === "cv" || file.contentType === "application/pdf";
  return {
    "content-type": file.contentType,
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "same-site",
    "referrer-policy": "no-referrer",
    "cache-control": audience === "public" ? "public, max-age=300" : "private, no-store",
    etag: `"${file.sha256}"`,
  };
};

export async function GET(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  if (!hasDatabase()) return NOT_FOUND();
  try {
    const readable = await readableBy(id);
    if (readable === null) return NOT_FOUND();
    const headers = headersFor(readable);
    if (readable.audience === "public" && request.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
    const bytes = await readStored(readable.file.id);
    if (bytes === null) return NOT_FOUND();
    return new Response(new Uint8Array(bytes), { status: 200, headers: { ...headers, "content-length": String(bytes.length) } });
  } catch (error) {
    logError("files: not served", error);
    return new Response("Unavailable", { status: 500, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
}
