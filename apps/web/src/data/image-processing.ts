import sharp from "sharp";

/*
 * Every image is decoded and re-encoded before it is stored: what is served is a fresh WebP produced by the server,
 * never the bytes that were uploaded. That drops EXIF and every other metadata block (GPS position, camera serial,
 * embedded thumbnails), applies the orientation the camera recorded, and turns any polyglot file (an image that is also
 * HTML or a script) into a plain picture. The decoder works under a pixel limit, so a decompression bomb fails fast.
 */

export interface ProcessedImage {
  readonly bytes: Buffer;
  readonly contentType: "image/webp";
  readonly width: number;
  readonly height: number;
}

/** Longest side kept, per use: a profile photo is shown small, a portfolio image at page width. */
export const MAX_OUTPUT_SIDE = { photo: 800, portfolio_image: 1600, message_attachment: 2400, post_image: 1600 } as const;

const MAX_INPUT_PIXELS = 40_000_000;
const QUALITY = 82;

export const reencodeImage = async (input: Uint8Array, use: keyof typeof MAX_OUTPUT_SIDE): Promise<ProcessedImage> => {
  const side = MAX_OUTPUT_SIDE[use];
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false })
    .rotate()
    .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, contentType: "image/webp", width: info.width, height: info.height };
};
