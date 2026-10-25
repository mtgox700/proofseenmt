import type { ReactNode } from "react";
import type { Block, Run } from "@proofseen/documents";
import type { Lang } from "@/i18n/types";
import type { BlockDiff, ClauseDiff as Diff, ClauseGroup } from "@/lib/vault/compare";
import { blockRuns } from "@/lib/vault/compare";
import { SEP } from "@/i18n/market/vault-fr";
import { vaultText } from "@/lib/vault/dictionary";
import { Blocks, runsText } from "./DocumentView";
import { InlineDiff } from "./InlineDiff";

/*
 * One clause of the comparison (storyboard L1.6, §4 E5, §5 of « Clause par clause »). Modified: a rule of the signal
 * colour in the margin and the word « Modifiée », unchanged paragraphs quiet, the changed one whole with its words
 * struck or underlined, a paragraph added marked + in the margin, one removed −. Added: + before each paragraph, the
 * text whole and not underlined (a whole article underlined no longer reads). Removed: its heading struck, its text
 * folded. Identical clauses in a row fold into « n clauses identiques ». Signs, words, strikes and underlines carry
 * every meaning: no colour does alone, and no green anywhere.
 */

const PLUS = "+";
const MINUS = String.fromCharCode(0x2212);

export interface ClauseView {
  readonly lang: Lang;
  /** « Article {n} · {heading} », in the document's language. */
  readonly article: (number: string, heading: string) => string;
  readonly addedOn: string;
  readonly removedOn: string;
  /** « cote »: before and after side by side; « complete »: nothing folded. */
  readonly view: "texte" | "cote" | "complete";
}

const text = (block: Block) => runsText(blockRuns(block));

function Paragraph({ sign, state, children }: { readonly sign?: string; readonly state: "same" | "changed" | "added" | "removed"; readonly children: ReactNode }) {
  return (
    <p className="vault-block" data-sign={sign} data-state={state}>
      {children}
    </p>
  );
}

function BlockRow({ diff, v, side }: { readonly diff: BlockDiff; readonly v: ClauseView; readonly side: "before" | "after" | "both" }): ReactNode {
  const sr = vaultText(v.lang).compare.sr;
  if (diff.kind === "same") return <Paragraph state="same">{text(diff.block)}</Paragraph>;
  if (diff.kind === "added") {
    if (side === "before") return null;
    return (
      <Paragraph sign={PLUS} state="added">
        <ins dateTime={v.addedOn}>
          <span className="sr-only">{sr.added}</span>
          {text(diff.block)}
          <span className="sr-only">{` ${sr.endAdded}`}</span>
        </ins>
      </Paragraph>
    );
  }
  if (diff.kind === "removed") {
    if (side === "after") return null;
    return (
      <Paragraph sign={MINUS} state="removed">
        <del dateTime={v.removedOn}>
          <span className="sr-only">{sr.removed}</span>
          {text(diff.block)}
        </del>
      </Paragraph>
    );
  }
  if (diff.pieces === null) {
    const t = vaultText(v.lang).compare;
    return (
      <>
        {side === "after" ? null : (
          <Paragraph sign={MINUS} state="removed">
            <span className="sr-only">{t.before} </span>
            <del dateTime={v.removedOn}>{text(diff.before)}</del>
          </Paragraph>
        )}
        {side === "before" ? null : (
          <Paragraph sign={PLUS} state="added">
            <span className="sr-only">{t.after} </span>
            <ins dateTime={v.addedOn}>{text(diff.after)}</ins>
          </Paragraph>
        )}
      </>
    );
  }
  return (
    <Paragraph state="changed">
      <InlineDiff lang={v.lang} pieces={diff.pieces} addedOn={v.addedOn} removedOn={v.removedOn} side={side} />
    </Paragraph>
  );
}

export interface ClauseDiffProps {
  readonly v: ClauseView;
  readonly diff: Exclude<Diff, { kind: "identical" }>;
  /** Rewritten by a new version of the template, with no choice of the parties behind it. */
  readonly byModel: boolean;
  /** The next change, for « Changement suivant », or null on the last one. */
  readonly next: { readonly id: string; readonly number: number; readonly heading: string } | null;
}

