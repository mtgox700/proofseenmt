import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/*
 * Draws the icons of the installable app (C20) from the logo mark of src/app/[lang]/icon.svg, in the product palette
 * (tokens.css :root): ink strokes and the proof dot on the page background. Run once, offline, and commit the PNGs:
 * `pnpm --filter @proofseen/web icons`.
 *
 * - "any" icons: the mark at 80 % of the logo box, full-bleed background (launchers that do not mask);
 * - "maskable" icons: the mark at 62 %, so it stays inside the 80 % safe circle whatever shape the launcher cuts;
 * - the Apple touch icon (iOS adds its own rounded corners);
 * - the notification badge: the mark alone, white on transparent (Android only reads its alpha).
 */

const BG = "#070b14";
const INK = "#edf1f7";
const PROOF = "#3fcf9c";

const here = dirname(fileURLToPath(import.meta.url));
const publicIcons = join(here, "..", "public", "icons");
const appSegment = join(here, "..", "src", "app", "[lang]", "app");

interface IconSpec {
  readonly file: string;
  readonly size: number;
  readonly scale: number;
  readonly background: string | null;
  readonly ink: string;
  readonly dot: string;
}

const svg = (spec: IconSpec): string =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${spec.size}" height="${spec.size}">`,
    spec.background === null ? "" : `<rect width="40" height="40" fill="${spec.background}"/>`,
    `<g transform="translate(20 20) scale(${spec.scale}) translate(-20 -20)">`,
    `<path d="M6 11v18M34 11v18M6 20h28" fill="none" stroke="${spec.ink}" stroke-width="3.4" stroke-linecap="round"/>`,
    `<circle cx="22" cy="20" r="6" fill="${spec.dot}"/>`,
    "</g></svg>",
  ].join("");

const ICONS: readonly IconSpec[] = [
  { file: join(publicIcons, "icon-192.png"), size: 192, scale: 0.8, background: BG, ink: INK, dot: PROOF },
  { file: join(publicIcons, "icon-512.png"), size: 512, scale: 0.8, background: BG, ink: INK, dot: PROOF },
  { file: join(publicIcons, "maskable-192.png"), size: 192, scale: 0.62, background: BG, ink: INK, dot: PROOF },
  { file: join(publicIcons, "maskable-512.png"), size: 512, scale: 0.62, background: BG, ink: INK, dot: PROOF },
  { file: join(publicIcons, "badge-96.png"), size: 96, scale: 0.95, background: null, ink: "#ffffff", dot: "#ffffff" },
  { file: join(appSegment, "apple-icon.png"), size: 180, scale: 0.72, background: BG, ink: INK, dot: PROOF },
];

const main = async (): Promise<void> => {
  mkdirSync(publicIcons, { recursive: true });
  for (const spec of ICONS) {
    const info = await sharp(Buffer.from(svg(spec))).png({ compressionLevel: 9 }).toFile(spec.file);
    process.stdout.write(`${spec.file.slice(join(here, "..").length + 1)} ${info.width}x${info.height} ${Math.round(info.size / 102.4) / 10} KB\n`);
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`pwa-icons : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
