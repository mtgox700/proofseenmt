import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hasActivePdfContent, imageDimensions, inspectUpload, sniff, UPLOAD_RULES } from "../src/lib/file-sniff";

/*
 * What an upload really is, read from its bytes. The name and the type the browser announces never reach this code:
 * an SVG, an HTML page or a script renamed "photo.jpg" is refused, whatever it claims.
 */

const image = (format: "jpeg" | "png" | "webp", width = 320, height = 200, lossless = false): Promise<Buffer> => {
  const base = sharp({ create: { width, height, channels: 3, background: "#3fcf9c" } });
  if (format === "jpeg") return base.jpeg().toBuffer();
  if (format === "png") return base.png().toBuffer();
  return base.webp({ lossless }).toBuffer();
};

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("type sniffing", () => {
  it("recognises JPEG, PNG, WebP and PDF by their first bytes", async () => {
    expect(sniff(await image("jpeg"))).toBe("image/jpeg");
    expect(sniff(await image("png"))).toBe("image/png");
    expect(sniff(await image("webp"))).toBe("image/webp");
    expect(sniff(text("%PDF-1.7\n%âãÏÓ\n"))).toBe("application/pdf");
  });

  it("refuses SVG, HTML, scripts, GIF and anything unknown, whatever the name says", () => {
    for (const hostile of ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "<!doctype html><script>alert(1)</script>", "GIF89a\u0001\u0000", "#!/bin/sh\nrm -rf /", "PK\u0003\u0004", " %PDF-1.7"]) {
      expect(sniff(text(hostile))).toBeNull();
      expect(inspectUpload("photo", text(hostile))).toEqual({ ok: false, problem: "type" });
      expect(inspectUpload("cv", text(hostile))).toEqual({ ok: false, problem: "type" });
    }
  });

  it("keeps each type to its use: no PDF as a photo, no image as a CV", async () => {
    expect(inspectUpload("photo", text("%PDF-1.7\n"))).toEqual({ ok: false, problem: "type" });
    expect(inspectUpload("cv", await image("png"))).toEqual({ ok: false, problem: "type" });
  });
});

describe("image headers", () => {
  it("reads the declared size of each format before any decoding", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const bytes = await image(format, 321, 123);
      const type = sniff(bytes);
      expect(type).not.toBeNull();
      if (type !== null) expect(imageDimensions(bytes, type)).toEqual({ width: 321, height: 123 });
    }
    const lossless = await image("webp", 77, 66, true);
    expect(imageDimensions(lossless, "image/webp")).toEqual({ width: 77, height: 66 });
  });

  it("refuses an image too small, a canvas too large and a header that cannot be read", async () => {
    expect(inspectUpload("photo", await image("png", 40, 40))).toEqual({ ok: false, problem: "dimensions" });
    // A PNG header that declares 50 000 × 50 000 pixels: refused on the header, the decoder never sees it.
    const bomb = Buffer.from(await image("png", 100, 100));
    bomb.writeUInt32BE(50_000, 16);
    bomb.writeUInt32BE(50_000, 20);
    expect(inspectUpload("photo", bomb)).toEqual({ ok: false, problem: "dimensions" });
    expect(inspectUpload("photo", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toEqual({ ok: false, problem: "dimensions" });
    expect(inspectUpload("photo", await image("jpeg"))).toEqual({ ok: true, contentType: "image/jpeg", dimensions: { width: 320, height: 200 } });
  });

  it("refuses an empty file and a file over the size of its use", () => {
    expect(inspectUpload("photo", new Uint8Array(0))).toEqual({ ok: false, problem: "empty" });
    const big = new Uint8Array(UPLOAD_RULES.photo.maxBytes + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(inspectUpload("photo", big)).toEqual({ ok: false, problem: "too_large" });
    const pdf = new Uint8Array(UPLOAD_RULES.cv.maxBytes + 1);
    pdf.set(text("%PDF-1.7"));
    expect(inspectUpload("cv", pdf)).toEqual({ ok: false, problem: "too_large" });
  });
});

describe("active PDF content", () => {
  it("refuses a PDF carrying scripts, launch actions or embedded files", () => {
    expect(hasActivePdfContent(text("%PDF-1.7\n1 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj"))).toBe(true);
    expect(hasActivePdfContent(text("%PDF-1.7\n1 0 obj << /OpenAction << /S /Launch /F (calc.exe) >> >>"))).toBe(true);
    expect(hasActivePdfContent(text("%PDF-1.7\n<< /Names << /EmbeddedFiles 3 0 R >> >>"))).toBe(true);
    expect(inspectUpload("cv", text("%PDF-1.7\n<< /AA << /O << /JS (x) >> >> >>"))).toEqual({ ok: false, problem: "active_content" });
    expect(inspectUpload("cv", text("%PDF-1.7\n<< /Type /Catalog /Pages 2 0 R >>\n%%EOF"))).toEqual({ ok: true, contentType: "application/pdf", dimensions: null });
    // A word that merely starts like a marker is not one.
    expect(hasActivePdfContent(text("%PDF-1.7\n(/JSON export)"))).toBe(false);
  });
});
