import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Rasterises the brand SVGs written by build_brand.py and packs the favicon ICO. sharp is a dependency of apps/web,
 * resolved from there so this package stays dependency-free.
 *   pnpm exec tsx packages/brand/scripts/render.ts <jobs.json>
 */

interface RasterJob {
  readonly svg: string;
  readonly png: string;
  readonly width: number;
  readonly height?: number;
  /** Width of the SVG viewBox, to pick a density that renders at `supersample` times the target size. */
  readonly viewWidth?: number;
  readonly supersample?: number;
  readonly flatten?: string;
}

interface IcoJob {
  readonly ico: string;
  readonly pngs: readonly string[];
}

type Job = RasterJob | IcoJob;

type SharpFactory = (input: Buffer, options: { density: number }) => {
  resize: (w: number, h: number, o: { kernel: string; fit: string }) => SharpChain;
};
interface SharpChain {
  flatten: (o: { background: string }) => SharpChain;
  png: (o: { compressionLevel: number }) => SharpChain;
  toFile: (path: string) => Promise<unknown>;
}

const here = dirname(fileURLToPath(import.meta.url));
const requireFromWeb = createRequire(join(here, "..", "..", "..", "apps", "web", "package.json"));
const sharp = requireFromWeb("sharp") as SharpFactory;

/** ICO whose entries are PNG payloads: read by every browser that still asks for /favicon.ico. */
const packIco = (pngs: readonly string[]): Buffer => {
  const images = pngs.map((file) => {
    const data = readFileSync(file);
    return { data, width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ data, width, height }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
};

const raster = async (job: RasterJob): Promise<void> => {
  // Render at `supersample` times the size, then a Lanczos reduction: cleaner edges at 16 px than librsvg alone.
  const density = Math.max(72, Math.min(2400, Math.round((72 * job.width * (job.supersample ?? 1)) / (job.viewWidth ?? job.width))));
  let chain = sharp(readFileSync(job.svg), { density }).resize(job.width, job.height ?? job.width, { kernel: "lanczos3", fit: "fill" });
  if (job.flatten) chain = chain.flatten({ background: job.flatten });
  await chain.png({ compressionLevel: 9 }).toFile(job.png);
};

const jobsFile = process.argv[2];
if (!jobsFile) throw new Error("usage: tsx render.ts <jobs.json>");
const jobs = JSON.parse(readFileSync(jobsFile, "utf8")) as Job[];
for (const job of jobs) {
  if ("ico" in job) writeFileSync(job.ico, packIco(job.pngs));
  else await raster(job);
}
console.log(`${jobs.length} files written`);
