import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Lot 4 of the connected space, its sheet: loaded by the pages of the deal only, no green of its own (the cartouche and
 * its square come from @proofseen/brand/seal.css), targets of 44 px, and the test note out of the frame of a success.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");
const sheet = read(src, "styles", "app-affaire.css").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(sheet)?.[1] ?? "";
};

describe("the sheet of the deal", () => {
  it("is loaded by the pages of the deal and by nothing else", () => {
    const importers = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && read(f).includes('import "@/styles/app-affaire.css";'))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    // L1: the vault's pages are pages of the deal (its documents tab, the form that prepares a version, a document and
    // the comparison of two versions).
    expect(importers).toEqual(["app/[lang]/app/contrats/[id]/documents/page.tsx", "app/[lang]/app/contrats/[id]/documents/preparer/page.tsx", "app/[lang]/app/contrats/[id]/page.tsx", "app/[lang]/app/documents/[documentId]/comparer/page.tsx", "app/[lang]/app/documents/[documentId]/page.tsx", "app/[lang]/app/facturation/page.tsx", "app/[lang]/app/factures/page.tsx", "app/[lang]/app/messages/[id]/page.tsx"]);
  });

  it("writes no green: only the seal of the brand may", () => {
    expect(sheet).not.toMatch(/--ps-proof/);
  });

  it("gives every link of the thread and every way back a target of 44 px", () => {
    expect(rule(".deal-link")).toMatch(/min-height:\s*44px/);
    expect(rule(".back-link")).toMatch(/min-height:\s*44px/);
    expect(rule(".invoice-link")).toMatch(/min-height:\s*44px/);
  });

  it("lets every line of the thread wrap at 375 px: no fixed width, the state under the label on a phone", () => {
    expect(rule(".deal-step")).toMatch(/grid-template-columns:\s*1rem minmax\(0, 1fr\) auto/);
    expect(sheet).toMatch(/@media \(max-width: 40rem\) \{\s*\.deal-step \{ grid-template-columns: 1rem minmax\(0, 1fr\); \}/);
    expect(sheet).not.toMatch(/white-space:\s*nowrap/);
  });

  it("puts the test-mode note in a dashed frame of its own, never the frame of a success", () => {
    for (const file of ["components/market/EscrowPayment.tsx", "app/[lang]/app/facturation/page.tsx"]) {
      const code = read(src, file);
      expect(code, file).toContain('className="test-note" role="note"');
      expect(code, file).not.toContain('className="form-ok" role="note"');
    }
    expect(rule(".test-note")).toMatch(/border:\s*1px dashed var\(--ps-line-strong\)/);
  });
});
