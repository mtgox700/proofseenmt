import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Lot 1 of the connected redesign, the styles of the frame: workspace.css is served by the connected space and the
 * two pages of a signed link only; it holds no block that no page uses; the bar holds on two lines and the menu on one
 * line that scrolls, on a phone; every field a person writes in has the brand's control; a long tag wraps.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(web, "src");
const app = join(src, "app", "[lang]");
const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");
const css = (file: string): string => read(src, "styles", file).replace(/\/\*[\s\S]*?\*\//g, "");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const rel = (path: string): string => relative(app, path).replace(/\\/g, "/");
const code = filesUnder(src).filter((f) => /\.tsx?$/.test(f));

/** The body of the first rule whose selector list is exactly `selector`, at any depth. */
const ruleOf = (sheet: string, selector: string): string => {
  const at = sheet.search(new RegExp(`(?:^|[}\\n])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`));
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const open = sheet.indexOf("{", at);
  return sheet.slice(open + 1, sheet.indexOf("}", open));
};

describe("the frame of the connected space is not served to the public pages", () => {
  it("leaves workspace.css out of the layout every page shares", () => {
    expect(read(app, "layout.tsx")).not.toContain("workspace.css");
  });

  it("serves it to the connected space and to the two pages of a signed link, and nowhere else", () => {
    const importers = filesUnder(app)
      .filter((f) => f.endsWith(".tsx") && read(f).includes('import "@/styles/workspace.css";'))
      .map(rel)
      .sort();
    expect(importers).toEqual(["app/layout.tsx", "confirmer-mission/[id]/page.tsx", "espace/[reference]/page.tsx"]);
    expect(code.filter((f) => !f.startsWith(app) && read(f).includes("workspace.css")).map((f) => relative(src, f))).toEqual([]);
  });

  it("gives sign-in its own small sheet, so that the sign-in pages stay light too", () => {
    const importers = filesUnder(app)
      .filter((f) => f.endsWith(".tsx") && read(f).includes('import "@/styles/auth.css";'))
      .map(rel)
      .sort();
    expect(importers).toEqual(["app/layout.tsx", "connexion/[[...rest]]/page.tsx", "creer-un-compte/[[...rest]]/page.tsx"]);
  });

  it("keeps no block that no page uses: every class of workspace.css is written by the code", () => {
    // Every string literal of the application, split into words: a class is used when one of them names it.
    const words = new Set(code.flatMap((f) => [...read(f).matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].flatMap((m) => (m[1] ?? m[2] ?? m[3] ?? "").split(/[\s{}$]+/))));
    const classes = [...new Set([...css("workspace.css").replace(/\{[^{}]*\}/g, "{}").matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1] ?? ""))];
    expect(classes.length).toBeGreaterThan(50);
    expect(classes.filter((c) => !words.has(c))).toEqual([]);
  });
});

describe("the bar and the menu on a phone", () => {
  const sheet = css("workspace.css");

  it("sets the bar on two lines below 64rem, and on one from 64rem", () => {
    expect(ruleOf(sheet, ".app-top")).toMatch(/grid-template-areas:\s*"brand role"\s*"tools tools"/);
    expect(ruleOf(sheet, ".app-tools")).toMatch(/flex-wrap:\s*wrap/);
    expect(sheet).toMatch(/@media \(min-width: 64rem\) \{\s*\.app-top \{[^}]*grid-template-areas:\s*"brand role tools"/);
  });

  it("keeps each menu on one line that scrolls, its right edge fading, and drops the fade once it fits", () => {
    const line = ruleOf(sheet, ".ws-nav ul, .ws-tabs ul");
    expect(line).toMatch(/display:\s*flex/);
    expect(line).not.toMatch(/flex-wrap/);
    expect(line).toMatch(/overflow-x:\s*auto/);
    expect(line).toMatch(/mask-image:\s*linear-gradient\(to right/);
    expect(ruleOf(sheet, ".ws-nav a")).toMatch(/white-space:\s*nowrap/);
    expect(sheet).toMatch(/@media \(min-width: 64rem\) \{[^@]*\.ws-nav ul \{[^}]*mask-image:\s*none/);
  });

  it("keeps every link of the frame at 44 px at least", () => {
    for (const selector of [".ws-nav a", ".ws-tabs a"]) expect(ruleOf(sheet, selector), selector).toMatch(/min-height:\s*2\.75rem/);
    expect(ruleOf(css("market.css"), ".app-bell")).toMatch(/min-height:\s*2\.75rem/);
  });

  it("titles a page at step 4, the step of a page title", () => {
    expect(ruleOf(sheet, ".app-head h1")).toMatch(/font-size:\s*var\(--ps-step-4\)/);
    expect(ruleOf(sheet, ".space-head h1")).toMatch(/font-size:\s*var\(--ps-step-4\)/);
  });

  it("names the client's path apart from the grid of the hub's profile page", () => {
    expect(sheet).not.toMatch(/\.dossier\b/);
    expect(read(src, "components", "workspace", "DossierPath.tsx")).toContain('className="audit-path"');
  });
});

describe("fields and tags", () => {
  it("draws every control a person writes in with one rule, whatever its type", () => {
    const fieldRule = /\.field :is\(([^)]*(?:\([^)]*\)[^)]*)*)\), \.field select, \.field textarea \{/.exec(css("market.css"));
    expect(fieldRule).not.toBeNull();
    const covered = fieldRule?.[1] ?? "";
    expect(covered).toContain("input:not([type])");
    const NOT_TEXT = new Set(["hidden", "checkbox", "radio", "file", "submit", "button", "range", "color", "image", "reset"]);
    const used = new Set(code.flatMap((f) => [...read(f).matchAll(/<input\b[^>]*?\btype="([a-z-]+)"/g)].map((m) => m[1] ?? "")));
    for (const type of [...used].filter((t) => !NOT_TEXT.has(t))) expect(covered, type).toContain(`input[type="${type}"]`);
    for (const type of ["url", "month", "tel"]) expect(covered).toContain(`input[type="${type}"]`);
    expect(css("workspace.css")).not.toMatch(/\.field input\[type=/);
  });

  it("lets a tag wrap instead of pushing the screen wider", () => {
    const tag = ruleOf(css("base.css"), ".tag");
    expect(tag).not.toMatch(/white-space:\s*nowrap/);
    expect(tag).toMatch(/max-width:\s*100%/);
  });
});
