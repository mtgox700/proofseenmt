import Link from "next/link";
import { notFound } from "next/navigation";
import { savedMissions } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { unsaveMission } from "../space-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** The freelancer's private list of saved missions, most recently saved first. */
export default async function SavedMissionsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const s = dict.missionsSpace.saved;
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const list = await savedMissions(market.db).list(market.actor);

  return (
    <>
      <p>
        <Link href={`/${lang}/app/missions`}>← {dict.missions.mine.title}</Link>
      </p>
      <header className="app-head">
        <h1>{s.title}</h1>
        <p className="muted measure">{s.lead}</p>
      </header>
      {list.length === 0 ? (
        <EmptyState title={s.empty} headingLevel={2}>
          <p>{s.emptyText}</p>
          <p className="empty-actions">
            <Link className="btn btn-primary" href={`/${lang}/missions`}>
              {s.browse}
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {list.map((item) => (
            <li key={item.missionId} className="thread-row">
              <span className="thread-who">
                <strong>{item.title}</strong>
                <span className="muted small"> · {item.organisationName}</span>
              </span>
              {item.status === "open" ? null : <StatusTag status="closed" label={s.closed} />}
              <span className="thread-last muted small">
                {dict.missions.workModes[item.workMode]}
                {item.city === null ? null : ` · ${item.city}`} · {s.savedOn} {day(item.savedAt, lang)}
              </span>
              <span className="row-actions">
                {item.status === "open" ? (
                  <Link className="btn" href={`/${lang}/app/missions/${item.missionId}/postuler`}>
                    {s.apply}
                  </Link>
                ) : null}
                <form action={unsaveMission}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="missionId" value={item.missionId} />
                  <input type="hidden" name="from" value="liste" />
                  <button type="submit" className="btn btn-quiet">
                    {s.remove}
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
