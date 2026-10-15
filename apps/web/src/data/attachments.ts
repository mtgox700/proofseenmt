import { containsContact, MAX_ATTACHMENTS_PER_MESSAGE, storedFiles, type Actor, type Db } from "@proofseen/db";
import { sniff, UPLOAD_RULES } from "../lib/file-sniff";
import { pdfText } from "./pdf-text";
import { deleteStored, saveBytes, uploadsRoot } from "./uploads";

/*
 * Message attachments (C15): up to three files per message, PDF or image, 5 MB each, stored like every other upload
 * (type read from the content, images re-encoded without metadata, counted against the account quota).
 *
 * The contact-details rule of the messaging also looks inside documents: the text of a PDF is extracted on the server
 * and checked like the message body, so a PDF carrying a phone number is refused before a paid contract exists, as the
 * same number typed in the message would be. Images are not read (no OCR): that limit is written in the hint.
 *
 * Attachments are saved before the message is posted, then attached to it in the posting transaction. When posting
 * fails, the caller discards them; anything left behind is purged by the scheduled job.
 */

/** Pages read to look for contact details; a longer document is stored without that check. */
const MAX_PDF_PAGES_CHECKED = 50;

export type AttachmentProblem = "count" | "too_large" | "type" | "dimensions" | "active_content" | "unreadable" | "quota";

export type SavedAttachments = { readonly kind: "saved"; readonly ids: readonly string[]; readonly containContact: boolean } | { readonly kind: "refused"; readonly problem: AttachmentProblem };

/** The files of a form field, without the empty entry a browser sends when nothing was chosen. */
export const chosenFiles = (entries: readonly FormDataEntryValue[]): readonly File[] => entries.flatMap((entry) => (typeof entry !== "string" && entry.size > 0 ? [entry] : []));

const pdfHasContact = async (bytes: Uint8Array): Promise<boolean> => {
  const text = await pdfText(bytes, MAX_PDF_PAGES_CHECKED);
  return text.kind === "ok" && containsContact(text.text);
};

/** Removes attachments of `actor` that could not be sent: rows first, then files. */
export const discardAttachments = async (db: Db, actor: Actor, ids: readonly string[], root: string = uploadsRoot()): Promise<void> => {
  const removed: string[] = [];
  for (const id of ids) {
    const gone = await storedFiles(db).remove(actor, id);
    if (gone !== null) removed.push(gone);
  }
  await deleteStored(removed, root);
};

export const saveAttachments = async (db: Db, actor: Actor, files: readonly File[], root: string = uploadsRoot()): Promise<SavedAttachments> => {
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) return { kind: "refused", problem: "count" };
  // Sizes are declared before any byte is read: an oversized batch is refused without buffering it.
  if (files.some((file) => file.size > UPLOAD_RULES.message_attachment.maxBytes)) return { kind: "refused", problem: "too_large" };
  const ids: string[] = [];
  let containContact = false;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniff(bytes) === "application/pdf" && (await pdfHasContact(bytes))) containContact = true;
    const saved = await saveBytes(db, actor, "message_attachment", bytes, root);
    if (saved.kind !== "stored") {
      await discardAttachments(db, actor, ids, root);
      return { kind: "refused", problem: saved.kind === "missing" || saved.kind === "empty" ? "unreadable" : saved.kind };
    }
    ids.push(saved.id);
  }
  return { kind: "saved", ids, containContact };
};