export function ClauseDiff({ v, diff, byModel, next }: ClauseDiffProps) {
  const t = vaultText(v.lang).compare;
  const clause = diff.clause;
  const headingId = `clause-${clause.id}-h`;
  const word = diff.kind === "modified" ? (byModel ? t.modifiedByModel : t.modified) : diff.kind === "added" ? t.added : t.removed;
  const heading = v.article(String(clause.number), clause.heading);
  const rows = (side: "before" | "after" | "both") => (diff.kind === "modified" ? diff.blocks.map((block, i) => <BlockRow key={i} diff={block} v={v} side={side} />) : null);
  return (
    <section id={`clause-${clause.id}`} className="vault-diff" data-kind={diff.kind} aria-labelledby={headingId}>
      <div className="vault-diff-head">
        <h3 id={headingId} tabIndex={-1}>
          {diff.kind === "removed" ? <del dateTime={v.removedOn}>{heading}</del> : heading}
        </h3>
        <span className="tag">{word}</span>
      </div>
      {diff.kind === "modified" ? (
        v.view === "cote" ? (
          <div className="vault-side">
            <div>
              <p className="vault-side-title">{t.before}</p>
              {rows("before")}
            </div>
            <div>
              <p className="vault-side-title">{t.after}</p>
              {rows("after")}
            </div>
          </div>
        ) : (
          rows("both")
        )
      ) : null}
      {diff.kind === "added"
        ? clause.blocks.map((block, i) => (
            <Paragraph key={i} sign={PLUS} state="added">
              {i === 0 ? <span className="sr-only">{t.sr.added}</span> : null}
              {text(block)}
            </Paragraph>
          ))
        : null}
      {diff.kind === "removed" ? (
        v.view === "complete" ? (
          <RemovedText blocks={clause.blocks} v={v} />
        ) : (
          <details>
            <summary>{t.readRemoved}</summary>
            <RemovedText blocks={clause.blocks} v={v} />
          </details>
        )
      ) : null}
      <p className="vault-next">{next === null ? <a href="#en-bref">{t.end}</a> : <a href={`#clause-${next.id}-h`}>{t.next(String(next.number), next.heading)}</a>}</p>
    </section>
  );
}

function RemovedText({ blocks, v }: { readonly blocks: readonly Block[]; readonly v: ClauseView }) {
  const sr = vaultText(v.lang).compare.sr;
  return (
    <>
      {blocks.map((block, i) => (
        <Paragraph key={i} sign={MINUS} state="removed">
          <del dateTime={v.removedOn}>
            {i === 0 ? <span className="sr-only">{sr.removed}</span> : null}
            {text(block)}
          </del>
        </Paragraph>
      ))}
    </>
  );
}

/** Identical clauses in a row, folded: their titles, each opening on its text (« Article 14, auparavant article 13 »). */
export function SameClauses({ v, group }: { readonly v: ClauseView; readonly group: Extract<ClauseGroup, { kind: "identical" }> }) {
  const t = vaultText(v.lang).compare;
  const list = (
    <ol>
      {group.clauses.map(({ clause, before }) => {
        const title = before.number === clause.number ? v.article(String(clause.number), clause.heading) : `${t.renumbered(String(clause.number), String(before.number))}${SEP}${clause.heading}`;
        return (
          <li key={clause.id} id={`clause-${clause.id}`}>
            {v.view === "complete" ? (
              <>
                <h3 id={`clause-${clause.id}-h`}>{title}</h3>
                <Blocks blocks={clause.blocks} render={(runs: readonly Run[]) => runsText(runs)} />
              </>
            ) : (
              <details>
                <summary id={`clause-${clause.id}-h`}>{title}</summary>
                <Blocks blocks={clause.blocks} />
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
  if (v.view === "complete") return <div className="vault-same">{list}</div>;
  return (
    <details className="vault-same">
      <summary>{t.identical(group.clauses.length)}</summary>
      {list}
    </details>
  );
}
