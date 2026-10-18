import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Garde AI Act du rapprochement (décision du founder, 2026-10-18) : aucun modèle d'apprentissage ni LLM ne calcule un
 * score, un rang ou une note sur une personne. Le rapprochement est écrit à la main dans packages/db.
 *
 * Ce test suit toutes les importations de valeurs des modules de rapprochement, de fichier en fichier, et échoue si
 * l'une d'elles atteint packages/engines (les adaptateurs de LLM), un autre paquet Proofseen, un SDK d'IA, ou si l'un
 * de ces fichiers appelle le réseau. Il échoue aussi si un module de rapprochement parle de pourcentage.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src");
const ENTRIES = ["matching.ts", "matching-criteria.ts"];

/** Les seuls paquets extérieurs qu'un fichier atteint peut importer : zod et le client de base de données. */
const ALLOWED_PACKAGES = new Set(["zod", "@prisma/client", "@prisma/adapter-pg", "pg"]);
const MODEL_CALL = /\bfetch\s*\(|\bnew\s+(?:OpenAI|Anthropic|Mistral)\b|\.messages\.create\b|\bcompletions?\b|\bembeddings?\b/;

/** Les importations de valeurs d'un source (les `import type` n'emportent aucun code). */
const valueImports = (source: string): readonly string[] =>
  [...source.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gms)].map((m) => m[1] ?? "");

interface Closure {
  readonly files: ReadonlyMap<string, string>;
  readonly packages: ReadonlySet<string>;
  /** Fichiers importés hors de packages/db/src (un autre paquet atteint par chemin relatif). */
  readonly outside: ReadonlySet<string>;
}

const closure = (read: (file: string) => string): Closure => {
  const files = new Map<string, string>();
  const packages = new Set<string>();
  const outside = new Set<string>();
  const queue = ENTRIES.map((f) => join(SRC, f));
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (files.has(file)) continue;
    if (!file.startsWith(SRC)) {
      outside.add(file);
      continue;
    }
    const source = read(file);
    files.set(file, source);
    for (const spec of valueImports(source)) {
      if (!spec.startsWith(".")) packages.add(spec);
      // Le client Prisma généré n'est pas écrit par nous : il est couvert par la liste des paquets permis.
      else if (!spec.includes("/generated/")) queue.push(resolve(dirname(file), spec.endsWith(".ts") ? spec : `${spec}.ts`));
    }
  }
  return { files, packages, outside };
};

const fromDisk = (file: string): string => readFileSync(file, "utf8");

const offending = (c: Closure): readonly string[] => [
  ...[...c.packages].filter((p) => !ALLOWED_PACKAGES.has(p)),
  ...c.outside,
  ...[...c.files].filter(([, source]) => MODEL_CALL.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map(([file]) => file),
];

describe("rapprochement : aucun modèle d'IA", () => {
  it("suit bien les importations des modules de rapprochement", () => {
    const c = closure(fromDisk);
    expect([...c.files.keys()].map((f) => f.slice(SRC.length + 1).replace(/\\/g, "/"))).toEqual(expect.arrayContaining(["matching.ts", "matching-criteria.ts", "job-titles.ts", "search-text.ts"]));
    expect(c.packages.has("zod")).toBe(true);
  });

  it("n'atteint ni packages/engines, ni un autre paquet, ni un SDK d'IA, ni le réseau", () => {
    expect(offending(closure(fromDisk))).toEqual([]);
  });

  it("échoue si quelqu'un branche un adaptateur de LLM", () => {
    const tampered = (file: string): string =>
      file.endsWith("matching-criteria.ts") ? `import { complete } from "@proofseen/engines";\n${fromDisk(file)}` : fromDisk(file);
    expect(offending(closure(tampered))).toContain("@proofseen/engines");
    const relative = (file: string): string => (file.endsWith("matching.ts") ? `import { x } from "../../engines/src/index";\n${fromDisk(file)}` : fromDisk(file));
    expect(offending(closure(relative)).some((f) => f.split(sep).join("/").includes("/engines/"))).toBe(true);
    const calling = (file: string): string => (file.endsWith("matching.ts") ? `${fromDisk(file)}\nconst y = await fetch("https://api.example/v1/chat");` : fromDisk(file));
    expect(offending(closure(calling)).some((f) => f.endsWith("matching.ts"))).toBe(true);
  });

  it("le paquet de base de données ne dépend pas de packages/engines", () => {
    const manifest = JSON.parse(fromDisk(resolve(here, "../package.json"))) as { readonly dependencies?: Record<string, string>; readonly devDependencies?: Record<string, string> };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((d) => /engines|openai|anthropic|ai-sdk|langchain|mistral/i.test(d))).toEqual([]);
  });

  it("aucun pourcentage ni score dans le code du rapprochement", () => {
    for (const file of ENTRIES) {
      const code = fromDisk(join(SRC, file)).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code).not.toMatch(/percent|score|\branking\b|%/i);
    }
  });
});
