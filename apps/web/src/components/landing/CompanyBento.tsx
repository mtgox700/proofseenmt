import type { HomeCopy } from "@/content/home";
import { PhraseToFilters } from "./PhraseToFilters";

/*
 * S7, the company's side: the same Bento Grid and Magic Card as S3, mirrored (the large tile on the right) so the
 * page never repeats itself. Tile A is the only client part (PhraseToFilters). The facts on the profile card are the
 * only green of this section, and only on the two facts a third party verifies; the availability is dated, not
 * verified, and stays in ink. The API tile writes its answer line by line once, when it comes on screen.
 */

function Tile({ id, className, children, title, text }: { readonly id: string; readonly className: string; readonly children?: React.ReactNode; readonly title: string; readonly text: string }) {
  return (
    <article className={`tile ${className}`} aria-labelledby={id} data-spot="" data-play-at="">
      {children}
      <p className="tile-text">
        <strong id={id}>{title}</strong> {text}
      </p>
    </article>
  );
}

/* The shape of the real answer of GET /api/v1/contracts (packages/db/src/company-api.ts), with example values. */
const RESPONSE = ['{ "ok": true, "data": { "items": [', '  { "id": "…", "status": "active",', '    "costCenter": "Plateforme", "days": 12,', '    "startsOn": "2026-11-02" }', '], "next": null } }'];

export function CompanyBento({ copy, sample }: { readonly copy: HomeCopy["company"]; readonly sample: string }) {
  const { phrase, facts, board, escrow, invoicing, team, api } = copy;
  return (
    <section className="section bento-section" id="outils-entreprise" aria-label={phrase.title}>
      <div className="wrap">
        <div className="bento bento-company">
          <Tile id="cb-phrase" className="t-phrase" title={phrase.title} text={phrase.text}>
            <PhraseToFilters label={phrase.label} sentence={phrase.sentence} chips={phrase.chips} sample={phrase.sample} />
          </Tile>

          <Tile id="cb-facts" className="t-facts" title={facts.title} text={facts.text}>
            <div className="mock mock-facts" aria-hidden="true">
              <span className="mock-ref">{facts.reference}</span>
              <ul>
                {facts.items.map((item, i) => (
                  <li key={item} className={i < 2 ? "is-proof" : undefined}>
                    <span className={i < 2 ? "sq" : "sq open"} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Tile>

          <Tile id="cb-board" className="t-board" title={board.title} text={board.text}>
            <div className="mock mock-board" aria-hidden="true">
              {board.columns.map((column, i) => (
                <span key={column} className="board-col">
                  <b>{column}</b>
                  {Array.from({ length: 3 - i }, (_, j) => (
                    <span key={j} className="board-card" style={{ "--i": j } as React.CSSProperties} />
                  ))}
                </span>
              ))}
            </div>
          </Tile>

          <Tile id="cb-escrow" className="t-escrow" title={escrow.title} text={escrow.text}>
            <div className="mock mock-escrow" aria-hidden="true">
              <span className="escrow-lock" />
              <span className="escrow-label">{escrow.label}</span>
            </div>
          </Tile>

          <Tile id="cb-invoicing" className="t-invoicing" title={invoicing.title} text={invoicing.text}>
            <div className="mock mock-invoice" aria-hidden="true">
              <span className="invoice-lines">
                <span />
                <span />
                <span />
              </span>
              <span className="invoice-mention">{invoicing.mention}</span>
            </div>
          </Tile>

          <Tile id="cb-team" className="t-team" title={team.title} text={team.text}>
            <div className="mock mock-team" aria-hidden="true">
              <span className="team-avatar">AD</span>
              <span className="team-avatar">CM</span>
              <span className="team-checks">{team.approvals}</span>
            </div>
          </Tile>

          <Tile id="cb-api" className="t-api" title={api.title} text={api.text}>
            <div className="code" role="region" tabIndex={0} aria-label={api.request}>
              <pre>
                <code>
                  <span className="code-req">{api.request}</span>
                  {"\n"}
                  <span className="code-key">{api.key}</span>
                  {RESPONSE.map((line, i) => (
                    <span key={line} className="code-line" style={{ "--i": i } as React.CSSProperties}>
                      {"\n"}
                      {line}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </Tile>
        </div>
        <p className="bento-note">{sample}</p>
      </div>
    </section>
  );
}
