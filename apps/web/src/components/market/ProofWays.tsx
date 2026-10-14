import type { ProofKit } from "@proofseen/profiles";
import type { MarketDictionary } from "@/i18n/market";

interface ProofWaysProps {
  readonly kit: ProofKit;
  readonly p: MarketDictionary["proofs"];
}

/** The three ways to prove an address, each with the exact value to publish. No script: one click selects a value. */
export function ProofWays({ kit, p }: ProofWaysProps) {
  const w = p.ways;
  const ways = [
    { key: "file", title: w.wellKnownTitle, scope: w.wellKnownScope, text: w.wellKnown(kit.wellKnown.url), value: kit.wellKnown.content, note: null },
    { key: "meta", title: w.metaTitle, scope: w.metaScope, text: w.meta(kit.metaTag.page), value: kit.metaTag.tag, note: null },
    { key: "dns", title: w.dnsTitle, scope: w.dnsScope, text: w.dns(kit.dnsTxt.host), value: kit.dnsTxt.value, note: w.dnsDelay },
  ];
  return (
    <details className="proof-ways" open>
      <summary>{w.summary}</summary>
      <p className="field-hint">{w.copyHint}</p>
      <ol className="proof-ways-list">
        {ways.map((way) => (
          <li key={way.key}>
            <p>
              <strong>{way.title}</strong> <span className="muted">· {way.scope}</span>
            </p>
            <p className="muted">{way.text}</p>
            <code className="proof-value">{way.value}</code>
            {way.note === null ? null : <p className="field-hint">{way.note}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
