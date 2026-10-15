import { draftFromCandidate, isEmptyDraft, type CvDraft } from "@proofseen/db";
import { createCvReader, fetchTransport, type CvReader } from "@proofseen/engines";
import { logError } from "../lib/log";
import { pdfText, type PdfText } from "./pdf-text";
import { throttled } from "./throttle";

/*
 * A CV (or a LinkedIn profile saved as PDF) that the freelancer uploaded themselves, read into a draft of profile
 * fields. Nothing is ever fetched from LinkedIn or anywhere else: only the file the person handed over is read. The
 * model only copies what the CV says into revalidated fields; the draft goes back to the person, who accepts each item
 * one by one. Nothing is published automatically, nothing is graded (AI Act).
 *
 * Each reading is paid: a per-person limit and a platform-wide daily cap (PROOFSEEN_IMPORT_DAILY_CAP, 20 by default).
 * Without ANTHROPIC_API_KEY the import is "unconfigured" and the page does not offer it.
 */

export const IMPORT_MODEL = "claude-haiku-4-5-20251001";
const PER_PERSON = { windowMs: 24 * 60 * 60_000, max: 5 };
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_DAILY_CAP = 20;
/** Under this, the PDF holds no real text (a scan): nothing worth a paid call. */
const MIN_TEXT_CHARS = 200;

export type ImportOutcome =
  | { readonly kind: "ok"; readonly draft: CvDraft }
  | { readonly kind: "unconfigured" | "throttled" | "unreadable" | "too_long" | "no_text" | "not_understood" | "failed" };

export interface ImportOptions {
  /** Injected in tests: no paid call ever leaves a test. */
  readonly read?: CvReader;
  readonly extract?: (bytes: Uint8Array) => Promise<PdfText>;
  readonly now?: Date;
}

const apiKey = (): string => process.env.ANTHROPIC_API_KEY ?? "";

/** True when a model is configured: without it, the import is not offered. */
export const importConfigured = (): boolean => apiKey() !== "";

const dailyCap = (): number => {
  const value = Number(process.env.PROOFSEEN_IMPORT_DAILY_CAP ?? "");
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_CAP;
};

export const importCv = async (userId: string, pdf: Uint8Array, options: ImportOptions = {}): Promise<ImportOutcome> => {
  if (options.read === undefined && !importConfigured()) return { kind: "unconfigured" };
  const now = options.now ?? new Date();
  if (await throttled("cv-import", userId, PER_PERSON, now)) return { kind: "throttled" };
  const extracted = await (options.extract ?? pdfText)(pdf);
  if (extracted.kind !== "ok") return { kind: extracted.kind };
  if (extracted.text.length < MIN_TEXT_CHARS) return { kind: "no_text" };
  // The platform-wide cap is counted last, so refused requests do not use it up.
  if (await throttled("cv-import-daily", "platform", { windowMs: DAY_MS, max: dailyCap() }, now)) return { kind: "throttled" };
  try {
    const read = options.read ?? createCvReader({ apiKey: apiKey(), model: IMPORT_MODEL, transport: fetchTransport });
    const draft = draftFromCandidate((await read(extracted.text)).candidate);
    return isEmptyDraft(draft) ? { kind: "not_understood" } : { kind: "ok", draft };
  } catch (error) {
    logError("cv import failed", error);
    return { kind: "failed" };
  }
};
