import Link from "next/link";
import { notFound } from "next/navigation";
import { contactReviews, feedbackTriage, moderation, operatorStats, proofDisputes, vigilanceDesk } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { operatorBase } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** What waits for the operator, in numbers, each one a link to its queue. */
export default async function OperatorHome({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const { db, operator } = context;
  const now = new Date();
  const [contacts, vigilance, disputes, feedback, stats, hidden] = await Promise.all([
    contactReviews(db, operator).pendingCount(),
    vigilanceDesk(db, operator).pendingCount(now),
    proofDisputes(db, operator).list(),
    feedbackTriage(db, operator).countNew(),
    operatorStats(db, operator).measurements(now),
    moderation(db, operator).hidden(),
  ]);
  const base = operatorBase(lang);
  const tiles = [
    [o.overview.pendingContacts, contacts, `${base}/contacts`],
    [o.overview.pendingVigilance, vigilance, `${base}/verifications`],
    [o.overview.disputes, disputes.length, `${base}/verifications#adresses`],
    [o.overview.newFeedback, feedback, `${base}/retours`],
    [o.overview.queue, stats.queued, `${base}/mesures`],
    [o.overview.hidden, hidden.length, `${base}/moderation`],
  ] as const;

  return (
    <>
      <header className="app-head">
        <h1>{o.title}</h1>
        <p className="muted measure">{o.lead}</p>
      </header>
      <dl className="op-tiles">
        {tiles.map(([label, count, href]) => (
          <div key={href}>
            <dt>
              <Link href={href}>{label}</Link>
            </dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
