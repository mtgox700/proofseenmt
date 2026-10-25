import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

/*
 * Texte extrait d'un PDF, pour prouver que les accents, les noms étrangers et la typographie sont dans le fichier et pas
 * seulement dessinés. `pdftotext` (poppler) quand il est installé ; sinon un extracteur minimal des flux : objets,
 * tables ToUnicode des polices, opérateurs Tj et TJ des pages. Le second est lui-même contrôlé contre le premier.
 */

export const pdftotextAvailable = (): boolean => spawnSync("pdftotext", ["-v"], { encoding: "utf8" }).error === undefined;

export const extractWithPdftotext = (pdf: Buffer): string => {
  const dir = mkdtempSync(join(tmpdir(), "proofseen-pdftotext-"));
  try {
    const file = join(dir, "in.pdf");
    writeFileSync(file, pdf);
    const run = spawnSync("pdftotext", ["-enc", "UTF-8", file, "-"], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`pdftotext a échoué : ${run.stderr}`);
    return run.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

interface PdfObject {
  readonly dict: string;
  readonly stream: Buffer | null;
}

const OBJECT = /(\d+) 0 obj\r?\n([\s\S]*?)endobj/g;

const parseObjects = (pdf: Buffer): ReadonlyMap<number, PdfObject> => {
  const text = pdf.toString("latin1");
  const objects = new Map<number, PdfObject>();
  for (const match of text.matchAll(OBJECT)) {
    const body = match[2] ?? "";
    const at = body.indexOf("stream");
    if (at < 0) {
      objects.set(Number(match[1]), { dict: body, stream: null });
      continue;
    }
    const start = (match.index ?? 0) + (match[0].indexOf(body)) + at + "stream".length + (body.startsWith("\r\n", at + 6) ? 2 : 1);
    const end = (match.index ?? 0) + match[0].indexOf(body) + body.lastIndexOf("endstream");
    const raw = pdf.subarray(start, end);
    const dict = body.slice(0, at);
    objects.set(Number(match[1]), { dict, stream: /FlateDecode/.test(dict) ? inflateSync(raw.subarray(0, raw.length)) : raw });
  }
  return objects;
};

const utf16 = (hex: string): string => Buffer.from(hex, "hex").swap16().toString("utf16le");

/** Table glyphe vers texte d'une police, lue dans son flux ToUnicode. */
const readCMap = (cmap: string): ReadonlyMap<number, string> => {
  const map = new Map<number, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of (block[1] ?? "").matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(pair[1] ?? "0", 16), utf16(pair[2] ?? ""));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // Deux formes : `<de> <à> <début>` (plage continue) et `<de> <à> [<texte> <texte> ...]` (un texte par glyphe, ligatures
    // comprises : `<0066 0069>` est « fi »).
    for (const m of (block[1] ?? "").matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const [from, to] = [parseInt(m[1] ?? "0", 16), parseInt(m[2] ?? "0", 16)];
      if (m[4] !== undefined) {
        [...m[4].matchAll(/<([0-9a-fA-F\s]+)>/g)].forEach((entry, offset) => map.set(from + offset, utf16((entry[1] ?? "").replace(/\s+/g, ""))));
      } else {
        for (let gid = from; gid <= to; gid += 1) map.set(gid, String.fromCodePoint(parseInt(m[3] ?? "0", 16) + gid - from));
      }
    }
  }
  return map;
};

const fontMaps = (objects: ReadonlyMap<number, PdfObject>): ReadonlyMap<string, ReadonlyMap<number, string>> => {
  const byResource = new Map<string, ReadonlyMap<number, string>>();
  for (const object of objects.values()) {
    for (const group of object.dict.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
      for (const ref of (group[1] ?? "").matchAll(/\/(\w+)\s+(\d+) 0 R/g)) {
        const font = objects.get(Number(ref[2]));
        const toUnicode = /\/ToUnicode (\d+) 0 R/.exec(font?.dict ?? "");
        const cmap = toUnicode === null ? undefined : objects.get(Number(toUnicode[1]))?.stream;
        if (cmap !== undefined && cmap !== null && ref[1] !== undefined) byResource.set(ref[1], readCMap(cmap.toString("latin1")));
      }
    }
  }
  return byResource;
};

const decodeHex = (hex: string, cmap: ReadonlyMap<number, string> | undefined): string =>
  (hex.match(/.{4}/g) ?? []).map((gid) => cmap?.get(parseInt(gid, 16)) ?? "").join("");

/** Texte de tous les flux de contenu, dans l'ordre des objets, un fragment par ligne. */
export const extractFromStreams = (pdf: Buffer): string => {
  const objects = parseObjects(pdf);
  const fonts = fontMaps(objects);
  const lines: string[] = [];
  for (const object of objects.values()) {
    if (object.stream === null || /\/Type\s*\/(?:XObject|Metadata)/.test(object.dict) || !/\bTf\b/.test(object.stream.toString("latin1"))) continue;
    let current: ReadonlyMap<number, string> | undefined;
    for (const op of object.stream.toString("latin1").matchAll(/\/(\w+)\s+[\d.]+\s+Tf|\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g)) {
      if (op[1] !== undefined) current = fonts.get(op[1]);
      else if (op[2] !== undefined) lines.push([...op[2].matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => decodeHex(m[1] ?? "", current)).join(""));
      else if (op[3] !== undefined) lines.push(decodeHex(op[3], current));
    }
  }
  return lines.join("\n");
};

/** Le texte du PDF : poppler s'il est là, sinon l'extracteur des flux. */
export const extractText = (pdf: Buffer): string => (pdftotextAvailable() ? extractWithPdftotext(pdf) : extractFromStreams(pdf));
