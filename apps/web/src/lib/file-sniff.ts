/*
 * What an uploaded file really is, read from its first bytes: never from its name, never from the type the browser
 * announces. Each use accepts a closed list of types and a maximum size; images also get their dimensions read from
 * the header, before any decoder sees them, so a tiny file declaring a gigantic canvas is refused up front.
 *
 * SVG, HTML and anything else that a browser could run is never accepted: only JPEG, PNG, WebP and PDF.
 */

export type UploadKind = "photo" | "cv" | "portfolio_image";

export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const MB = 1024 * 1024;

export interface UploadRule {
  readonly types: readonly SniffedType[];
  readonly maxBytes: number;
  /** Smallest and largest accepted side of an image, in pixels. */
  readonly minSide: number;
  readonly maxSide: number;
}

const IMAGE_TYPES: readonly SniffedType[] = ["image/jpeg", "image/png", "image/webp"];

export const UPLOAD_RULES: Readonly<Record<UploadKind, UploadRule>> = {
  photo: { types: IMAGE_TYPES, maxBytes: 2 * MB, minSide: 64, maxSide: 8000 },
  portfolio_image: { types: IMAGE_TYPES, maxBytes: 2 * MB, minSide: 64, maxSide: 8000 },
  cv: { types: ["application/pdf"], maxBytes: 5 * MB, minSide: 0, maxSide: 0 },
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean => signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (bytes: Uint8Array, offset: number, length: number): string => String.fromCharCode(...bytes.subarray(offset, offset + length));

/** The type recognised in the content, or `null` for anything else. */
export const sniff = (bytes: Uint8Array): SniffedType | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  return null;
};

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

const u16be = (b: Uint8Array, i: number): number => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number): number => (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
const u24le = (b: Uint8Array, i: number): number => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const at = (b: Uint8Array, i: number): number => b[i] ?? 0;

/** Start-of-frame markers: the ones that carry the image size (not DHT 0xC4, JPG 0xC8, DAC 0xCC). */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const jpegSize = (b: Uint8Array): Dimensions | null => {
  let i = 2;
  while (i + 9 < b.length) {
    if (at(b, i) !== 0xff) return null;
    const marker = at(b, i + 1);
    // Fill bytes and markers without a length (RSTn, TEM).
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (SOF.has(marker)) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
};

const webpSize = (b: Uint8Array): Dimensions | null => {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 " && b.length >= 30) return { width: (at(b, 26) | (at(b, 27) << 8)) & 0x3fff, height: (at(b, 28) | (at(b, 29) << 8)) & 0x3fff };
  if (chunk === "VP8L" && b.length >= 25 && at(b, 20) === 0x2f) {
    const [b0, b1, b2, b3] = [at(b, 21), at(b, 22), at(b, 23), at(b, 24)];
    return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X" && b.length >= 30) return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  return null;
};

/** The size an image header declares, or `null` when the header cannot be read. */
export const imageDimensions = (bytes: Uint8Array, type: SniffedType): Dimensions | null => {
  if (type === "image/png") return bytes.length >= 24 && ascii(bytes, 12, 4) === "IHDR" ? { width: u32be(bytes, 16), height: u32be(bytes, 20) } : null;
  if (type === "image/jpeg") return jpegSize(bytes);
  if (type === "image/webp") return webpSize(bytes);
  return null;
};

/*
 * PDF features that run something when the file is opened: scripts, launch actions, embedded files, rich media, XFA
 * forms. A CV needs none of them. Markers inside compressed object streams escape this check; the file is in any case
 * only ever served to its owner, as an attachment, under a policy that forbids everything.
 */
const ACTIVE_PDF = /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)(?![A-Za-z])/;

export const hasActivePdfContent = (bytes: Uint8Array): boolean => ACTIVE_PDF.test(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1"));

export type UploadProblem = "empty" | "too_large" | "type" | "dimensions" | "active_content";

export type Inspection = { readonly ok: true; readonly contentType: SniffedType; readonly dimensions: Dimensions | null } | { readonly ok: false; readonly problem: UploadProblem };

/** Whether `bytes` may be stored for `kind`, and as what. */
export const inspectUpload = (kind: UploadKind, bytes: Uint8Array): Inspection => {
  const rule = UPLOAD_RULES[kind];
  if (bytes.length === 0) return { ok: false, problem: "empty" };
  if (bytes.length > rule.maxBytes) return { ok: false, problem: "too_large" };
  const type = sniff(bytes);
  if (type === null || !rule.types.includes(type)) return { ok: false, problem: "type" };
  if (type === "application/pdf") return hasActivePdfContent(bytes) ? { ok: false, problem: "active_content" } : { ok: true, contentType: type, dimensions: null };
  const size = imageDimensions(bytes, type);
  if (size === null) return { ok: false, problem: "dimensions" };
  const fits = (side: number): boolean => side >= rule.minSide && side <= rule.maxSide;
  return fits(size.width) && fits(size.height) ? { ok: true, contentType: type, dimensions: size } : { ok: false, problem: "dimensions" };
};
