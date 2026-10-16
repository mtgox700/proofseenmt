import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { CV_READING, saveCv as saveWith } from "../src/data/cv-upload";
import { pdfText } from "../src/data/pdf-text";
import { cleanPdf, encryptedPdf, hiddenOpenActionPdf } from "./support/pdf-samples";

/*
 * The CV upload (wave-3 review, M1): companies download the CV, so the PDF worker reads it before it is stored, and a
 * CV with active content hidden in an object stream, an encrypted CV or an unreadable one is refused.
 */

let t: TestDatabase;
let root: string;

beforeAll(async () => {
  t = await openTestDatabase();
  root = await mkdtemp(join(tmpdir(), "proofseen-cv-upload-test-"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
  await rm(root, { recursive: true, force: true });
});

/** The real worker, with a deadline a loaded test machine always meets. */
const saveCv = (...[db, actor, upload, folder, read]: Parameters<typeof saveWith>) =>
  saveWith(db, actor, upload, folder, read ?? ((bytes) => pdfText(bytes, { ...CV_READING, deadlineMs: 60_000 })));

const pdf = (bytes: Uint8Array): File => new File([new Uint8Array(bytes)], "cv.pdf", { type: "application/pdf" });

describe("CV upload", () => {
  it("stores a plain CV", async () => {
    const userId = await createUser(t.db);
    const saved = await saveCv(t.db, { userId }, pdf(cleanPdf("Camille Martin, data engineer")), root);
    expect(saved.kind).toBe("stored");
  });

  it("refuses a CV with active content, an encrypted one, an unreadable one or a too long one, and stores nothing", async () => {
    const userId = await createUser(t.db);
    expect(await saveCv(t.db, { userId }, pdf(hiddenOpenActionPdf()), root)).toEqual({ kind: "active_content" });
    expect(await saveCv(t.db, { userId }, pdf(encryptedPdf()), root)).toEqual({ kind: "encrypted" });
    expect(await saveCv(t.db, { userId }, pdf(new TextEncoder().encode("%PDF-1.4 not really a document")), root)).toEqual({ kind: "unreadable" });
    expect(await saveCv(t.db, { userId }, pdf(cleanPdf("CV", 51)), root)).toEqual({ kind: "too_many_pages" });
    expect(await t.db.storedFile.count({ where: { ownerId: userId } })).toBe(0);
  });

  it("says when the reader is busy instead of storing the CV unchecked", async () => {
    const userId = await createUser(t.db);
    expect(await saveCv(t.db, { userId }, pdf(cleanPdf("CV")), root, async () => ({ kind: "busy" }))).toEqual({ kind: "busy" });
    expect(await saveCv(t.db, { userId }, null, root)).toEqual({ kind: "missing" });
  });
});
