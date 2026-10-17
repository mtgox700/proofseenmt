import { storedFiles, type Actor, type Db } from "@proofseen/db";
import { saveCv, type CvSaveResult } from "./cv-upload";
import type { PdfText } from "./pdf-text";
import { deleteStored, uploadsRoot } from "./uploads";

/*
 * The CV attached to an application (C21). On the apply form the freelancer ticks "attach my CV" (the latest CV of
 * their profile) or uploads a PDF there, checked exactly like the profile CV (sniffed type, size, quota, PDF worker).
 * The repository checks again, inside the application's transaction, that the file is a CV of the applicant.
 *
 * An uploaded CV becomes the CV of the profile once the application went through: the older CVs go, except those
 * already sent with a live application, which stay what each company received. If the application is refused, the
 * uploaded file is removed again, so nothing is left behind.
 */

export type CvChoice = { readonly kind: "none" } | { readonly kind: "stored" } | { readonly kind: "upload"; readonly file: File };

export type CvRefusal = Exclude<CvSaveResult["kind"], "stored"> | "no_cv";

export type PreparedCv =
  | { readonly kind: "none" }
  | { readonly kind: "ready"; readonly fileId: string; readonly uploaded: boolean }
  | { readonly kind: "refused"; readonly code: CvRefusal };

export interface CvOptions {
  readonly root?: string;
  /** Injected in tests: the PDF worker with a test deadline, or a fake. */
  readonly read?: (bytes: Uint8Array) => Promise<PdfText>;
}

/** What the apply form asks for: a new PDF wins over the "attach my CV" box; neither means no CV. */
export const cvChoiceOf = (formData: FormData): CvChoice => {
  const upload = formData.get("cv");
  if (upload !== null && typeof upload !== "string" && upload.size > 0) return { kind: "upload", file: upload };
  return formData.get("joindreCv") === "1" ? { kind: "stored" } : { kind: "none" };
};

/** Resolves the choice to a stored CV of `actor`, uploading it first when the form carries one. */
export const prepareApplicationCv = async (db: Db, actor: Actor, choice: CvChoice, options: CvOptions = {}): Promise<PreparedCv> => {
  if (choice.kind === "none") return { kind: "none" };
  if (choice.kind === "stored") {
    const cv = await storedFiles(db).latest(actor, "cv");
    return cv === null ? { kind: "refused", code: "no_cv" } : { kind: "ready", fileId: cv.id, uploaded: false };
  }
  const saved = await saveCv(db, actor, choice.file, options.root ?? uploadsRoot(), options.read);
  return saved.kind === "stored" ? { kind: "ready", fileId: saved.id, uploaded: true } : { kind: "refused", code: saved.kind };
};

/** After the attempt to apply: keeps an uploaded CV as the profile's CV if the application went through, removes it otherwise. */
export const settleApplicationCv = async (db: Db, actor: Actor, prepared: PreparedCv, applied: boolean, root: string = uploadsRoot()): Promise<void> => {
  if (prepared.kind !== "ready" || !prepared.uploaded) return;
  if (applied) {
    await deleteStored(await storedFiles(db).pruneCvs(actor, prepared.fileId), root);
    return;
  }
  const removed = await storedFiles(db).remove(actor, prepared.fileId);
  if (removed !== null) await deleteStored([removed], root);
};

/** After a withdrawal: a CV that only that application kept is removed, unless it is still the profile's CV. */
export const pruneAfterWithdrawal = async (db: Db, actor: Actor, root: string = uploadsRoot()): Promise<void> => {
  await deleteStored(await storedFiles(db).pruneCvs(actor), root);
};
