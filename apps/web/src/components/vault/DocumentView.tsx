import "@/styles/vault.css";
import type { ReactNode } from "react";
import type { Block, DocumentModel, ModelClause, Run } from "@proofseen/documents";
import { SEP } from "@/i18n/market/vault-fr";

/*
 * The text of a version in HTML (storyboard L1.6, §4 E4), from its DocumentModel recomputed and verified (replay.ts):
 * the review notice framed, the title, then each clause as a section whose h2 says its article, with its paragraphs,
 * bullets and parties. A value from the data is the text's own weight and colour: the text of a contract is not
 * coloured. The language is the document's, not the page's. A PDF in a frame is never used: unreadable on a phone.
 */

export const runsText = (runs: readonly Run[]): string => runs.map((run) => run.text).join("");

/** Paragraphs, and consecutive bullets gathered in one list. */
export function Blocks({ blocks, render = (runs) => runsText(runs) }: { readonly blocks: readonly Block[]; readonly render?: (runs: readonly Run[]) => ReactNode }) {
  const out: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  const flush = () => {
    if (bullets.length > 0) out.push(<ul key={`ul-${out.length}`}>{bullets}</ul>);
    bullets = [];
  };
  blocks.forEach((block, index) => {
    if (block.kind === "bullet") {
      bullets.push(<li key={index}>{render(block.runs)}</li>);
      return;
    }
    flush();
    if (block.kind === "paragraph") out.push(<p key={index}>{render(block.runs)}</p>);
    else
      out.push(
        <p key={index} className="vault-party">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i === 0 ? null : <br />}
              {line.strong === true ? <strong>{line.text}</strong> : line.text}
            </span>
          ))}
        </p>,
      );
  });
  flush();
  return <>{out}</>;
}

export const clauseHeading = (clause: ModelClause, article: (number: string, heading: string) => string): string => article(String(clause.number), clause.heading);

export interface DocumentViewProps {
  readonly model: DocumentModel;
  readonly article: (number: string, heading: string) => string;
  readonly footer: string;
  readonly label: string;
}

export function DocumentView({ model, article, footer, label }: DocumentViewProps) {
  return (
    <article id="texte" className="vault-article" lang={model.language} aria-label={label} tabIndex={-1}>
      {model.reviewNotice === null ? null : (
        <p className="vault-note" role="note">
          {model.reviewNotice}
        </p>
      )}
      <p className="vault-doc-title">{model.title}</p>
      {model.subtitle === null ? null : <p className="vault-doc-sub">{model.subtitle}</p>}
      {model.clauses.map((clause) => (
        <section key={clause.id} id={`clause-${clause.id}`} className="vault-clause" aria-labelledby={`clause-${clause.id}-h`}>
          <h2 id={`clause-${clause.id}-h`} tabIndex={-1}>
            {clauseHeading(clause, article)}
          </h2>
          <Blocks blocks={clause.blocks} />
        </section>
      ))}
      {model.signatories.length === 0 ? null : (
        <ul className="vault-signatories">
          {model.signatories.map((signatory) => (
            <li key={signatory.role}>
              <strong>{signatory.label}</strong>
              {signatory.name === null ? null : `${SEP}${signatory.name}`}
              {`${SEP}${signatory.caption}`}
            </li>
          ))}
        </ul>
      )}
      <p className="vault-footer">{footer}</p>
    </article>
  );
}
