import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MONOGRAM_SMALL_PATH } from "@proofseen/brand";

/*
 * Draws the notification badge of the installable app (C20) from the poincon of the brand (small master): white on
 * transparent, since Android reads only its alpha. Run once, offline, and commit the PNG:
 * `pnpm --filter @proofseen/web icons`.
 *
 * The other icons (any, maskable, Apple touch, favicons, share cards) are drawn by the brand itself
 * (packages/brand/scripts, written to public/brand/): this script no longer makes them.
 */

const here = dirname(fileURLToPath(import.meta.url));
const publicIcons = join(here, "..", "public", "icons");
const SIZE = 96;
// The cartouche fills 84 % of the badge: Android crops badges into a circle on some launchers.
const SCALE = 0.84;

const badge = (): string => {
  const offset = (32 - 32 / SCALE) / 2;
  const box = 32 / SCALE;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offset} ${offset} ${box} ${box}" width="${SIZE}" height="${SIZE}">` +
    `<path fill="#ffffff" fill-rule="evenodd" d="${MONOGRAM_SMALL_PATH}"/></svg>`
  );
};

const main = async (): Promise<void> => {
  mkdirSync(publicIcons, { recursive: true });
  const file = join(publicIcons, "badge-96.png");
  const info = await sharp(Buffer.from(badge())).png({ compressionLevel: 9 }).toFile(file);
  process.stdout.write(`public/icons/badge-96.png ${info.width}x${info.height} ${Math.round(info.size / 102.4) / 10} KB\n`);
};

main().catch((error: unknown) => {
  process.stderr.write(`pwa-icons : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
