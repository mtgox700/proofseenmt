import type { Run } from "@proofseen/documents";

/*
 * The words of a paragraph, and what changed between two of its versions (storyboard L1.6, §4 E5, T8). A word keeps
 * the space that follows it, so the pieces put back together give the paragraph exactly. A value that came from the
 * data (`Run.value`: an amount, a date, a name) is one word, whatever spaces it holds: « 3 000,00 EUR » replaced is one
 * removal and one addition, never a letter. Alignment by longest common subsequence; beyond MAX_WORDS words on either
 * side the screen shows « Avant » then « Après » whole rather than a cut nobody can read.
 */

export const MAX_WORDS = 2000;

export interface Token {
  readonly text: string;
  readonly value: boolean;
}

export type PieceOp = "same" | "added" | "removed";

export interface Piece {
  readonly op: PieceOp;
  readonly text: string;
}

const WORD = /\S+\s*|\s+/g;

export function tokenize(runs: readonly Run[]): readonly Token[] {
  return runs.flatMap((run): Token[] => (run.value === true ? [{ text: run.text, value: true }] : (run.text.match(WORD) ?? []).map((text) => ({ text, value: false }))));
}

/** Two words are the same when their letters are: the space after a word does not make it another word. */
const keyOf = (token: Token): string => `${token.value ? "v" : "t"}:${token.text.trimEnd()}`;

export type Step = { readonly op: "same"; readonly a: number; readonly b: number } | { readonly op: "removed"; readonly a: number } | { readonly op: "added"; readonly b: number };

/** The steps from `a` to `b` by longest common subsequence; in each gap, what goes before what comes. */
export function lcsSteps(a: readonly string[], b: readonly string[]): readonly Step[] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = a[i] === b[j] ? (table[(i + 1) * cols + j + 1] as number) + 1 : Math.max(table[(i + 1) * cols + j] as number, table[i * cols + j + 1] as number);
    }
  }
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      steps.push({ op: "same", a: i, b: j });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * cols + j] as number) >= (table[i * cols + j + 1] as number)) {
      steps.push({ op: "removed", a: i });
      i += 1;
    } else {
      steps.push({ op: "added", b: j });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) steps.push({ op: "removed", a: i });
  for (; j < b.length; j += 1) steps.push({ op: "added", b: j });
  return reorderGaps(steps);
}

/** Inside each run of changes between two kept items, removals first, then additions: « 15 » barré, puis « 20 ». */
function reorderGaps(steps: readonly Step[]): readonly Step[] {
  const out: Step[] = [];
  let removed: Step[] = [];
  let added: Step[] = [];
  const flush = () => {
    out.push(...removed, ...added);
    removed = [];
    added = [];
  };
  for (const step of steps) {
    if (step.op === "same") {
      flush();
      out.push(step);
    } else if (step.op === "removed") removed.push(step);
    else added.push(step);
  }
  flush();
  return out;
}

/** Neighbouring pieces of the same kind become one piece: fewer <ins> and <del>, the same text. */
function merge(pieces: readonly Piece[]): readonly Piece[] {
  const out: Piece[] = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    if (last !== undefined && last.op === piece.op) out[out.length - 1] = { op: last.op, text: last.text + piece.text };
    else out.push(piece);
  }
  return out;
}

/** What changed from one paragraph to the other, word by word; null when either is past MAX_WORDS words. */
export function diffWords(before: readonly Run[], after: readonly Run[]): readonly Piece[] | null {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > MAX_WORDS || b.length > MAX_WORDS) return null;
  const pieces = lcsSteps(a.map(keyOf), b.map(keyOf)).map((step): Piece => {
    if (step.op === "same") return { op: "same", text: (b[step.b] as Token).text };
    if (step.op === "removed") return { op: "removed", text: (a[step.a] as Token).text };
    return { op: "added", text: (b[step.b] as Token).text };
  });
  return merge(pieces);
}
