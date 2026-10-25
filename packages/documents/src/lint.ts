import { leavesOf } from "./conditions";
import type { Lang } from "./format";
import type { ClauseDecl, ClauseText, LanguageText, SourceEntry, TemplateDecl, VariableDecl } from "./schema";
import { placeholdersOf } from "./text";
import { vocabularyProblems } from "./vocabulary";

/*
 * Cohérence d'un gabarit (ce que la forme zod ne dit pas) : c'est la transformation en code du script de contrôle du
 * Trésor. Chaque problème est une phrase lisible ; un gabarit qui en a un seul ne se charge pas (registry.ts).
 */

export interface LintInput {
  readonly decl: TemplateDecl;
  readonly texts: Readonly<Partial<Record<Lang, LanguageText>>>;
  readonly sources: Readonly<Record<string, SourceEntry>>;
}

const BLOCK_TYPES: ReadonlySet<string> = new Set(["party", "list"]);
const INLINE_ONLY: ReadonlySet<string> = new Set(["party", "list", "text"]);

const variantsOf = (variable: VariableDecl | undefined): readonly string[] | null => {
  if (variable === undefined) return null;
  if (variable.type === "boolean") return ["false", "true"];
  return variable.type === "enum" ? (variable.values ?? []) : null;
};

const clauseProblems = (clause: ClauseDecl, input: LintInput): readonly string[] => {
  const { decl, sources } = input;
  const vars = decl.variables;
  const out: string[] = [];
  if (clause.kind === "conditional" && clause.when === undefined) out.push(`conditional ${clause.id} without when`);
  if (clause.kind === "optional" && clause.default === undefined) out.push(`optional ${clause.id} without default`);
  if (clause.kind === "optional" && clause.toggledBy === undefined) out.push(`optional ${clause.id} without toggledBy`);
  for (const source of clause.sources) if (sources[source] === undefined) out.push(`clause ${clause.id} cites unknown source ${source}`);
  if (clause.sources.length === 0 && clause.basis !== "practice") out.push(`clause ${clause.id} has no source and no basis: practice`);
  for (const leaf of leavesOf(clause.when)) if (vars[leaf.var] === undefined) out.push(`clause ${clause.id} condition reads undeclared ${leaf.var}`);
  for (const name of [...(clause.requires ?? []), ...Object.values(clause.variantRequires ?? {}).flat()]) {
    if (vars[name] === undefined) out.push(`clause ${clause.id} requires undeclared ${name}`);
  }
  if (clause.variantBy !== undefined) {
    const expected = variantsOf(vars[clause.variantBy]);
    if (expected === null) out.push(`clause ${clause.id} variantBy ${clause.variantBy} is not a declared enum or boolean`);
    for (const gate of clause.gates ?? []) if (expected !== null && !expected.includes(gate.variant)) out.push(`clause ${clause.id} gate on unknown variant ${gate.variant}`);
  } else if ((clause.gates ?? []).length > 0) out.push(`clause ${clause.id} has gates without variantBy`);
  return out;
};

const variableProblems = (name: string, variable: VariableDecl, decl: TemplateDecl): readonly string[] => {
  const out: string[] = [];
  const clauseIds = new Set(decl.clauses.map((c) => c.id));
  if (variable.type === "enum" && variable.values === undefined) out.push(`enum ${name} without values`);
  if (variable.type === "money" && variable.currency === undefined) out.push(`money ${name} without currency`);
  if (typeof variable.currency === "string" && decl.variables[variable.currency] === undefined) out.push(`money ${name} currency reads undeclared ${variable.currency}`);
  if (variable.default !== undefined && variable.defaultStatus === "HYPOTHESIS" && variable.defaultReason === undefined) out.push(`default of ${name} without reason`);
  if (variable.type === "enum" && variable.default !== undefined && !(variable.values ?? []).includes(String(variable.default))) out.push(`default of ${name} is not one of its values`);
  const when = variable.requiredWhen;
  if (when !== undefined && "clause" in when && !clauseIds.has(when.clause)) out.push(`variable ${name} requiredWhen unknown clause ${when.clause}`);
  if (when !== undefined && "var" in when && decl.variables[when.var] === undefined) out.push(`variable ${name} requiredWhen reads undeclared ${when.var}`);
  if (variable.pattern !== undefined) {
    try {
      new RegExp(variable.pattern, "u");
    } catch {
      out.push(`variable ${name} has an invalid pattern`);
    }
  }
  return out;
};

const declarationProblems = (input: LintInput): readonly string[] => {
  const { decl } = input;
  const ids = decl.clauses.map((c) => c.id);
  const out: string[] = [];
  for (const id of ids.filter((id, i) => ids.indexOf(id) !== i)) out.push(`duplicate clause ${id}`);
  if (!decl.languages.includes(decl.prevailingLanguage)) out.push(`prevailingLanguage ${decl.prevailingLanguage} is not a declared language`);
  for (const point of decl.review.points) if (point.clause !== undefined && !ids.includes(point.clause)) out.push(`review ${point.id} targets unknown clause ${point.clause}`);
  for (const source of [...(decl.retention.archive?.sources ?? []), ...(decl.retention.accounting?.sources ?? [])]) {
    if (input.sources[source] === undefined) out.push(`retention cites unknown source ${source}`);
  }
  return [
    ...out,
    ...decl.clauses.flatMap((clause) => clauseProblems(clause, input)),
    ...Object.entries(decl.variables).flatMap(([name, variable]) => variableProblems(name, variable, decl)),
  ];
};

/* ---- textes ---- */

interface Context {
  readonly lang: string;
  readonly decl: TemplateDecl;
  readonly clause?: ClauseDecl | undefined;
  readonly variant?: string | undefined;
}

