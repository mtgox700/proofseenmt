import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { operatorOf, operatorOnly } from "../src/lib/operator-access";
import type { Person, SessionState } from "../src/lib/session";

/*
 * Red team of the back office (C19): anyone who is not a signed-in operator gets the 404 of an unknown page, on every
 * page, every server action and every route handler. The rule itself is tested on every kind of visitor; then every
 * file of the area is read to prove it goes through the rule before anything else.
 */

const here = dirname(fileURLToPath(import.meta.url));
const AREA = join(here, "../src/app/[lang]/app/operateur");

const person = (role: Person["role"]): Person => ({ id: "user_1", name: "Camille", email: "camille@example.org", role });
const signedIn = (role: Person["role"]): SessionState => ({ kind: "signed-in", person: person(role) });

const digestOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "no digest";
  }
  return "no error";
};

const VISITORS: readonly [string, SessionState][] = [
  ["a server without sign-in", { kind: "unconfigured" }],
  ["a signed-out visitor", { kind: "signed-out" }],
  ["a person who has not chosen a side", signedIn(null)],
  ["a freelancer", signedIn("freelance")],
  ["a company member", signedIn("company")],
];

describe("operator gate", () => {
  for (const [who, state] of VISITORS) {
    it(`answers 404 to ${who}`, () => {
      expect(digestOf(() => operatorOnly(state))).toMatch(/404/);
      expect(operatorOf(state)).toBeNull();
    });
  }

  it("lets a signed-in operator through", () => {
    expect(operatorOnly(signedIn("operator")).role).toBe("operator");
    expect(operatorOf(signedIn("operator"))?.email).toBe("camille@example.org");
  });
});

const filesOf = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });

const FILES = filesOf(AREA);
const source = (path: string): string => readFileSync(path, "utf8");
const name = (path: string): string => relative(AREA, path).replaceAll("\\", "/");

/** The body of each exported async function of a server-action file, by name. */
const exportedActions = (text: string): [string, string][] => {
  const heads = [...text.matchAll(/export async function (\w+)\(/g)];
  return heads.map((head, i) => [head[1] ?? "?", text.slice(head.index, heads[i + 1]?.index ?? text.length)]);
};

describe("every back-office entry point goes through the gate", () => {
  it("finds the area and its entry points", () => {
    expect(FILES.filter((f) => f.endsWith("page.tsx")).length).toBeGreaterThanOrEqual(9);
    expect(FILES.filter((f) => /-actions\.ts$/.test(f)).length).toBeGreaterThanOrEqual(5);
  });

  it("the layout checks the role before drawing anything", () => {
    const layout = source(join(AREA, "layout.tsx"));
    expect(layout).toMatch(/operatorOnly\(await session\(\)\)/);
  });

  for (const path of FILES.filter((f) => f.endsWith("page.tsx"))) {
    it(`page ${name(path)} opens only for an operator`, () => {
      const text = source(path);
      const gate = text.indexOf("await operatorPage()");
      expect(gate).toBeGreaterThan(-1);
      // No data is read before the gate.
      const firstRead = text.search(/\((context|market)\.db/);
      expect(firstRead === -1 || firstRead > gate).toBe(true);
      expect(text).not.toMatch(/pageMarket|actionMarket/);
    });
  }

  for (const path of FILES.filter((f) => /-actions\.ts$/.test(f))) {
    const text = source(path);
    for (const [fn, body] of exportedActions(text)) {
      it(`action ${name(path)}#${fn} opens only for an operator, and is throttled`, () => {
        expect(text.startsWith('"use server";')).toBe(true);
        const viaHelper = /\brun\(formData/.test(body) && /const run = async[\s\S]*?operatorAction\(/.test(text);
        expect(body.includes("operatorAction(") || viaHelper).toBe(true);
        // operatorAction throttles; each action must stop when it says so.
        expect(text).toMatch(/limited/);
      });
    }
  }

  it("searches companies through a server action, never a GET form whose words would land in the address (wave-3 review, L14)", () => {
    const page = source(join(AREA, "verifications/page.tsx"));
    expect(page).not.toMatch(/method="get"/);
    expect(page).not.toMatch(/\bq\?: string/);
    expect(exportedActions(source(join(AREA, "verification-actions.ts"))).map(([fn]) => fn)).toContain("searchCompanies");
  });

  for (const path of FILES.filter((f) => f.endsWith("route.ts"))) {
    it(`route ${name(path)} answers 404 to anyone but an operator`, () => {
      const text = source(path);
      expect(text).toMatch(/operatorOf\(await session\(\)\)/);
      expect(text).toMatch(/throttled\(/);
      expect(text).toMatch(/export function GET\(\): Response \{\s*return notFound\(\);/);
    });
  }
});
