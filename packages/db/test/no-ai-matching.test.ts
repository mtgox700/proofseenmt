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
const MODEL_CALL =
  /\bfetch\s*\(|\bnew\s+(?:OpenAI|Anthropic|Mistral)\b|\.messages\.create\b|\bcompletions?\b|\bembeddings?\b|\baxios\b|\bgot\s*\(|\bundici\b|\bnode:(?:https?|net|tls)\b|\bXMLHttpRequest\b|\bWebSocket\b/;
/** Une importation dont le nom est calculé : on ne sait pas ce qu'elle charge, elle est refusée. */
const COMPUTED_IMPORT = /\b(?:import|require)\s*\(\s*[^"'\s)]/;

/**
 * Les importations de valeurs d'un source (les `import type` n'emportent aucun code) : statiques, sans liaison
 * (`import "x"`), dynamiques (`import("x")`) et `require("x")` (relecture sécurité C22, matching B2).
 */
const valueImports = (source: string): readonly string[] => [
  ...[...source.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gms)].map((m) => m[1] ?? ""),
  ...[...source.matchAll(/^import\s+["']([^"']+)["']/gm)].map((m) => m[1] ?? ""),
  ...[...source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? ""),
];

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

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Le source appelle le réseau ou un modèle, ou charge un module dont le nom est calculé. */
const callsOut = (source: string): boolean => {
  const code = withoutComments(source);
  return MODEL_CALL.test(code) || COMPUTED_IMPORT.test(code);
};

/**
 * Les fichiers qui montrent le rapprochement hors de packages/db : ils importent légitimement d'autres paquets
 * Proofseen, mais jamais packages/engines ni un SDK d'IA, et n'appellent ni le réseau ni un modèle.
 */
const SHOWN_IN = ["../../../apps/web/src/lib/matching.ts", "../../../apps/web/src/data/nearby.ts", "../../hub/src/nearby.ts"].map((f) => resolve(here, f));
const AI_PACKAGE = /engines|openai|anthropic|ai-sdk|^ai$|langchain|mistral|perplexity|ollama|transformers/i;

const offending = (c: Closure): readonly string[] => [
  ...[...c.packages].filter((p) => !ALLOWED_PACKAGES.has(p)),
  ...c.outside,
  ...[...c.files].filter(([, source]) => callsOut(source)).map(([file]) => file),
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

  it("échoue sur une importation dynamique, sans liaison ou calculée, et sur un autre client réseau", () => {
    const withLine = (line: string) => (file: string): string => (file.endsWith("matching.ts") ? `${fromDisk(file)}
${line}` : fromDisk(file));
    expect(offending(closure(withLine('const e = await import("@proofseen/engines");')))).toContain("@proofseen/engines");
    expect(offending(closure(withLine('import "openai/shims/node";')))).toContain("openai/shims/node");
    expect(offending(closure(withLine('const m = require("@anthropic-ai/sdk");')))).toContain("@anthropic-ai/sdk");
    for (const line of ["const n = await import(name);", 'await axios.post("https://x");', "const r = got(url);"]) {
      expect(offending(closure(withLine(line))).some((f) => f.endsWith("matching.ts"))).toBe(true);
    }
  });

  it("les fichiers qui affichent le rapprochement n'atteignent ni un modèle d'IA ni le réseau", () => {
    for (const file of SHOWN_IN) {
      const source = fromDisk(file);
      expect(valueImports(source).filter((spec) => AI_PACKAGE.test(spec)), file).toEqual([]);
      expect(callsOut(source), file).toBe(false);
    }
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