const isGuarded = (name: string, context: Context): boolean => {
  const { clause, variant } = context;
  if (clause === undefined) return false;
  return (
    leavesOf(clause.when).some((leaf) => leaf.var === name && leaf.present !== undefined) ||
    (clause.requires ?? []).includes(name) ||
    (variant !== undefined && (clause.variantRequires?.[variant] ?? []).includes(name))
  );
};

const placeholderProblems = (text: string, context: Context, scalarOnly: boolean): readonly string[] => {
  const where = `${context.lang}: ${context.clause?.id ?? "header"}${context.variant === undefined ? "" : `/${context.variant}`}`;
  return placeholdersOf(text).flatMap((name) => {
    const variable = context.decl.variables[name];
    if (variable === undefined) return [`${where}: undeclared placeholder {{${name}}}`];
    const out: string[] = [];
    if (variable.type === "boolean") out.push(`${where}: {{${name}}} is a boolean: it drives conditions and is never printed`);
    if (scalarOnly && INLINE_ONLY.has(variable.type)) out.push(`${where}: {{${name}}} is a ${variable.type}, not allowed in a title or heading`);
    if (variable.required !== true && !isGuarded(name, context)) out.push(`${where}: optional {{${name}}} not guarded`);
    const labels = variable.labels?.[context.lang as Lang];
    if (variable.type === "enum" && (labels === undefined || (variable.values ?? []).some((v) => labels[v] === undefined))) out.push(`${where}: enum {{${name}}} has no label for every value in ${context.lang}`);
    return out;
  });
};

const aloneProblems = (text: string, context: Context): readonly string[] =>
  text.split("\n").flatMap((line) =>
    placeholdersOf(line)
      .filter((name) => BLOCK_TYPES.has(context.decl.variables[name]?.type ?? ""))
      .filter((name) => line.trim() !== `{{${name}}}`)
      .map((name) => `${context.lang}: {{${name}}} must be alone on its line`),
  );

const clauseTextProblems = (clause: ClauseDecl, text: ClauseText | undefined, context: Context): readonly string[] => {
  const lang = context.lang;
  if (text === undefined) return [`${lang}: no text for clause ${clause.id}`];
  const here: Context = { ...context, clause };
  const out: string[] = [];
  if (clause.variantBy === undefined) {
    if (typeof text.body !== "string") out.push(`${lang}: clause ${clause.id} without body`);
    if (text.variants !== undefined) out.push(`${lang}: clause ${clause.id} has variants without variantBy`);
    return [...out, ...placeholderProblems(text.body ?? "", here, false), ...aloneProblems(text.body ?? "", here)];
  }
  if (text.body !== undefined) out.push(`${lang}: clause ${clause.id} has both body and variants`);
  const expected = variantsOf(context.decl.variables[clause.variantBy]) ?? [];
  const got = Object.keys(text.variants ?? {});
  for (const e of expected.filter((v) => !got.includes(v))) out.push(`${lang}: clause ${clause.id} missing variant ${e}`);
  for (const g of got.filter((v) => !expected.includes(v))) out.push(`${lang}: clause ${clause.id} unknown variant ${g}`);
  return [
    ...out,
    ...Object.entries(text.variants ?? {}).flatMap(([variant, body]) => [
      ...placeholderProblems(body, { ...here, variant }, false),
      ...aloneProblems(body, { ...here, variant }),
    ]),
  ];
};

const languageProblems = (lang: string, text: LanguageText, input: LintInput): readonly string[] => {
  const context: Context = { lang, decl: input.decl };
  const header = [text.title, text.subtitle ?? "", text.reviewNotice, text.reviewFooter].flatMap((t) => placeholderProblems(t, context, true));
  // Le pied « relu » lit la date de relecture dans la donnée `review` : seul placeholder qui n'est pas une variable.
  const reviewed = text.reviewedFooter ?? "";
  const reviewedProblems = [
    ...placeholderProblems(reviewed.split("{{review.reviewedOn}}").join(""), context, true),
    ...(input.decl.review.status === "reviewed" && text.reviewedFooter === undefined ? [`${lang}: review.status is reviewed but the language has no reviewedFooter`] : []),
    ...(input.decl.review.status === "reviewed" && (input.decl.review.reviewedOn === null || input.decl.review.reviewedBy === null || input.decl.review.reviewedDigest === null) ? [`${lang}: review.status is reviewed without reviewedBy, reviewedOn and reviewedDigest`] : []),
  ];
  const headings = Object.entries(text.clauses).flatMap(([id, c]) => placeholderProblems(c.heading, { ...context, clause: input.decl.clauses.find((x) => x.id === id) }, true));
  const known = new Set(input.decl.clauses.map((c) => c.id));
  return [
    ...(text.language === lang ? [] : [`${lang}: language field is ${text.language}`]),
    ...input.decl.clauses.flatMap((clause) => clauseTextProblems(clause, text.clauses[clause.id], context)),
    ...Object.keys(text.clauses).filter((id) => !known.has(id)).map((id) => `${lang}: text for unknown clause ${id}`),
    ...header,
    ...reviewedProblems,
    ...headings,
    ...vocabularyProblems(`${input.decl.id}/${lang}`, text),
  ];
};

/** Tous les problèmes d'un gabarit et de ses textes ; vide quand le gabarit est cohérent. */
export const lintTemplate = (input: LintInput): readonly string[] => [
  ...declarationProblems(input),
  ...input.decl.languages.flatMap((lang) => {
    const text = input.texts[lang];
    return text === undefined ? [`${lang}: language_missing`] : languageProblems(lang, text, input);
  }),
];
