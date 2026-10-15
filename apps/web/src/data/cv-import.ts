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
 * Each reading is paid: a per-person limit, a per-address limit (a handful of accounts behind one address cannot add up
 * their allowances) and a platform-wide daily cap (PROOFSEEN_IMPORT_DAILY_CAP, 20 by default). Most of that pool is kept
 * for established accounts (profile published, or account older than a week): new accounts, the cheap ones to create,
 * all share NEW_ACCOUNT_SHARE of it, so a burst of throwaway accounts cannot use up the day for everyone else.
 * Without ANTHROPIC_API_KEY the import is "unconfigured" and the page does not offer it.
 */

export const IMPORT_MODEL = "claude-haiku-4-5-20251001";
const DAY_MS = 24 * 60 * 60_000;
const PER_PERSON = { windowMs: DAY_MS, max: 5 };
const PER_ADDRESS = { windowMs: DAY_MS, max: 10 };
const DEFAULT_DAILY_CAP = 20;
/** The part of the daily pool that new accounts share between them, at least one reading. */
export const NEW_ACCOUNT_SHARE = 0.25;
/** Without a known address (no proxy in front), every such caller shares one bucket: still limited, never unlimited. */
const UNKNOWN_ADDRESS = "unknown";
/** Under this, the PDF holds no real text (a scan): nothing worth a paid call. */
const MIN_TEXT_CHARS = 200;

export type ImportOutcome =
  | { readonly kind: "ok"; readonly draft: CvDraft }
  | { readonly kind: "unconfigured" | "throttled" | "unreadable" | "too_long" | "no_text" | "not_understood" | "failed" };

/** Who asks for a reading: the account, the network address it came from, and whether the account is established. */
export interface ImportCaller {
  readonly userId: string;
  /** The client address as the proxy saw it (X-Real-IP set by Caddy); `null` when unknown. */
  readonly address: string | null;
  readonly established: boolean;
}

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

const newAccountCap = (cap: number): number => Math.max(1, Math.floor(cap * NEW_ACCOUNT_SHARE));

/** The platform pool: new accounts first pass their shared sub-cap, then everyone counts against the whole pool. */
const poolExhausted = async (caller: ImportCaller, now: Date): Promise<boolean> => {
  const cap = dailyCap();
  if (!caller.established && (await throttled("cv-import-daily-new", "platform", { windowMs: DAY_MS, max: newAccountCap(cap) }, now))) return true;
  return throttled("cv-import-daily", "platform", { windowMs: DAY_MS, max: cap }, now);
};

export const importCv = async (caller: ImportCaller, pdf: Uint8Array, options: ImportOptions = {}): Promise<ImportOutcome> => {
  if (options.read === undefined && !importConfigured()) return { kind: "unconfigured" };
  const now = options.now ?? new Date();
  if (await throttled("cv-import", caller.userId, PER_PERSON, now)) return { kind: "throttled" };
  if (await throttled("cv-import-address", caller.address ?? UNKNOWN_ADDRESS, PER_ADDRESS, now)) return { kind: "throttled" };
  const extracted = await (options.extract ?? pdfText)(pdf);
  // A busy reader is a "try later", like a limit: nothing was read, nothing is paid.
  if (extracted.kind === "busy") return { kind: "throttled" };
  if (extracted.kind !== "ok") return { kind: extracted.kind };
  if (extracted.text.length < MIN_TEXT_CHARS) return { kind: "no_text" };
  // The platform-wide pool is counted last, so refused requests do not use it up.
  if (await poolExhausted(caller, now)) return { kind: "throttled" };
  try {
    const read = options.read ?? createCvReader({ apiKey: apiKey(), model: IMPORT_MODEL, transport: fetchTransport });
    const draft = draftFromCandidate((await read(extracted.text)).candidate);
    return isEmptyDraft(draft) ? { kind: "not_understood" } : { kind: "ok", draft };
  } catch (error) {
    logError("cv import failed", error);
    return { kind: "failed" };
  }
};
