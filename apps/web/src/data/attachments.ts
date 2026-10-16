import { containsContact, linkCarriesContact, MAX_ATTACHMENTS_PER_MESSAGE, storedFiles, type Actor, type Db } from "@proofseen/db";
import { sniff, UPLOAD_RULES } from "../lib/file-sniff";
import { pdfText, type PdfText, type PdfTextOptions } from "./pdf-text";
import { deleteStored, saveBytes, uploadsRoot } from "./uploads";

/*
 * Message attachments (C15): up to three files per message, PDF or image, 5 MB each, stored like every other upload
 * (type read from the content, images re-encoded without metadata, counted against the account quota).
 *
 * The contact-details rule of the messaging also looks inside documents: the text of a PDF is extracted on the server
 * and checked like the message body, and so are its links (a mailto:, a tel:, a messaging service), so a PDF carrying a
 * phone number is refused before a paid contract exists, as the same number typed in the message would be. Images are
 * not read (no OCR): that limit is written in the hint.
 *
 * A PDF reaches the other party, so the check fails closed (wave-3 review, M1/M2): a PDF the worker finds active
 * (script, launch action, embedded file…), encrypted, unreadable or longer than MAX_PDF_PAGES_CHECKED pages is refused
 * with its own message, never stored unchecked. The readings use the attachment budget of the PDF worker, separate
 * from the CV import.
 *
 * Attachments are saved before the message is posted, then attached to it in the posting transaction. When posting
 * fails, the caller discards them; anything left behind is purged by the scheduled job.
 */

/** Pages read to look for active content and contact details; a longer document is refused. */
const MAX_PDF_PAGES_CHECKED = 50;

export type AttachmentProblem = "count" | "too_large" | "type" | "dimensions" | "active_content" | "unreadable" | "encrypted" | "too_long" | "quota" | "busy" | "storage_full";

export type SavedAttachments = { readonly kind: "saved"; readonly ids: readonly string[]; readonly containContact: boolean } | { readonly kind: "refused"; readonly problem: AttachmentProblem };

/** The files of a form field, without the empty entry a browser sends when nothing was chosen. */
export const chosenFiles = (entries: readonly FormDataEntryValue[]): readonly File[] => entries.flatMap((entry) => (typeof entry !== "string" && entry.size > 0 ? [entry] : []));

/** Fifty dense pages: the whole text is read, so a number on the last page is still found. */
const MAX_PDF_CHARS_CHECKED = 400_000;

/** How an attachment is read: the attachment budget of the PDF worker, fifty pages, the whole text. */
export const ATTACHMENT_READING = { purpose: "attachment", maxPages: MAX_PDF_PAGES_CHECKED, maxChars: MAX_PDF_CHARS_CHECKED } as const satisfies PdfTextOptions;

/** Reads one PDF attachment in the worker; injected in tests to give a slow machine a longer deadline. */
export type AttachmentReader = (bytes: Uint8Array) => Promise<PdfText>;

const readAttachment: AttachmentReader = (bytes) => pdfText(bytes, ATTACHMENT_READING);

/**
 * What the PDF worker says of a document: "contact" or "clean", or why it is refused. "busy" when every reader thread
 * of the attachment budget is taken: the attachment is then refused rather than stored unchecked, or a burst of
 * uploads would be a way around the rule.
 */
const pdfVerdict = async (bytes: Uint8Array, read: AttachmentReader): Promise<"contact" | "clean" | AttachmentProblem> => {
  const reading = await read(bytes);
  if (reading.kind !== "ok") return reading.kind;
  if (reading.active) return "active_content";
  return containsContact(reading.text) || reading.links.some(linkCarriesContact) ? "contact" : "clean";
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

export const saveAttachments = async (
  db: Db,
  actor: Actor,
  files: readonly File[],
  root: string = uploadsRoot(),
  read: AttachmentReader = readAttachment,
): Promise<SavedAttachments> => {
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) return { kind: "refused", problem: "count" };
  // Sizes are declared before any byte is read: an oversized batch is refused without buffering it.
  if (files.some((file) => file.size > UPLOAD_RULES.message_attachment.maxBytes)) return { kind: "refused", problem: "too_large" };
  const ids: string[] = [];
  let containContact = false;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniff(bytes) === "application/pdf") {
      const verdict = await pdfVerdict(bytes, read);
      if (verdict !== "contact" && verdict !== "clean") {
        await discardAttachments(db, actor, ids, root);
        return { kind: "refused", problem: verdict };
      }
      if (verdict === "contact") containContact = true;
    }
    const saved = await saveBytes(db, actor, "message_attachment", bytes, root);
    if (saved.kind !== "stored") {
      await discardAttachments(db, actor, ids, root);
      return { kind: "refused", problem: saved.kind === "missing" || saved.kind === "empty" ? "unreadable" : saved.kind };
    }
    ids.push(saved.id);
  }
  return { kind: "saved", ids, containContact };
};
