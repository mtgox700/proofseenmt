import Link from "next/link";
import "@/styles/insights.css";
import { dashboards, freelanceInsights, missionInvitations, profiles, savedMissions, visibility, type ApplicationStatus, type ContractStatus } from "@proofseen/db";
import { MissionCounts } from "@/components/market/MissionCounts";
import { StatusTag } from "@/components/market/StatusTag";
import { HomeVisibility } from "@/components/visibility/HomeVisibility";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";
import { AiCitations } from "./AiCitations";
import { AudienceSection } from "./AudienceSection";
import { AvailabilityCheck } from "./AvailabilityCheck";
import { CountsTable, statusRows } from "./CountsTable";
import { FreelanceMoney } from "./FreelanceMoney";
import { StageBlock } from "./StageBlock";

const APPLICATION_ORDER: readonly ApplicationStatus[] = ["submitted", "shortlisted", "hired", "declined", "withdrawn"];
const CONTRACT_ORDER: readonly ContractStatus[] = ["pending_signatures", "active", "completed", "cancelled"];
/** Measurements shown in the citations table. */
const CITATION_WAVES = 3;

/**
 * The marketplace side of a freelancer's home, structured by what matters now: the stage, the profile, missions and
 * applications, the 90-day audience, AI citations, earnings. Every figure is counted in the database; none is a score.
 */
export async function FreelanceHomeBoard({ lang }: { readonly lang: Lang }) {
  const dict = marketDictionary(lang);
  const p = dict.profile;
  const d = dict.insights;
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return null;
  const now = new Date();
  const [profile, board, invitations, saved, insights, waves] = await Promise.all([
    profiles(market.db).findMine(market.actor),
    dashboards(market.db).freelance(market.actor),
    missionInvitations(market.db).countPending(market.actor),
    savedMissions(market.db).countOpen(market.actor),
    freelanceInsights(market.db).forFreelance(market.actor, now),
    visibility(market.db).mine(market.actor, CITATION_WAVES),
  ]);
  return (
    <>
      <StageBlock lang={lang} d={d} p={p} board={board} />
      <AvailabilityCheck lang={lang} d={d} board={board} now={now} />
      <section className="panel" aria-labelledby="market-title">
        <h2 id="market-title">{p.homeTitle}</h2>
        {profile === null ? (
          <p className="measure">{p.homeNoProfile}</p>
        ) : (
          <p className="thread-meta">
            <StatusTag status={profile.visibility === "private" ? "draft" : "accepted"} label={profile.reference} />
            <span className="muted">{p.visibility[profile.visibility]}</span>
          </p>
        )}
        <div className="empty-actions">
          <Link className={profile === null ? "btn btn-primary" : "btn"} href={`/${lang}/app/profil`}>
            {profile === null ? p.homeCreate : p.homeEdit}
          </Link>
          <Link className={profile === null ? "btn" : "btn btn-primary"} href={`/${lang}/missions`}>
            {p.homeBrowse}
          </Link>
        </div>
      </section>
      <MissionCounts lang={lang} s={dict.missionsSpace} invitations={invitations} saved={saved} />
      {profile === null ? null : (
        <section className="ws-block" aria-labelledby="work-title">
          <h2 id="work-title">{d.work.title}</h2>
          <div className="insight-columns">
            <CountsTable id="work-applications" lang={lang} title={d.work.applications} labelHeader={d.work.status} countHeader={d.work.count} rows={statusRows(APPLICATION_ORDER, dict.missions.applicationStatus, board.applications)} />
            <CountsTable id="work-contracts" lang={lang} title={d.work.contracts} labelHeader={d.work.status} countHeader={d.work.count} rows={statusRows(CONTRACT_ORDER, dict.deals.contracts.status, board.contracts)} />
          </div>
        </section>
      )}
      {insights === null ? null : <AudienceSection lang={lang} d={d} insights={insights} published={profile !== null && profile.visibility !== "private"} />}
      <HomeVisibility lang={lang} market={market} profile={profile}>
        <AiCitations lang={lang} d={d} v={dict.visibility} waves={waves} />
      </HomeVisibility>
      {profile === null || insights === null ? null : <FreelanceMoney lang={lang} d={d} b={dict.account.dashboard} board={board} revenue={insights.revenue} />}
    </>
  );
}
