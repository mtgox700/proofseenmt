import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Pre-encodes the product screenshots (shots-src/*.png, captured from the running app) to WebP at two widths, into
 * public/shots. Done once, offline: the on-demand image optimiser took 5.6 s per image on first request here, and a
 * static host would not run it at all. sharp is resolved from Next's own dependency tree rather than added twice.
 */

interface Sharp {
  (input: string): { resize(options: { width: number }): { webp(options: { quality: number }): { toFile(path: string): Promise<{ size: number }> } } };
}

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next/package.json")] })) as Sharp;

const source = join(here, "..", "shots-src");
const target = join(here, "..", "public", "shots");
const WIDTHS = [960, 1440];

const main = async (): Promise<void> => {
  for (const file of readdirSync(source).filter((name) => name.endsWith(".png"))) {
    for (const width of WIDTHS) {
      const out = join(target, file.replace(/\.png$/, `-${width}.webp`));
      const info = await sharp(join(source, file)).resize({ width }).webp({ quality: 82 }).toFile(out);
      process.stdout.write(`${file.replace(/\.png$/, `-${width}.webp`)} ${Math.round(info.size / 1024)} KB\n`);
    }
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`optimize-shots : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
