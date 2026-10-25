import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * L1-159, B1: an escape eaten by a tool leaves its digits in the text a person reads: « prestation202f: » for
 * « prestation » then the narrow no-break space then « : ». Every dictionary of the site is read as source: a code point of a space appears only as an
 * escape (backslash u202f, backslash u00a0) or a call (fromCharCode(0x202f)), never as four bare digits glued to a word.
 */

const i18n = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : /\.ts$/.test(name) ? [join(dir, name)] : []));
const EATEN = /(?<!\\u|0x)(?:202f|00a0)/i;

describe("no eaten escape in a dictionary (B1)", () => {
  it.each(files(i18n).map((file) => [relative(i18n, file).replace(/\\/g, "/"), file]))("%s", (_, file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    const bad = lines.map((line, index) => ({ line: index + 1, text: line })).filter(({ text }) => EATEN.test(text));
    expect(bad).toEqual([]);
  });
});
