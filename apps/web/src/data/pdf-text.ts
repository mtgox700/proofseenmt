import { existsSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { z } from "zod";
import { logError } from "../lib/log";

/*
 * The reading of an uploaded PDF on the server: its text, whether it carries active content, its links. PDF.js never
 * runs in the web process: each reading gets its own worker thread (pdf-worker.mjs) with a heap cap and a hard
 * deadline, after which the thread is terminated whatever it is doing. A file larger than a CV is refused before any
 * thread starts, the text handed back is capped, and only MAX_PDF_WORKERS readings of each purpose run at once (CV
 * import and upload on one side, message attachments on the other, so that a burst of attachments never blocks a CV
 * import): beyond, the caller is told the reader is busy.
 *
 * How the worker file ships: it is a plain .mjs file next to this one, loaded by path at run time, so the Next.js
 * bundler neither rewrites nor moves it. The Docker image copies the whole repository (`COPY . .`), builds with
 * `pnpm --filter @proofseen/web build` and runs `next start` from apps/web: the file is at
 * <cwd>/src/data/pdf-worker.mjs, and `unpdf` resolves from apps/web/node_modules. From the repository root (tests), it
 * is at apps/web/src/data/pdf-worker.mjs. A standalone output (`output: "standalone"`) would not carry it: that switch
 * would need the file listed in `outputFileTracingIncludes`.
 */

export const MAX_CV_PAGES = 10;
/** The CV upload limit (MAX_FILE_BYTES.cv in @proofseen/db): anything larger is not a CV stored here. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;
/** Ten dense pages hold about 40 000 characters: the rest would only lengthen a paid reading. */
export const MAX_CV_TEXT_CHARS = 60_000;
/** Readings at once, per purpose. */
export const MAX_PDF_WORKERS = 2;
const DEADLINE_MS = 10_000;
const HEAP_MB = 256;
const WORKER_FILE = "pdf-worker.mjs";

/** Each purpose has its own budget of worker threads. */
export type PdfPurpose = "cv" | "attachment";

/**
 * `active`: scripts, launch actions, embedded files, XFA, rich media (see pdf-worker.mjs). `links`: where the links of
 * the document point, to be checked for contact details. `encrypted`: protected by a password or a security handler.
 */
export type PdfText =
  | { readonly kind: "ok"; readonly text: string; readonly active: boolean; readonly links: readonly string[] }
  | { readonly kind: "too_long" | "unreadable" | "encrypted" | "busy" };

export interface PdfTextOptions {
  /** Injected in tests: a stand-in worker plays the hostile PDF. */
  readonly workerFile?: string;
  readonly deadlineMs?: number;
  readonly heapMb?: number;
  /** A longer document is not read at all (CV: MAX_CV_PAGES; attachments scanned for contact details read more). */
  readonly maxPages?: number;
  /** The text handed back is cut there. */
  readonly maxChars?: number;
  /** Whose worker budget the reading uses; `cv` by default. */
  readonly purpose?: PdfPurpose;
}

const MAX_LINKS = 200;
const MAX_LINK_LENGTH = 2048;

const AnswerSchema = z.union([
  z.object({ kind: z.literal("ok"), text: z.string(), active: z.boolean(), links: z.array(z.string().max(MAX_LINK_LENGTH)).max(MAX_LINKS) }),
  z.object({ kind: z.enum(["too_long", "unreadable", "encrypted"]) }),
]);

const UNREADABLE: PdfText = { kind: "unreadable" };

/** The worker file, from the app folder (`next start`) or the repository root (tests); `null` when absent. */
export const pdfWorkerFile = (cwd: string = process.cwd()): string | null =>
  [join(cwd, "src", "data", WORKER_FILE), join(cwd, "apps", "web", "src", "data", WORKER_FILE)].find((path) => existsSync(path)) ?? null;

const answerOf = (message: unknown, maxChars: number): PdfText => {
  const parsed = AnswerSchema.safeParse(message);
  if (!parsed.success) return UNREADABLE;
  return parsed.data.kind === "ok" ? { kind: "ok", text: parsed.data.text.slice(0, maxChars), active: parsed.data.active, links: parsed.data.links } : { kind: parsed.data.kind };
};

const running: Record<PdfPurpose, number> = { cv: 0, attachment: 0 };

interface WorkerLimits {
  readonly purpose: PdfPurpose;
  readonly deadlineMs: number;
  readonly heapMb: number;
  readonly maxPages: number;
  readonly maxChars: number;
}

const runWorker = (file: string, bytes: Uint8Array, { purpose, deadlineMs, heapMb, maxPages, maxChars }: WorkerLimits): Promise<PdfText> =>
  new Promise((resolve) => {
    // The worker gets its own copy of the bytes, moved rather than cloned; the caller keeps its own.
    const copy = new Uint8Array(bytes);
    const worker = new Worker(file, {
      workerData: { bytes: copy, maxPages, maxChars },
      transferList: [copy.buffer],
      resourceLimits: { maxOldGenerationSizeMb: heapMb, maxYoungGenerationSizeMb: Math.min(32, heapMb), stackSizeMb: 4 },
      // No secret of the web process reaches the thread that parses an untrusted file.
      env: {},
      execArgv: [],
    });
    let settled = false;
    const finish = (result: PdfText, stopped?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      running[purpose] -= 1;
      if (stopped !== undefined) logError("pdf text: worker stopped", undefined, new Date(), stopped);
      void worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish(UNREADABLE, "deadline"), deadlineMs);
    worker.once("message", (message: unknown) => finish(answerOf(message, maxChars)));
    worker.once("error", () => finish(UNREADABLE, "worker-error"));
    worker.once("exit", () => finish(UNREADABLE, "worker-exit"));
  });

export const pdfText = async (bytes: Uint8Array, options: PdfTextOptions = {}): Promise<PdfText> => {
  if (bytes.byteLength > MAX_CV_BYTES) return { kind: "too_long" };
  const purpose = options.purpose ?? "cv";
  if (running[purpose] >= MAX_PDF_WORKERS) return { kind: "busy" };
  const file = options.workerFile ?? pdfWorkerFile();
  if (file === null) {
    logError("pdf text: worker file not found");
    return UNREADABLE;
  }
  running[purpose] += 1;
  try {
    return await runWorker(file, bytes, {
      purpose,
      deadlineMs: options.deadlineMs ?? DEADLINE_MS,
      heapMb: options.heapMb ?? HEAP_MB,
      maxPages: options.maxPages ?? MAX_CV_PAGES,
      maxChars: options.maxChars ?? MAX_CV_TEXT_CHARS,
    });
  } catch (error) {
    // The Worker constructor itself failed (bad path, no thread available): `finish` never ran.
    running[purpose] -= 1;
    logError("pdf text: worker not started", error);
    return UNREADABLE;
  }
};
