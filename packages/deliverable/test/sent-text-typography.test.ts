import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/*
 * Kensa N5 : les textes qu'un client ou un freelance reçoit hors du site (le rapport d'audit, les e-mails, les valeurs
 * que la base renvoie à l'interface) suivent la même typographie que le site : aucun tiret cadratin. Le test lit les
 * littéraux du code (chaînes, gabarits, texte JSX) avec l'analyseur de TypeScript, si bien qu'un commentaire peut
 * en contenir un sans faire échouer le test, et qu'une chaîne qui en porte un ne peut pas se cacher derrière `//`.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FOLDERS = ["packages/deliverable/src", "packages/notify/src", "packages/db/src"] as const;
const EM_DASH = String.fromCodePoint(0x2014);

const sourcesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourcesUnder(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });

const LITERALS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

/** Les littéraux d'un fichier qui contiennent `needle`, une fois les échappements résolus, avec leur ligne. */
const literalsContaining = (file: string, code: string, needle: string): string[] => {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (LITERALS.has(node.kind) && (node as ts.LiteralLikeNode).text.includes(needle)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push(`${file}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe("textes reçus hors du site : pas de tiret cadratin (Kensa N5)", () => {
  it.each(FOLDERS)("aucun littéral de %s n'en contient", (folder) => {
    const files = sourcesUnder(join(root, folder));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((path) => literalsContaining(relative(root, path).replace(/\\/g, "/"), readFileSync(path, "utf8"), EM_DASH));
    expect(offenders).toEqual([]);
  });

  it("voit un tiret cadratin dans une chaîne, un gabarit ou un échappement, et l'ignore dans un commentaire", () => {
    const code = [
      `// commentaire ${EM_DASH} ignoré`,
      `/* bloc ${EM_DASH} ignoré */`,
      `const a = "chaîne ${EM_DASH} vue";`,
      `const b = \`gabarit \${a} ${EM_DASH} vu\`;`,
      `const c = "${String.fromCharCode(92)}u2014";`,
    ].join(String.fromCharCode(10));
    expect(literalsContaining("t.ts", code, EM_DASH)).toEqual(["t.ts:3", "t.ts:4", "t.ts:5"]);
  });
});
