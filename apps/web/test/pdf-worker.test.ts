import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasActivePdfContent } from "../src/lib/file-sniff";
import { ATTACHMENT_READING } from "../src/data/attachments";
import { pdfText } from "../src/data/pdf-text";
import { cleanPdf, encryptedPdf, escapedScriptPdf, formPdf, hiddenLaunchLinkPdf, hiddenOpenActionPdf, linkPdf } from "./support/pdf-samples";

/*
 * The REAL worker (src/data/pdf-worker.mjs, PDF.js inside) on small generated PDFs (wave-3 review, M1 and M2): active
 * content is judged from what PDF.js parsed, object streams included, not from a search through the raw bytes; the
 * links of the document come back to be checked for contact details; an encrypted PDF is reported as such.
 */

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The attachment reading, with a deadline a loaded test machine always meets. */
const READ = { ...ATTACHMENT_READING, deadlineMs: 60_000 } as const;

describe("PDF worker verdict", () => {
  it("reads a clean PDF: its text, no active content, no link", async () => {
    expect(await pdfText(cleanPdf("Devis mission data"), READ)).toEqual({ kind: "ok", text: "Devis mission data", active: false, links: [] });
  });

  it("finds a script run at opening hidden in a compressed object stream, which the raw scan misses", async () => {
    const pdf = hiddenOpenActionPdf();
    expect(hasActivePdfContent(pdf)).toBe(false);
    const result = await pdfText(pdf, READ);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.active).toBe(true);
  });

  it("finds a launch action hidden in a compressed object stream", async () => {
    const result = await pdfText(hiddenLaunchLinkPdf(), READ);
    expect(result.kind === "ok" && result.active).toBe(true);
  });

  it("hands back the links of the document, a mailbox included", async () => {
    const result = await pdfText(linkPdf("Ecrivez-moi", "mailto:jean.dupont@example.com"), READ);
    expect(result).toEqual({ kind: "ok", text: "Ecrivez-moi", active: false, links: ["mailto:jean.dupont@example.com"] });
  });

  it("takes a fillable form for active content: a CV or a quote has no field to fill", async () => {
    const pdf = formPdf();
    expect(hasActivePdfContent(pdf)).toBe(false);
    const result = await pdfText(pdf, READ);
    expect(result.kind === "ok" && result.active).toBe(true);
  });

  it("reports an encrypted PDF, even one that opens without a password", async () => {
    expect(await pdfText(encryptedPdf(), READ)).toEqual({ kind: "encrypted" });
  });
});

describe("raw scan, the cheap first filter", () => {
  it("sees through #xx escapes in names", () => {
    expect(hasActivePdfContent(escapedScriptPdf())).toBe(true);
    expect(hasActivePdfContent(cleanPdf("Bonjour"))).toBe(false);
  });
});
