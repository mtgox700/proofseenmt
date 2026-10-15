interface Fact {
  readonly label: string;
  readonly value: string;
  readonly foot?: string;
}

/** Key figures as a definition list: label, value, an optional line under it. */
export function FactList({ facts, label }: { readonly facts: readonly Fact[]; readonly label?: string }) {
  return (
    <dl className="insight-facts" aria-label={label}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd className="num">{fact.value}</dd>
          {fact.foot === undefined ? null : <dd className="muted small">{fact.foot}</dd>}
        </div>
      ))}
    </dl>
  );
}
