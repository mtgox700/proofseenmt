import type { Block, DocumentModel, ModelClause, Run } from "@proofseen/documents";
import { diffWords, lcsSteps, type Piece } from "./words";

/*
 * Two versions of a document, clause by clause (storyboard L1.6, §4 E5, T8). Clauses are aligned by their `id`, never
 * by their article number (model.ts: « la comparaison de versions se fait par `id` »): an article added before others
 * renumbers them without changing them. In the order of the newer version, the removed ones at their old place.
 * Inside a clause, paragraphs and bullets are aligned by longest common subsequence; a removed paragraph next to an
 * added one of the same kind is one changed paragraph, compared word by word (words.ts).
 * The number and the date of issue live in the title and the footer of the document, never in a clause: they are never
 * counted as changes.
 */

export type BlockDiff =
  | { readonly kind: "same"; readonly block: Block }
  | { readonly kind: "added"; readonly block: Block }
  | { readonly kind: "removed"; readonly block: Block }
  /** `pieces` is null past the word ceiling: then « Avant » and « Après » are shown whole. */
  | { readonly kind: "changed"; readonly before: Block; readonly after: Block; readonly pieces: readonly Piece[] | null };

export type ClauseDiff =
  /** Same heading, same text; the number may differ (« Article 14, auparavant article 13 »). */
  | { readonly kind: "identical"; readonly clause: ModelClause; readonly before: ModelClause }
  | { readonly kind: "modified"; readonly clause: ModelClause; readonly before: ModelClause; readonly blocks: readonly BlockDiff[] }
  | { readonly kind: "added"; readonly clause: ModelClause }
  | { readonly kind: "removed"; readonly clause: ModelClause };

export interface Counts {
  readonly modified: number;
  readonly added: number;
  readonly removed: number;
  readonly total: number;
}

export interface Comparison {
  readonly clauses: readonly ClauseDiff[];
  readonly counts: Counts;
}

/** The runs of a block: a party block is its lines, one after the other. */
export function blockRuns(block: Block): readonly Run[] {
  if (block.kind !== "party") return block.runs;
  return block.lines.flatMap((line, index) => (index === 0 ? [{ text: line.text, value: true }] : [{ text: "\n" }, { text: line.text, value: true }]));
}

export const blockText = (block: Block): string => blockRuns(block).map((run) => run.text).join("");
const blockKey = (block: Block): string => `${block.kind}:${blockText(block)}`;

function diffBlocks(before: readonly Block[], after: readonly Block[]): readonly BlockDiff[] {
  const steps = lcsSteps(before.map(blockKey), after.map(blockKey));
  const out: BlockDiff[] = [];
  let removed: Block[] = [];
  let added: Block[] = [];
  const flush = () => {
    // Pair a removed paragraph with an added one of the same kind, in order: one paragraph that changed.
    const left = [...removed];
    for (const block of added) {
      const match = left.findIndex((candidate) => candidate.kind === block.kind);
      if (match === -1) {
        out.push({ kind: "added", block });
        continue;
      }
      const [paired] = left.splice(match, 1) as [Block];
      out.push({ kind: "changed", before: paired, after: block, pieces: diffWords(blockRuns(paired), blockRuns(block)) });
    }
    for (const block of left) out.push({ kind: "removed", block });
    removed = [];
    added = [];
  };
  for (const step of steps) {
    if (step.op === "same") {
      flush();
      out.push({ kind: "same", block: after[step.b] as Block });
    } else if (step.op === "removed") removed.push(before[step.a] as Block);
    else added.push(after[step.b] as Block);
  }
  flush();
  return out;
}

const sameText = (a: ModelClause, b: ModelClause): boolean => a.heading === b.heading && a.blocks.length === b.blocks.length && a.blocks.every((block, i) => blockKey(block) === blockKey(b.blocks[i] as Block));

function diffClause(before: ModelClause, after: ModelClause): ClauseDiff {
  if (sameText(before, after)) return { kind: "identical", clause: after, before };
  return { kind: "modified", clause: after, before, blocks: diffBlocks(before.blocks, after.blocks) };
}

export function compareModels(older: DocumentModel, newer: DocumentModel): Comparison {
  const oldById = new Map(older.clauses.map((clause) => [clause.id, clause]));
  const newIds = new Set(newer.clauses.map((clause) => clause.id));
  // A removed clause is placed after the clause that preceded it in the older version and still exists.
  const anchored = new Map<string | null, ModelClause[]>();
  let anchor: string | null = null;
  for (const clause of older.clauses) {
    if (newIds.has(clause.id)) anchor = clause.id;
    else anchored.set(anchor, [...(anchored.get(anchor) ?? []), clause]);
  }
  const removedAfter = (id: string | null): ClauseDiff[] => (anchored.get(id) ?? []).map((clause) => ({ kind: "removed", clause }));
  const clauses: ClauseDiff[] = [...removedAfter(null)];
  for (const clause of newer.clauses) {
    const before = oldById.get(clause.id);
    clauses.push(before === undefined ? { kind: "added", clause } : diffClause(before, clause), ...removedAfter(clause.id));
  }
  const count = (kind: ClauseDiff["kind"]) => clauses.filter((clause) => clause.kind === kind).length;
  const modified = count("modified");
  const added = count("added");
  const removed = count("removed");
  return { clauses, counts: { modified, added, removed, total: modified + added + removed } };
}

export type ClauseGroup = { readonly kind: "identical"; readonly clauses: readonly Extract<ClauseDiff, { kind: "identical" }>[] } | { readonly kind: "change"; readonly diff: Exclude<ClauseDiff, { kind: "identical" }> };

/** Consecutive identical clauses folded together (« 25 clauses identiques »), the changes between them kept in place. */
export function groupIdentical(clauses: readonly ClauseDiff[]): readonly ClauseGroup[] {
  const groups: ClauseGroup[] = [];
  for (const diff of clauses) {
    const last = groups[groups.length - 1];
    if (diff.kind !== "identical") groups.push({ kind: "change", diff });
    else if (last?.kind === "identical") groups[groups.length - 1] = { kind: "identical", clauses: [...last.clauses, diff] };
    else groups.push({ kind: "identical", clauses: [diff] });
  }
  return groups;
}
