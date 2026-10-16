import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CvReader } from "@proofseen/engines";
import { importCv, type ImportCaller } from "../src/data/cv-import";
import { pdfText, type PdfText } from "../src/data/pdf-text";

/*
 * Reading a CV the freelancer uploaded into a draft. A fake reader stands in for the model and a fake extractor for
 * the PDF: no paid call ever leaves a test. Without a database the throttle counts in memory, per test user.
 */

let user = 0;
const nextUser = (): string => {
  user += 1;
  return `cv-import-test-user-${user}-${Date.now()}`;
};

/** A distinct person from a distinct address, established unless said otherwise. */
const person = (overrides: Partial<ImportCaller> = {}): ImportCaller => ({ userId: nextUser(), address: `198.51.100.${user % 250}-${Date.now()}`, established: true, ...overrides });

const CV_TEXT = `Camille Martin — Data engineer. ${"Expérience : plateforme Spark et dbt chez Acme de 2021 à aujourd'hui. ".repeat(6)}`;
const extracted = (text: string = CV_TEXT): ((bytes: Uint8Array) => Promise<PdfText>) => async () => ({ kind: "ok", text, active: false, links: [] });
const reading = (candidate: unknown): CvReader => async () => ({ candidate, costUsd: 0 });
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("CV import", () => {
  it("returns a revalidated draft and nothing else: no grade, no seniority, no contact details", async () => {
    const outcome = await importCv(person(), PDF, {
      extract: extracted(),
      read: reading({
        experiences: [{ title: "Data engineer", company: "Acme", start: "2021-04", end: null, description: "Spark. Écrire à camille@exemple.fr", skills: ["Spark"] }],
        languages: [{ code: "en", level: "c1" }],
        skills: ["Spark", "dbt"],
        seniority: "senior",
        score: 8,
      }),
    });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.draft.experiences).toEqual([{ title: "Data engineer", company: "Acme", startMonth: "2021-04", endMonth: null, description: null, skills: ["Spark"] }]);
    expect(outcome.draft.languages).toEqual([{ code: "en", level: "c1" }]);
    expect(JSON.stringify(outcome.draft)).not.toMatch(/senior|score|camille@/);
  });

  it("is unavailable without a configured model", async () => {
    expect(await importCv(person(), PDF, { extract: extracted() })).toEqual({ kind: "unconfigured" });
  });

  it("does not pay for a PDF that is too long, unreadable or without text", async () => {
    const read = vi.fn(reading({ skills: ["Go"] }));
    expect(await importCv(person(), PDF, { read, extract: async () => ({ kind: "too_long" }) })).toEqual({ kind: "too_long" });
    expect(await importCv(person(), PDF, { read, extract: async () => ({ kind: "unreadable" }) })).toEqual({ kind: "unreadable" });
    expect(await importCv(person(), PDF, { read, extract: extracted("Scan") })).toEqual({ kind: "no_text" });
    expect(read).not.toHaveBeenCalled();
  });

  it("says when nothing usable came back, and when the model fails", async () => {
    expect(await importCv(person(), PDF, { extract: extracted(), read: reading("pas un objet") })).toEqual({ kind: "not_understood" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing: CvReader = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await importCv(person(), PDF, { extract: extracted(), read: failing })).toEqual({ kind: "failed" });
  });

  it("limits each person to five readings a day", async () => {
    const who = person();
    const read = vi.fn(reading({ skills: ["Go"] }));
    for (let i = 0; i < 5; i += 1) expect((await importCv(who, PDF, { read, extract: extracted() })).kind).toBe("ok");
    expect(await importCv(who, PDF, { read, extract: extracted() })).toEqual({ kind: "throttled" });
    expect(read).toHaveBeenCalledTimes(5);
  });

  it("stops at the platform-wide daily cap", async () => {
    vi.stubEnv("PROOFSEEN_IMPORT_DAILY_CAP", "2");
    const read = vi.fn(reading({ skills: ["Go"] }));
    const now = new Date("2031-01-01T10:00:00Z");
    const outcomes = [];
    for (let i = 0; i < 3; i += 1) outcomes.push((await importCv(person(), PDF, { read, extract: extracted(), now })).kind);
    expect(outcomes).toEqual(["ok", "ok", "throttled"]);
  });

  it("limits each network address, whatever the number of accounts behind it", async () => {
    const address = `203.0.113.7-${Date.now()}`;
    const read = vi.fn(reading({ skills: ["Go"] }));
    const now = new Date("2032-01-01T10:00:00Z");
    const outcomes = [];
    for (let i = 0; i < 11; i += 1) outcomes.push((await importCv(person({ address }), PDF, { read, extract: extracted(), now })).kind);
    expect(outcomes.filter((kind) => kind === "ok")).toHaveLength(10);
    expect(outcomes.at(-1)).toBe("throttled");
    expect(read).toHaveBeenCalledTimes(10);
  });

  it("keeps most of the platform pool for established accounts: new accounts share a small part of it", async () => {
    vi.stubEnv("PROOFSEEN_IMPORT_DAILY_CAP", "4");
    const read = vi.fn(reading({ skills: ["Go"] }));
    const now = new Date("2033-01-01T10:00:00Z");
    const fresh = async () => (await importCv(person({ established: false }), PDF, { read, extract: extracted(), now })).kind;
    const known = async () => (await importCv(person(), PDF, { read, extract: extracted(), now })).kind;
    // A quarter of the pool (one reading here) for new accounts, all of them together.
    expect([await fresh(), await fresh(), await fresh()]).toEqual(["ok", "throttled", "throttled"]);
    // The rest stays for established accounts, up to the platform cap.
    expect([await known(), await known(), await known(), await known()]).toEqual(["ok", "ok", "ok", "throttled"]);
  });

  it("does not pay when the PDF reader is busy, and says to try later", async () => {
    const read = vi.fn(reading({ skills: ["Go"] }));
    expect(await importCv(person(), PDF, { read, extract: async () => ({ kind: "busy" }) })).toEqual({ kind: "throttled" });
    expect(read).not.toHaveBeenCalled();
  });
});

/** A minimal one-page PDF with a line of text, offsets computed so that the cross-reference table is exact. */
const tinyPdf = (line: string, pages = 1): Uint8Array => {
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...Array.from({ length: pages }, () => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${4 + pages} 0 R >>`),
  ];
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((content, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
};

describe("PDF text", () => {
  it("reads the text of a real PDF", async () => {
    const result = await pdfText(tinyPdf("Data engineer Spark dbt"));
    expect(result).toEqual({ kind: "ok", text: "Data engineer Spark dbt", active: false, links: [] });
  });

  it("refuses a PDF longer than a CV and a file that is not a PDF", async () => {
    expect(await pdfText(tinyPdf("x", 11))).toEqual({ kind: "too_long" });
    expect(await pdfText(new TextEncoder().encode("%PDF-1.4 not really"))).toEqual({ kind: "unreadable" });
  });
});
