import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CV_BYTES, MAX_CV_TEXT_CHARS, MAX_PDF_WORKERS, pdfText, pdfWorkerFile } from "../src/data/pdf-text";

/*
 * PDF text extraction runs in a worker thread with a heap cap and a hard deadline (wave-2 review, M1): a hostile PDF can
 * only exhaust that thread. Stand-in workers play the hostile PDF, so no crafted PDF is needed: one that never answers,
 * one that allocates without end, one that answers too much, one that answers nonsense.
 */

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/pdf-workers/${name}.mjs`, import.meta.url));
const SOME_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

beforeEach(() => {
  // The stopped workers are logged on purpose; the log line itself is covered by log.test.ts.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PDF text extraction in a worker", () => {
  it("finds the worker file from the app folder (next start) and from the repository root (tests)", () => {
    const appFolder = fileURLToPath(new URL("..", import.meta.url));
    const repositoryRoot = join(appFolder, "..", "..");
    expect(pdfWorkerFile(appFolder)).toBe(join(appFolder, "src", "data", "pdf-worker.mjs"));
    expect(pdfWorkerFile(repositoryRoot)).toBe(join(appFolder, "src", "data", "pdf-worker.mjs"));
    expect(pdfWorkerFile(join(repositoryRoot, "packages"))).toBeNull();
  });

  it("stops a worker that runs past its deadline", async () => {
    const started = Date.now();
    expect(await pdfText(SOME_BYTES, { workerFile: fixture("hang"), deadlineMs: 300 })).toEqual({ kind: "unreadable" });
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("stops a worker that goes over its memory cap", async () => {
    expect(await pdfText(SOME_BYTES, { workerFile: fixture("greedy"), heapMb: 16, deadlineMs: 30_000 })).toEqual({ kind: "unreadable" });
  });

  it("caps the text handed back", async () => {
    const result = await pdfText(SOME_BYTES, { workerFile: fixture("chatty") });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.text).toHaveLength(MAX_CV_TEXT_CHARS);
  });

  it("refuses an answer that is not a reading result", async () => {
    expect(await pdfText(SOME_BYTES, { workerFile: fixture("liar") })).toEqual({ kind: "unreadable" });
  });

  it("refuses a file larger than a CV before starting any worker", async () => {
    // Were a worker started, the deadline would outlast the test timeout.
    expect(await pdfText(new Uint8Array(MAX_CV_BYTES + 1), { workerFile: fixture("hang"), deadlineMs: 120_000 })).toEqual({ kind: "too_long" });
  });

  it("runs a bounded number of extractions at once and says so beyond", async () => {
    const running = Array.from({ length: MAX_PDF_WORKERS }, () => pdfText(SOME_BYTES, { workerFile: fixture("hang"), deadlineMs: 1_500 }));
    expect(await pdfText(SOME_BYTES, { workerFile: fixture("chatty") })).toEqual({ kind: "busy" });
    expect(await Promise.all(running)).toEqual(running.map(() => ({ kind: "unreadable" })));
    // Once they are stopped, the slots are free again.
    expect((await pdfText(SOME_BYTES, { workerFile: fixture("chatty") })).kind).toBe("ok");
  });
});
