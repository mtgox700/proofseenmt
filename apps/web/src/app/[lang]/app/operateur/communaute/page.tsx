import { notFound } from "next/navigation";
import { communityModeration, type CommunityItem } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome, ReasonField } from "@/components/operator/OperatorParts";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import type { OperatorDictionary } from "@/i18n/market/operator-fr";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { hideCommunityItem, restoreCommunityItem } from "../community-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string }>;
}

function Item({ lang, item, c, o, hidden }: { readonly lang: Lang; readonly item: CommunityItem; readonly c: CommunityDictionary; readonly o: OperatorDictionary; readonly hidden: boolean }) {
  return (
    <li className="op-item">
      <p>
        <strong>{item.target === "post" ? c.operator.post : c.operator.comment}</strong> · {item.authorName}{" "}
        <span className="muted small">{day(hidden && item.moderatedAt !== null ? item.moderatedAt : item.createdAt, lang)}</span>{" "}
        {hidden ? null : <a href={`/${lang}/publications/${item.postId}`}>{c.operator.open}</a>}
      </p>
      <blockquote>{item.excerpt}</blockquote>
      {hidden && item.reason !== null ? <p className="muted small">{item.reason}</p> : null}
      <form action={hidden ? restoreCommunityItem : hideCommunityItem} className="op-forms">
        <LangField lang={lang} />
        <input type="hidden" name="target" value={item.target} />
        <input type="hidden" name="id" value={item.id} />
        <ReasonField id={`${hidden ? "restore" : "hide"}-${item.id}`} o={o} />
        <button type="submit" className="btn">
          {hidden ? c.operator.restore : c.operator.hide}
        </button>
      </form>
    </li>
  );
}

/** Recent community posts and comments to review, and what is hidden today; hide or restore each with a reason. */
export default async function CommunityModerationPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const c = m.community;
  const repo = communityModeration(context.db, context.operator);
  const [recent, hidden] = await Promise.all([repo.recent(), repo.hidden()]);
  const { etat } = await searchParams;

  return (
    <>
      <header className="app-head">
        <h1>{c.operator.title}</h1>
        <p className="muted measure">{c.operator.lead}</p>
      </header>
      <Outcome flag={etat} o={o} />
      <section className="panel" aria-labelledby="community-hidden">
        <h2 id="community-hidden">{c.operator.hidden}</h2>
        {hidden.length === 0 ? (
          <p className="muted">{o.common.empty}</p>
        ) : (
          <ul className="op-list">
            {hidden.map((item) => (
              <Item key={`${item.target}-${item.id}`} lang={lang} item={item} c={c} o={o} hidden />
            ))}
          </ul>
        )}
      </section>
      <section className="panel" aria-labelledby="community-recent">
        <h2 id="community-recent">{c.operator.recent}</h2>
        {recent.length === 0 ? (
          <p className="muted">{o.common.empty}</p>
        ) : (
          <ul className="op-list">
            {recent.map((item) => (
              <Item key={`${item.target}-${item.id}`} lang={lang} item={item} c={c} o={o} hidden={false} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
