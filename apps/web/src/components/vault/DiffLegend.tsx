import type { Lang } from "@/i18n/types";
import type { ClauseDiff } from "@/lib/vault/compare";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * The count and the legend of a comparison (storyboard L1.6, §4 E5): « 3 changements : 1 clause modifiée, 1 ajoutée,
 * 1 retirée », each count a link to the first clause of its kind; then the legend in words, readable without colour.
 * From 64 rem it stays at the top while one reads; on a phone it does not stick.
 */

export interface DiffLegendProps {
  readonly lang: Lang;
  readonly clauses: readonly ClauseDiff[];
}

export function DiffLegend({ lang, clauses }: DiffLegendProps) {
  const c = vaultText(lang).compare;
  const first = (kind: ClauseDiff["kind"]) => clauses.find((clause) => clause.kind === kind)?.clause.id ?? null;
  const n = (kind: ClauseDiff["kind"]) => clauses.filter((clause) => clause.kind === kind).length;
  const modified = n("modified");
  const added = n("added");
  const removed = n("removed");
  const total = modified + added + removed;
  const sentence = c.count(total, modified, added, removed);
  const firstChange = clauses.find((clause) => clause.kind !== "identical")?.clause.id ?? null;
  return (
    <div className="vault-legend">
      <p>
        {firstChange === null ? sentence : <a href={`#clause-${first("modified") ?? first("added") ?? firstChange}`}>{sentence}</a>}
      </p>
      <p className="vault-legend-links">
        {[
          ["modified", c.modified] as const,
          ["added", c.added] as const,
          ["removed", c.removed] as const,
        ].map(([kind, word]) => {
          const id = first(kind);
          return id === null ? null : (
            <a key={kind} href={`#clause-${id}`}>
              {word}
            </a>
          );
        })}
      </p>
      <p>{c.legend}</p>
    </div>
  );
}
