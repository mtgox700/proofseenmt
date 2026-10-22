import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { frenchSpacing } from "@proofseen/hub";
import { dictionary } from "../src/i18n";
import { marketDictionary } from "../src/i18n/market";

/*
 * Kensa N6 : la vitrine React gardait des espaces ordinaires avant « : ; ? ! » quand toutes les pages du hub étaient
 * passées en espace fine insécable (U+202F). Les chaînes françaises portent maintenant l'espace fine elles-mêmes :
 * aucun coût au rendu, aucune ligne qui commence par un deux-points, et la même règle que `frenchSpacing` du hub.
 * Le test lit les littéraux (chaînes et gabarits, y compris ceux des fonctions) avec l'analyseur de TypeScript : le
 * code (`a ? b : c`), les commentaires, les adresses et les heures (« 09:00 ») ne sont pas concernés.
 */

const i18n = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const FRENCH_FILES = [
  join(i18n, "fr.ts"),
  join(i18n, "states.ts"),
  join(i18n, "market", "fr.ts"),
  ...readdirSync(join(i18n, "market"))
    .filter((name) => name.endsWith("-fr.ts"))
    .map((name) => join(i18n, "market", name)),
];

const SPACES = `[ ${String.fromCharCode(0xa0)}]`;
const LOOSE = new RegExp(`${SPACES}[:;?!»]|«${SPACES}`);

const LITERALS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

/** Les littéraux du code dont le texte (échappements résolus) a une espace ordinaire avant une ponctuation double. */
const looseLiterals = (name: string, code: string): string[] => {
  const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (LITERALS.has(node.kind)) {
      const text = (node as ts.LiteralLikeNode).text;
      if (LOOSE.test(text)) found.push(`${name}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${JSON.stringify(text)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

const strings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
};

describe("typographie française de la vitrine et de l'espace connecté (Kensa N6)", () => {
  it.each(FRENCH_FILES.map((path) => [path.slice(i18n.length + 1).replace(/\\/g, "/"), path]))(
    "%s : une espace fine insécable avant « : ; ? ! » et dans les guillemets, jamais une espace ordinaire",
    (name, path) => {
      expect(looseLiterals(name, readFileSync(path, "utf8"))).toEqual([]);
    },
  );

  it("dit la même chose que la typographie du hub : `frenchSpacing` ne change plus aucune chaîne française", () => {
    for (const text of [...strings(dictionary("fr")), ...strings(marketDictionary("fr"))]) expect(frenchSpacing(text)).toBe(text);
  });

  it("ne touche ni au code, ni aux commentaires, ni aux heures, et voit les gabarits", () => {
    const code = [
      "// commentaire : ignoré",
      "const pick = (n: number) => (n > 1 ? `${n} heures` : \"09:00\");",
      "const a = \"Preuve : client\";",
      "const b = (x: string) => `Motif ${x} !`;",
      "const c = \"« citation »\";",
    ].join(String.fromCharCode(10));
    expect(looseLiterals("t.ts", code).map((line) => line.split(" ")[0])).toEqual(["t.ts:3", "t.ts:4", "t.ts:5"]);
  });
});
