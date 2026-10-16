import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

/*
 * Small PDFs built byte by byte for the tests of the PDF reader: a clean one, one whose link points to a mailbox, one
 * whose active content hides in a compressed object stream (where a plain scan of the file never sees it), an
 * encrypted one. Offsets are computed, so PDF.js reads them without having to repair anything.
 */

const latin1 = (text: string): Buffer => Buffer.from(text, "latin1");

const CATALOG = (extra = ""): string => `<< /Type /Catalog /Pages 2 0 R${extra} >>`;
const PAGES = "<< /Type /Pages /Kids [4 0 R] /Count 1 >>";
const FONT = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
const PAGE = (extra = ""): string => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R${extra} >>`;

const contents = (line: string): string => {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
};

/** A classic PDF: objects 1..n written as they are, with an exact cross-reference table. */
export const classicPdf = (objects: readonly string[], trailerExtra = ""): Uint8Array => {
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((content, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${trailerExtra} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(latin1(body));
};

/** A one-page PDF with a line of text; `pages` repeats the page to make a long document. */
export const cleanPdf = (line: string, pages = 1): Uint8Array => {
  if (pages === 1) return classicPdf([CATALOG(), PAGES, FONT, PAGE(), contents(line)]);
  const kids = Array.from({ length: pages }, () => "4 0 R").join(" ");
  return classicPdf([CATALOG(), `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`, FONT, PAGE(), contents(line)]);
};

/** A one-page PDF whose only link points to `uri` (an e-mail address, a phone, a website). */
export const linkPdf = (line: string, uri: string): Uint8Array =>
  classicPdf([CATALOG(), PAGES, FONT, PAGE(" /Annots [6 0 R]"), contents(line), `<< /Type /Annot /Subtype /Link /Rect [72 700 300 720] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`]);

/** A fillable form: one text field, declared in the catalog and drawn as a widget on the page. */
export const formPdf = (): Uint8Array =>
  classicPdf([
    CATALOG(" /AcroForm << /Fields [6 0 R] >>"),
    PAGES,
    FONT,
    PAGE(" /Annots [6 0 R]"),
    contents("Bon de commande"),
    "<< /Type /Annot /Subtype /Widget /FT /Tx /T (nom) /Rect [72 600 300 620] /P 4 0 R >>",
  ]);

export interface PdfObject {
  readonly content: string;
  /** Inside the compressed object stream rather than written in the file. */
  readonly packed: boolean;
}

/**
 * A PDF 1.5 whose `packed` objects live in one Flate-compressed object stream, indexed by a cross-reference stream:
 * nothing of them is readable in the file itself.
 */
export const objectStreamPdf = (objects: readonly PdfObject[]): Uint8Array => {
  const objStm = objects.length + 1;
  const xrefNum = objects.length + 2;
  const index = new Map<number, number>();
  let header = "";
  let data = "";
  objects.forEach((object, i) => {
    if (!object.packed) return;
    index.set(i + 1, index.size);
    header += `${i + 1} ${data.length} `;
    data += `${object.content}\n`;
  });
  const packed = deflateSync(latin1(header + data));
  const parts: Buffer[] = [];
  let length = 0;
  const push = (bytes: Buffer): void => {
    parts.push(bytes);
    length += bytes.length;
  };
  const offsets = new Map<number, number>();
  push(latin1("%PDF-1.5\n"));
  objects.forEach((object, i) => {
    if (object.packed) return;
    offsets.set(i + 1, length);
    push(latin1(`${i + 1} 0 obj\n${object.content}\nendobj\n`));
  });
  offsets.set(objStm, length);
  push(latin1(`${objStm} 0 obj\n<< /Type /ObjStm /N ${index.size} /First ${header.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`));
  push(packed);
  push(latin1("\nendstream\nendobj\n"));
  const xrefOffset = length;
  offsets.set(xrefNum, xrefOffset);
  const size = xrefNum + 1;
  const rows = Buffer.alloc(size * 7);
  for (let n = 0; n < size; n += 1) {
    const at = n * 7;
    const slot = index.get(n);
    if (n === 0) {
      rows.writeUInt8(0, at);
      rows.writeUInt32BE(0, at + 1);
      rows.writeUInt16BE(65535, at + 5);
    } else if (slot !== undefined) {
      rows.writeUInt8(2, at);
      rows.writeUInt32BE(objStm, at + 1);
      rows.writeUInt16BE(slot, at + 5);
    } else {
      rows.writeUInt8(1, at);
      rows.writeUInt32BE(offsets.get(n) ?? 0, at + 1);
      rows.writeUInt16BE(0, at + 5);
    }
  }
  push(latin1(`${xrefNum} 0 obj\n<< /Type /XRef /Size ${size} /W [1 4 2] /Root 1 0 R /Length ${rows.length} >>\nstream\n`));
  push(rows);
  push(latin1(`\nendstream\nendobj\nstartxref\n${xrefOffset}\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(parts));
};

