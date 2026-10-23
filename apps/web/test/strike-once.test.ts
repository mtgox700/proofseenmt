import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { freshIds, MAX_STRIKES, rememberIds } from "../src/components/proof/StrikeOnce";

/*
 * Lot 2 of the connected redesign (CONNECTED_PLAN §2.4): the island that strikes a newly verified fact once per device,
 * three at most per page, and remembers only the opaque ids the register writes.
 */

describe("the island of the strike", () => {
  it("strikes the facts this device has not seen, three at most, in the order of the page", () => {
    expect(freshIds(["m:1", "m:2", "u:3", "u:4"], ["m:2"])).toEqual(["m:1", "u:3", "u:4"]);
    expect(freshIds(["a", "b", "c", "d", "e"], [])).toHaveLength(MAX_STRIKES);
    expect(freshIds(["m:1"], ["m:1"])).toEqual([]);
  });

  it("remembers what it saw without repeats, and keeps a bounded list", () => {
    expect(rememberIds(["m:1", "u:2"], ["m:1", "m:0"])).toEqual(["m:1", "m:0", "u:2"]);
    const many = Array.from({ length: 250 }, (_, i) => `m:${i}`);
    const kept = rememberIds(many, []);
    expect(kept).toHaveLength(200);
    expect(kept.at(-1)).toBe("m:249");
  });

  it("keeps nothing personal: only the opaque ids the register writes", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "proof", "StrikeOnce.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest|document\.cookie/);
    expect(source.split("\n")[0]).toBe('"use client";');
  });
});
