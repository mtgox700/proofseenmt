import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256Hex } from "./canonical";
import { TemplateLoadError } from "./errors";
import type { Lang } from "./format";
import { lintTemplate } from "./lint";
import {
  LanguageSchema,
  SourcesFileSchema,
  TemplateSchema,
  type LanguageText,
  type SourceEntry,
  type TemplateDecl,
} from "./schema";
import { parseYaml } from "./yaml";

/*
 * Le registre des gabarits : lit les fichiers YAML d'un dossier, les valide (zod strict, puis cohérence entre fichiers),
 * calcule l'empreinte du contenu de chaque gabarit. Rien n'est rendu ici. Un gabarit qui ne passe pas ne se charge pas.
 *
 * Disposition : `<id>/template.yaml` (+ `fr.yaml`, `en.yaml`) pour la version courante ; une version plus ancienne, qui ne
 * change plus, reste dans `<id>/v<n>/`. `sources.yaml` à la racine.
 */

/*
 * Un chemin ordinaire, pas le constructeur d'URL relative à `import.meta.url` : webpack prend cette forme pour une
 * ressource à empaqueter et refuse un dossier. `import.meta.url` seul reste le fichier source, que l'image de production contient.
 */
export const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

export interface LoadedTemplate {
  readonly decl: TemplateDecl;
  readonly texts: Readonly<Partial<Record<Lang, LanguageText>>>;
  /** SHA-256 du contenu (structure et textes, sans l'attestation de relecture) : change dès qu'un mot change. */
  readonly digest: string;
}

export interface TemplateRegistry {
  readonly sources: Readonly<Record<string, SourceEntry>>;
  find(id: string, version: number): LoadedTemplate | undefined;
  /** La version la plus récente qui n'est pas retirée : celle que l'application rend aujourd'hui. */
  latest(id: string): LoadedTemplate | undefined;
  all(): readonly LoadedTemplate[];
}

const issuesOf = (error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] }): string[] =>
  error.issues.map((issue) => `${issue.path.map(String).join(".") || "(racine)"}: ${issue.message}`);

const readYaml = (file: string): unknown => parseYaml(readFileSync(file, "utf8"), file);

const loadSources = (root: string): Readonly<Record<string, SourceEntry>> => {
  const file = join(root, "sources.yaml");
  const parsed = SourcesFileSchema.safeParse(readYaml(file));
  if (!parsed.success) throw new TemplateLoadError(file, issuesOf(parsed.error));
  return parsed.data.sources;
};

/** Empreinte du contenu : la relecture (qui l'atteste, quand) n'en fait pas partie, sinon l'attester la ferait tomber. */
const contentDigest = (decl: TemplateDecl, texts: Readonly<Partial<Record<Lang, LanguageText>>>): string => {
  const structure = Object.fromEntries(Object.entries(decl).filter(([key]) => key !== "review"));
  return sha256Hex(canonicalJson({ structure, texts }));
};

const loadOne = (dir: string, folder: string, sources: Readonly<Record<string, SourceEntry>>): LoadedTemplate => {
  const file = join(dir, "template.yaml");
  const parsed = TemplateSchema.safeParse(readYaml(file));
  if (!parsed.success) throw new TemplateLoadError(file, issuesOf(parsed.error));
  const decl = parsed.data;
  const entries = decl.languages.map((lang): [Lang, LanguageText] => {
    const langFile = join(dir, `${lang}.yaml`);
    if (!existsSync(langFile)) throw new TemplateLoadError(dir, [`language_missing: ${lang}.yaml est déclaré et absent`]);
    const text = LanguageSchema.safeParse(readYaml(langFile));
    if (!text.success) throw new TemplateLoadError(langFile, issuesOf(text.error));
    return [lang, text.data];
  });
  const texts = Object.fromEntries(entries) as Partial<Record<Lang, LanguageText>>;
  const problems = [...(decl.id === folder ? [] : [`id ${decl.id} differs from folder ${folder}`]), ...lintTemplate({ decl, texts, sources })];
  if (problems.length > 0) throw new TemplateLoadError(`${decl.id} v${decl.version}`, problems);
  return { decl, texts, digest: contentDigest(decl, texts) };
};

const versionDirs = (templateDir: string): readonly string[] => [
  ...(existsSync(join(templateDir, "template.yaml")) ? [templateDir] : []),
  ...readdirSync(templateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .map((entry) => join(templateDir, entry.name))
    .filter((dir) => existsSync(join(dir, "template.yaml"))),
];

export const loadRegistry = (root: string): TemplateRegistry => {
  const sources = loadSources(root);
  const loaded = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((entry) => versionDirs(join(root, entry.name)).map((dir) => loadOne(dir, entry.name, sources)));
  const keys = loaded.map((t) => `${t.decl.id}@${t.decl.version}`);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate !== undefined) throw new TemplateLoadError(root, [`version publiée deux fois : ${duplicate}`]);
  return {
    sources,
    find: (id, version) => loaded.find((t) => t.decl.id === id && t.decl.version === version),
    latest: (id) => [...loaded].filter((t) => t.decl.id === id && t.decl.status !== "retired").sort((a, b) => b.decl.version - a.decl.version)[0],
    all: () => loaded,
  };
};

let packaged: TemplateRegistry | undefined;

/** Les gabarits livrés avec le paquet, chargés une fois. */
export const defaultRegistry = (): TemplateRegistry => (packaged ??= loadRegistry(TEMPLATES_DIR));

/** Les variables dont la colonne n'existe pas encore (`source.kind: pending`) : le rendu les refuse tant qu'elles manquent. */
export const pendingVariables = (decl: TemplateDecl): readonly string[] =>
  Object.entries(decl.variables)
    .filter(([, variable]) => variable.source.kind === "pending")
    .map(([name]) => name);
