import "@proofseen/brand/seal.css";

export interface FactLine {
  /** The whole fact, its date written out when the database has one. */
  readonly text: string;
  /**
   * Verified by a third party and read from the database (SIRET checked in the official register, a mission confirmed
   * by the client or paid on Proofseen, an address proven): the green square. Anything declared, or merely measured on
   * Proofseen, keeps the ruled square.
   */
  readonly verified: boolean;
}

interface FactLinesProps {
  readonly lines: readonly FactLine[];
  /** The register's name for a reader, when the list has no heading of its own. */
  readonly label?: string;
}

/**
 * Facts written as lines of the register (CONNECTED_PLAN section 2: declared, poinçonné), the grammar of the public
 * pages (`factLine` of @proofseen/hub): a square of 8 px, then the words. The square is never alone: the words say the
 * state, the colour only repeats it. No count is turned into a score and no line is ordered by it.
 */
export function FactLines({ lines, label }: FactLinesProps) {
  if (lines.length === 0) return null;
  return (
    <ul className="fact-lines" aria-label={label}>
      {lines.map((line) => (
        <li key={line.text} className={line.verified ? "fact-line" : "fact-line open"}>
          <span className={line.verified ? "sq" : "sq open"} aria-hidden="true" />
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
