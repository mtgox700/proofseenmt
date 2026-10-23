import Link from "next/link";
import { Seal } from "@/components/proof/Seal";
import type { Lang } from "@/i18n";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import type { DealStep } from "@/lib/deal-steps";
import { day } from "@/lib/format";
import { parisDay } from "@/lib/paris-day";

interface DealThreadProps {
  readonly lang: Lang;
  readonly d: DealsDictionary["thread"];
  readonly steps: readonly DealStep[];
  /** The side reading the page: the step it has to act on says so in words. */
  readonly side: "company" | "freelance";
  readonly headingLevel: 2 | 3;
  /** A link under the thread (to the quotes, to the contract), when the page has one. */
  readonly link?: { readonly href: string; readonly label: string } | undefined;
}

function When({ lang, at }: { readonly lang: Lang; readonly at: Date }) {
  return <time dateTime={parisDay(at)}>{day(at, lang)}</time>;
}

function Line({ lang, d, s, side }: { readonly lang: Lang; readonly d: DealsDictionary["thread"]; readonly s: DealStep; readonly side: DealThreadProps["side"] }) {
  if (s.tone === "sealed" && s.at !== null) {
    return (
      <li className="deal-step" data-tone="sealed">
        <span className="deal-mark sq" aria-hidden="true" />
        <Seal text={d.verified(day(s.at, lang))} date={parisDay(s.at)} trace={[{ label: d.source, value: d.sourceValue }]} />
      </li>
    );
  }
  const label = s.key === "approved" && s.count !== undefined ? `${d.steps.approved} (${d.count(s.count.done, s.count.of)})` : d.steps[s.key];
  const yours = s.tone === "current" && s.actor === side;
  return (
    <li className="deal-step" data-tone={s.tone} aria-current={s.tone === "current" ? "step" : undefined}>
      <span className="deal-mark" aria-hidden="true" />
      <span className="deal-what">
        <span className="deal-label">{label}</span>
        {s.note === null ? null : <span className="deal-note">{d.notes[s.note]}</span>}
      </span>
      <span className="deal-state">
        {s.tone === "done" && s.at !== null ? <When lang={lang} at={s.at} /> : d.states[s.tone]}
        {yours ? <span className="tag tag-signal">{d.you}</span> : null}
      </span>
    </li>
  );
}

/**
 * The thread of a deal (CONNECTED_PLAN §2.3), the same on the contract and in the conversation: rendered by the server,
 * still, with no script. Ink for what is done, amber and words for what waits on someone, a rule for what is to come;
 * the green cartouche only for the verified mission the database holds.
 */
export function DealThread({ lang, d, steps, side, headingLevel, link }: DealThreadProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="deal" aria-labelledby="deal-title">
      <Heading id="deal-title">{d.title}</Heading>
      <ol className="deal-thread">
        {steps.map((s) => (
          <Line key={s.key} lang={lang} d={d} s={s} side={side} />
        ))}
      </ol>
      <p className="deal-foot">
        <span className="muted small">{d.lead}</span>
        {link === undefined ? null : (
          <Link className="deal-link" href={link.href}>
            {link.label}
          </Link>
        )}
      </p>
    </section>
  );
}
