import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/canonical";
import { brandFontsDir, configureFonts } from "../src/pdf-fonts";

describe("brand fonts for the PDF (packages/brand/pdf-fonts)", () => {
  it("are found next to the package in the workspace, which is the folder the export of the brand package names", () => {
    const dir = brandFontsDir();
    expect(dir.split("\\").join("/")).toMatch(/packages\/brand\/pdf-fonts$/);
    // La résolution par l'export (`@proofseen/brand/pdf-fonts/*`) donne le même dossier : on le vérifie ici, hors bundler.
    const exported = dirname(createRequire(import.meta.url).resolve("@proofseen/brand/pdf-fonts/manifest.json"));
    expect(realpathSync(dir)).toBe(realpathSync(exported));
    // Et le code de production ne passe pas par `require.resolve`, que webpack remplace par un numéro de module : le rendu
    // dans le serveur Next échouait (« The "path" argument must be of type string. Received type number », L1-074).
    expect(readFileSync(new URL("../src/pdf-fonts.ts", import.meta.url), "utf8")).not.toMatch(/createRequire|require\.resolve/);
    for (const file of ["ps-text-400.ttf", "ps-text-700.ttf", "ps-display-600.ttf", "ps-display-700.ttf", "ps-mono-500.ttf"]) expect(existsSync(join(dir, file)), file).toBe(true);
  });

  it("match their manifest byte for byte (the check Sumi wrote, run by the test suite)", () => {
    const output = execFileSync(process.execPath, [join(brandFontsDir(), "verify.mjs")], { encoding: "utf8" });
    expect(output.length).toBeGreaterThan(0);
  });

  it("have the SHA-256 the manifest announces, so a changed font cannot slip into a contract", () => {
    const manifest = JSON.parse(readFileSync(join(brandFontsDir(), "manifest.json"), "utf8")) as { fonts: { file: string; sha256: string }[] };
    expect(manifest.fonts.length).toBeGreaterThanOrEqual(6);
    for (const font of manifest.fonts) expect(sha256Hex(readFileSync(join(brandFontsDir(), font.file))), font.file).toBe(font.sha256);
  });

  it("configure pdfmake idempotently", () => {
    expect(() => configureFonts()).not.toThrow();
    expect(() => configureFonts()).not.toThrow();
  });
});
