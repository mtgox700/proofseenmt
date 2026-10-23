import Link from "next/link";
import "@/styles/insights.css";
import { dashboards, freelanceInsights, missionConfirmations, missionInvitations, profiles, publicProfiles, savedMissions, visibility, type ApplicationStatus, type ContractStatus } from "@proofseen/db";
import { MissionCounts } from "@/components/market/MissionCounts";
import { StatusTag } from "@/components/market/StatusTag";
import { PublicTally } from "@/components/registre/PublicTally";
import { WaitingForClient } from "@/components/registre/WaitingForClient";
import { HomeVisibility } from "@/components/visibility/HomeVisibility";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";
import { publicStanding } from "@/lib/proof-register";
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

interface FreelanceHomeBoardProps {
  readonly lang: Lang;
  /** The missions proposed to the person, placed after what waits for someone and before the figures. */
  readonly forYou?: React.ReactNode;
}

/**
 * The freelancer's home as a file (CONNECTED_PLAN §2.1, lot 2), in this order: what is stamped on the public page (the
 * counts of its rail, the way in to the register); what waits for someone (publication, a client's answer, the
 * availability to confirm); the profile on the marketplace; the missions proposed; then the figures, lower and calmer.
 * Every figure is counted in the database; none is a score.
 */
export async function FreelanceHomeBoard({ lang, forYou = null }: FreelanceHomeBoardProps) {
  const dict = marketDictionary(lang);
  const p = dict.profile;
  const d = dict.insights;
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return null;
  const now = new Date();
  const [profile, board, invitations, saved, insights, waves, requests] = await Promise.all([
    profiles(market.db).findMine(market.actor),
    dashboards(market.db).freelance(market.actor),
    missionInvitations(market.db).countPending(market.actor),
    savedMissions(market.db).countOpen(market.actor),
    freelanceInsights(market.db).forFreelance(market.actor, now),
    visibility(market.db).mine(market.actor, CITATION_WAVES),
    missionConfirmations(market.db).listMine(market.actor, now),
  ]);
  // The public page as its visitors get it, only when there is one: the same counts as its rail.
  const page = profile === null || profile.visibility === "private" || profile.slug === null ? null : await publicProfiles(market.db).page(profile.slug, now);
  return (
    <>
      <section className="ws-block reg-home-standing" aria-labelledby="standing-title">
        <h2 id="standing-title">{dict.proofs.standing.title}</h2>
        <PublicTally lang={lang} p={dict.proofs} standing={publicStanding(profile, page, lang)} link />
      </section>
      <StageBlock lang={lang} d={d} p={p} board={board} />
      <WaitingForClient lang={lang} m={dict} requests={requests} />
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
      {forYou}
      <div className="reg-figures">
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
      </div>
    </>
  );
}
