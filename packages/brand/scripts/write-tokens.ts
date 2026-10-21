import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderChromeCss } from "../src/chrome";
import { renderTokensCss } from "../src/tokens";

/*
 * Writes packages/brand/tokens.css and chrome.css from src/: `pnpm exec tsx packages/brand/scripts/write-tokens.ts`.
 * test/tokens.test.ts fails if a committed file differs from what the sources render.
 */
const here = dirname(fileURLToPath(import.meta.url));
for (const [name, css] of [["tokens.css", renderTokensCss()], ["chrome.css", renderChromeCss()]] as const) {
  const target = join(here, "..", name);
  writeFileSync(target, css);
  console.log(`wrote ${target}`);
}
