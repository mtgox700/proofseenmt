import type { Actor, Db } from "@proofseen/db";
import { sniff, UPLOAD_RULES } from "../lib/file-sniff";
import { pdfText, type PdfText, type PdfTextOptions } from "./pdf-text";
import { saveBytes, uploadsRoot, type SaveResult } from "./uploads";

/*
 * The CV upload (wave-3 review, M1). A CV is downloaded by the companies that look at the profile: before it is
 * stored, the PDF worker reads it with PDF.js and its object streams opened, and a CV with active content (script,
 * launch action, embedded file, XFA…), an encrypted one, one that cannot be read or one longer than MAX_CV_PAGES_CHECKED
 * pages is refused. The raw scan of file-sniff.ts still runs in `saveBytes`, as the cheap first filter.
 */

/** A longer document is not a CV: it is refused rather than stored without its structure checked. */
export const MAX_CV_PAGES_CHECKED = 50;

/** How a CV is read before it is stored: the CV budget of the PDF worker, fifty pages. */
export const CV_READING = { purpose: "cv", maxPages: MAX_CV_PAGES_CHECKED } as const satisfies PdfTextOptions;

export type CvSaveResult = SaveResult | { readonly kind: "encrypted" | "busy" | "too_many_pages" };

const refusalOf = (reading: PdfText): CvSaveResult | null => {
  if (reading.kind === "ok") return reading.active ? { kind: "active_content" } : null;
  if (reading.kind === "too_long") return { kind: "too_many_pages" };
  return { kind: reading.kind };
};

/** Validates, checks in the PDF worker, then stores the CV of `actor`. */
export const saveCv = async (
  db: Db,
  actor: Actor,
  upload: FormDataEntryValue | null,
  root: string = uploadsRoot(),
  read: (bytes: Uint8Array) => Promise<PdfText> = (bytes) => pdfText(bytes, CV_READING),
): Promise<CvSaveResult> => {
  if (upload === null || typeof upload === "string" || upload.size === 0) return { kind: "missing" };
  // The declared size first: an oversized body is not read, and no worker starts for it.
  if (upload.size > UPLOAD_RULES.cv.maxBytes) return { kind: "too_large" };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (sniff(bytes) === "application/pdf") {
    const refused = refusalOf(await read(bytes));
    if (refused !== null) return refused;
  }
  // Not a PDF: `saveBytes` refuses it by its type, as before.
  return saveBytes(db, actor, "cv", bytes, root);
};
