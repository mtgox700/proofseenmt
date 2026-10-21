import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "../src/tokens";

/* Writes packages/brand/tokens.css from src/tokens.ts: `pnpm exec tsx packages/brand/scripts/write-tokens.ts`. */
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "tokens.css");
writeFileSync(target, renderTokensCss());
console.log(`wrote ${target}`);
