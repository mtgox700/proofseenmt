import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { chosenFiles, discardAttachments, saveAttachments } from "../src/data/attachments";
import { readStored } from "../src/data/uploads";

/*
 * Message attachments on disk and in the database (PGlite, temporary folder): what is stored is checked and
 * re-encoded, a PDF carrying contact details is reported as such, and refused files leave nothing behind.
 */

let t: TestDatabase;
let root: string;

beforeAll(async () => {
  t = await openTestDatabase();
  root = await mkdtemp(join(tmpdir(), "proofseen-attachments-test-"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
  await rm(root, { recursive: true, force: true });
});

/** A minimal one-page PDF with a line of text, offsets computed so that the cross-reference table is exact. */
const tinyPdf = (line: string): Uint8Array => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
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

const file = (bytes: Uint8Array, name: string, type: string): File => new File([new Uint8Array(bytes)], name, { type });

describe("message attachments", () => {
  it("keeps only real files from a form field", () => {
    expect(chosenFiles(["text", file(new Uint8Array(), "", "application/octet-stream"), file(new Uint8Array([1]), "a.pdf", "application/pdf")])).toHaveLength(1);
  });

  it("stores a PDF and a re-encoded image, and reports a PDF that carries contact details", async () => {
    const userId = await createUser(t.db);
    const png = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#204060" } }).png().toBuffer();
    const clean = await saveAttachments(t.db, { userId }, [file(tinyPdf("Devis mission data"), "devis.pdf", "application/pdf"), file(png, "capture.png", "image/png")], root);
    expect(clean.kind).toBe("saved");
    if (clean.kind !== "saved") return;
    expect(clean.containContact).toBe(false);
    const rows = await t.db.storedFile.findMany({ where: { id: { in: [...clean.ids] } }, select: { kind: true, contentType: true } });
    expect(rows.map((r) => r.contentType).sort()).toEqual(["application/pdf", "image/webp"]);
    expect(rows.every((r) => r.kind === "message_attachment")).toBe(true);

    const leaking = await saveAttachments(t.db, { userId }, [file(tinyPdf("Appelez-moi au 06 12 34 56 78"), "cv.pdf", "application/pdf")], root);
    expect(leaking.kind === "saved" && leaking.containContact).toBe(true);
  });

  it("refuses more than three files, an oversized one, or a disguised type, and leaves nothing behind", async () => {
    const userId = await createUser(t.db);
    const pdf = file(tinyPdf("x"), "a.pdf", "application/pdf");
    expect(await saveAttachments(t.db, { userId }, [pdf, pdf, pdf, pdf], root)).toEqual({ kind: "refused", problem: "count" });
    expect(await saveAttachments(t.db, { userId }, [file(new Uint8Array(6 * 1024 * 1024), "big.pdf", "application/pdf")], root)).toEqual({ kind: "refused", problem: "too_large" });
    const html = file(new TextEncoder().encode("<html><script>alert(1)</script></html>"), "x.pdf", "application/pdf");
    expect(await saveAttachments(t.db, { userId }, [pdf, html], root)).toEqual({ kind: "refused", problem: "type" });
    expect(await t.db.storedFile.count({ where: { ownerId: userId } })).toBe(0);
  });

  it("removes discarded attachments from the database and the disk", async () => {
    const userId = await createUser(t.db);
    const saved = await saveAttachments(t.db, { userId }, [file(tinyPdf("Annexe"), "a.pdf", "application/pdf")], root);
    if (saved.kind !== "saved") throw new Error(saved.problem);
    const [id] = saved.ids;
    if (id === undefined) throw new Error("no id");
    expect(await readStored(id, root)).not.toBeNull();
    await discardAttachments(t.db, { userId: await createUser(t.db) }, [id], root);
    expect(await readStored(id, root)).not.toBeNull();
    await discardAttachments(t.db, { userId }, [id], root);
    expect(await readStored(id, root)).toBeNull();
    expect(await t.db.storedFile.count({ where: { id } })).toBe(0);
  });
});
