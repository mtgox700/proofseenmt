import type { Lang } from "@/i18n/types";
import type { Attribution } from "@/lib/vault/attribution";
import { vaultText } from "@/lib/vault/dictionary";
import type { Change } from "@/lib/vault/explain";

/*
 * « En bref » (storyboard L1.6, §4 E5): one sentence per changed choice, in the order of the articles, each with who
 * changed it in which version; then, when the template carries them (L1-132), what it means for you first and for the
 * other party next. Both parties read the same truth, each from their own place.
 */

export interface ChangeSummaryProps {
  readonly lang: Lang;
  readonly changes: readonly Change[];
  readonly attributionOf: (change: Change) => Attribution | null;
  /** The role of the person in the contract's words: the Client is the company, the Provider the freelancer. */
  readonly role: "client" | "provider";
}

export function attributionText(lang: Lang, attribution: Attribution): string {
  const c = vaultText(lang).compare;
  if (attribution.kind === "one") return c.changedBy(attribution.by, attribution.number);
  const [first, ...rest] = attribution.numbers;
  return `${c.changedFirst(first ?? 0)}${rest.map((n) => c.changedThen(n)).join("")}.`;
}

export function ChangeSummary({ lang, changes, attributionOf, role }: ChangeSummaryProps) {
  const t = vaultText(lang);
  const c = t.compare;
  const mine = role === "client" ? t.roles.forClient : t.roles.forProvider;
  const theirs = role === "client" ? t.roles.forProvider : t.roles.forClient;
  return (
    <section className="vault-brief" aria-labelledby="en-bref">
      <h2 id="en-bref" tabIndex={-1}>
        {c.brief}
      </h2>
      <ol>
        {changes.map((change, index) => {
          const attribution = attributionOf(change);
          const own = change.parties === null ? undefined : role === "client" ? change.parties.client : change.parties.provider;
          const other = change.parties === null ? undefined : role === "client" ? change.parties.provider : change.parties.client;
          return (
            <li key={`${change.key ?? "model"}-${index}`}>
              <p>{change.sentence}</p>
              {attribution === null ? null : <p className="vault-by">{attributionText(lang, attribution)}</p>}
              {change.parties?.both === undefined ? null : (
                <p className="vault-party-line">
                  {c.forBoth}
                  {change.parties.both}
                </p>
              )}
              {own === undefined ? null : (
                <p className="vault-party-line">
                  {c.forYou(mine)}
                  {own}
                </p>
              )}
              {other === undefined ? null : (
                <p className="vault-party-line">
                  {c.forOther(theirs)}
                  {other}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