/** A PDF that runs a script when opened, its catalog and its action both hidden in the compressed object stream. */
export const hiddenOpenActionPdf = (): Uint8Array =>
  objectStreamPdf([
    { content: CATALOG(" /OpenAction 6 0 R"), packed: true },
    { content: PAGES, packed: true },
    { content: FONT, packed: true },
    { content: PAGE(), packed: true },
    { content: contents("Devis mission data"), packed: false },
    { content: "<< /Type /Action /S /JavaScript /JS (app.alert) >>", packed: true },
  ]);

/** A link that launches a program, hidden in the compressed object stream. */
export const hiddenLaunchLinkPdf = (): Uint8Array =>
  objectStreamPdf([
    { content: CATALOG(), packed: true },
    { content: PAGES, packed: true },
    { content: FONT, packed: true },
    { content: PAGE(" /Annots [6 0 R]"), packed: true },
    { content: contents("Cliquez ici"), packed: false },
    { content: "<< /Type /Annot /Subtype /Link /Rect [72 700 300 720] /A << /S /Launch /F (calc.exe) >> >>", packed: true },
  ]);

/** A script whose name is written with #xx escapes, readable in the file but not by a plain search for the word. */
export const escapedScriptPdf = (): Uint8Array => classicPdf([CATALOG(" /OpenAction 6 0 R"), PAGES, FONT, PAGE(), contents("Bonjour"), "<< /S /J#61vaScript /J#53 (app.alert) >>"]);

const PAD = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");

const rc4 = (key: Buffer, input: Buffer): Buffer => {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 255;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
  }
  const out = Buffer.alloc(input.length);
  let a = 0;
  let b = 0;
  for (let k = 0; k < input.length; k += 1) {
    a = (a + 1) & 255;
    b = (b + (s[a] ?? 0)) & 255;
    [s[a], s[b]] = [s[b] ?? 0, s[a] ?? 0];
    out[k] = (input[k] ?? 0) ^ (s[((s[a] ?? 0) + (s[b] ?? 0)) & 255] ?? 0);
  }
  return out;
};

const md5 = (...parts: Buffer[]): Buffer => createHash("md5").update(Buffer.concat(parts)).digest();

/**
 * A PDF protected by the standard security handler (revision 2, empty user password): it opens without a password,
 * yet it is encrypted. No page content, so nothing has to be encrypted object by object.
 */
export const encryptedPdf = (): Uint8Array => {
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);
  const owner = rc4(md5(PAD).subarray(0, 5), PAD);
  const key = md5(PAD, owner, permissions, id).subarray(0, 5);
  const user = rc4(key, PAD);
  const page = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>";
  return classicPdf(
    [CATALOG(), PAGES, FONT, page, `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P -4 >>`],
    ` /Encrypt 5 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>]`,
  );
};
