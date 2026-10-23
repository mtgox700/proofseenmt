import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEEP, MAX_STRIKES, planRegister, rememberIds, SEEN_KEY, strikeRegister, visitedMark } from "../src/components/proof/StrikeOnce";

/*
 * The one island of the strike (CONNECTED_PLAN §2.4, Shogun's answer 5 on lot 2): a register strikes nothing on its
 * first visit on a device, it only remembers what is already known; afterwards only a fact that appeared since the last
 * visit strikes, three at most. The acknowledgement of a fresh decision (lot 3) shares the same memory and the same file.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe("the plan of a register", () => {
  it("strikes nothing on the first visit, and remembers every fact already known", () => {
    const plan = planRegister("verifie", ["m:1", "u:2"], []);
    expect(plan.strike).toEqual([]);
    expect(plan.remember).toEqual([visitedMark("verifie"), "m:1", "u:2"]);
  });

  it("then strikes only what appeared since the last visit, three at most, in the order of the page", () => {
    const seen = [visitedMark("verifie"), "m:1"];
    expect(planRegister("verifie", ["m:9", "m:1", "u:3"], seen).strike).toEqual(["m:9", "u:3"]);
    expect(planRegister("verifie", ["a", "b", "c", "d", "e"], [visitedMark("verifie")]).strike).toHaveLength(MAX_STRIKES);
    expect(planRegister("verifie", ["m:1"], seen).strike).toEqual([]);
  });

  it("does not take an acknowledgement seen on the device for a visit of the register", () => {
    expect(planRegister("verifie", ["m:1"], ["c:acknowledged"]).strike).toEqual([]);
  });

  it("remembers without repeats, and keeps a bounded list", () => {
    expect(rememberIds(["m:1", "u:2"], ["m:1", "m:0"])).toEqual(["m:1", "m:0", "u:2"]);
    const kept = rememberIds(
      Array.from({ length: 250 }, (_, i) => `m:${i}`),
      [],
    );
    expect(kept).toHaveLength(KEEP);
    expect(kept.at(-1)).toBe("m:249");
  });
});

/** A page of seals in a register, and a device: the island runs on them as it would in the browser. */
const device = (ids: readonly string[], stored: string | null, reduce = false) => {
  const store = new Map<string, string>(stored === null ? [] : [[SEEN_KEY, stored]]);
  const struck: string[] = [];
  const marks = ids.map((id) => ({
    dataset: { sealId: id },
    querySelector: () => ({ setAttribute: (name: string) => (name === "data-strike" ? struck.push(id) : undefined) }),
  }));
  vi.stubGlobal("document", { getElementById: (scope: string) => (scope === "verifie" ? { querySelectorAll: () => marks } : null) });
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    matchMedia: () => ({ matches: reduce }),
  });
  return { struck, saved: (): string[] => JSON.parse(store.get(SEEN_KEY) ?? "[]") as string[] };
};

afterEach(() => vi.unstubAllGlobals());

describe("the island on a register", () => {
  it("first visit on a device: nothing strikes, every fact on the page is recorded as seen", () => {
    const d = device(["m:1", "m:2", "u:3"], null);
    strikeRegister("verifie");
    expect(d.struck).toEqual([]);
    expect(d.saved()).toEqual([visitedMark("verifie"), "m:1", "m:2", "u:3"]);
  });

  it("next visit: only the fact verified since strikes", () => {
    const d = device(["m:4", "m:1", "m:2", "u:3"], JSON.stringify([visitedMark("verifie"), "m:1", "m:2", "u:3"]));
    strikeRegister("verifie");
    expect(d.struck).toEqual(["m:4"]);
    // A reload strikes nothing more.
    const again = device(["m:4", "m:1", "m:2", "u:3"], JSON.stringify(d.saved()));
    strikeRegister("verifie");
    expect(again.struck).toEqual([]);
  });

  it("under reduced motion, remembers and strikes nothing; without storage, strikes nothing", () => {
    const quiet = device(["m:4"], JSON.stringify([visitedMark("verifie")]), true);
    strikeRegister("verifie");
    expect(quiet.struck).toEqual([]);
    expect(quiet.saved()).toContain("m:4");
    const broken = device(["m:4"], "{not json");
    strikeRegister("verifie");
    expect(broken.struck).toEqual([]);
  });
});

describe("one island for the whole connected space", () => {
  it("is the only file that sets a strike, local and silent", () => {
    const setters = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && /setAttribute\("data-strike"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f).replace(/\\/g, "/"));
    expect(setters).toEqual(["components/proof/StrikeOnce.tsx"]);
    const source = readFileSync(join(src, "components", "proof", "StrikeOnce.tsx"), "utf8");
    expect(source.split("\n")[0]).toBe('"use client";');
    expect(source).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest|document\.cookie|sessionStorage/);
  });
});
