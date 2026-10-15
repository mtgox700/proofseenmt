import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stopIfSuspended, suspendedPath } from "../src/lib/suspension";

/*
 * A suspended account (C19) cannot use the app spaces. The rule sends it to the suspension page; the market context
 * (every connected page and server action) and the connected API apply it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string): string => readFileSync(join(here, "../src", path), "utf8");

const digestOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "no digest";
  }
  return "no error";
};

describe("suspension", () => {
  it("sends a suspended account to the page that says so, in its language", () => {
    expect(digestOf(() => stopIfSuspended("fr", { at: new Date(), reason: "Annonces trompeuses" }))).toContain(`;${suspendedPath("fr")};`);
    expect(digestOf(() => stopIfSuspended("en", { at: new Date(), reason: "Misleading posts" }))).toContain(";/en/app/suspendu;");
  });

  it("lets an account in good standing through", () => {
    expect(digestOf(() => stopIfSuspended("fr", null))).toBe("no error");
  });

  it("is applied by the market context of every page and every server action", () => {
    const market = read("lib/market.ts");
    expect(market).toMatch(/stopIfSuspended\(lang, suspension\)/);
    expect(market.match(/await actorOf\(db, (person|state\.person), lang\)/g)).toHaveLength(2);
  });

  it("is applied by the connected API, except to the person's own GDPR export and erasure", () => {
    expect(read("lib/api.ts")).toMatch(/if \(suspension !== null && options\.allowSuspended !== true\) return \{ kind: "refused", response: fail\("compte suspendu"\) \}/);
    const allowed = [...read("app/api/me/route.ts").matchAll(/caller\(\{ allowSuspended: true \}\)/g)];
    expect(allowed).toHaveLength(2);
    expect(read("app/api/messages/stream/route.ts")).toMatch(/await caller\(\)/);
  });

  it("the suspension page never goes through the market context, which would send it back to itself", () => {
    expect(read("app/[lang]/app/suspendu/page.tsx")).not.toMatch(/pageMarket|actionMarket/);
  });
});
