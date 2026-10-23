import "@/styles/app-confirmer.css";
import type { ConfirmationRecordedDecision } from "@proofseen/db";
import { AckStrike } from "@/components/proof/AckStrike";
import { Seal } from "@/components/proof/Seal";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { date, day } from "@/lib/format";
import { strikesNow } from "@/lib/strike";

interface ConfirmationAckProps {
  readonly lang: Lang;
  readonly d: MarketDictionary["confirmDesk"]["ack"];
  /** The id of the request: names the heading, and is what the device remembers once the seal has struck. */
  readonly id: string;
  /** The decision as the database holds it, never as the address says. */
  readonly recorded: ConfirmationRecordedDecision;
  /** Who struck: the company from its account, or a contact at the client through the signed link. */
  readonly by: "company" | "contact";
  readonly reference: string;
  readonly title: string;
  readonly headingLevel: 1 | 2;
  /** The clock of this request: a decision taken just now strikes, an older one is shown set. */
  readonly now: Date;
  /** What was decided on: the claim, as the person read it before deciding. */
  readonly children: React.ReactNode;
  /** The last line, under the mark. */
  readonly footer?: React.ReactNode;
}

/**
 * The acknowledgement of a decision on a mission (CONNECTED_PLAN section 2.4). Confirmed: the cartouche and the trace
 * the mission now carries on the freelancer's profile, word for word (the seal is dated like the hub, in UTC), struck
 * once if the decision was just taken. Declined: a line in ink, dated, and no green, since nothing was verified.
 */
export function ConfirmationAck({ lang, d, id, recorded, by, reference, title, headingLevel, now, children, footer }: ConfirmationAckProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const headingId = `ack-${id}`;
  const confirmed = recorded.decision === "confirmed";
  const seal = confirmed ? (
    <Seal
      text={d.seal[by](date(recorded.decidedAt.toISOString(), lang))}
      date={recorded.decidedAt}
      trace={[
        { label: d.source, value: d.sourceValue },
        { label: d.by, value: d.byValue[by] },
      ]}
    />
  ) : null;
  return (
    <section className="ack" aria-labelledby={headingId}>
      <p className="kicker">{d.label}</p>
      <Heading id={headingId}>{title}</Heading>
      {children}
      {seal === null ? (
        <p className="ack-refused">
          <time dateTime={recorded.decidedAt.toISOString()}>{d.refusedOn(day(recorded.decidedAt, lang))}</time>
        </p>
      ) : (
        <>
          <p className="ack-lead">{d.sealLead}</p>
          {strikesNow(recorded.decidedAt, now) ? <AckStrike id={id}>{seal}</AckStrike> : <div className="ack-seal">{seal}</div>}
          <p className="muted small">{d.published(reference)}</p>
        </>
      )}
      {footer}
    </section>
  );
}
