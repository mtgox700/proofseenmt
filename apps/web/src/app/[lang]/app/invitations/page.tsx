import { notFound } from "next/navigation";
import { invitationAnswers, invitations, talentPool, type InvitationView, type JoinedPool, type SentEmailInvitation } from "@proofseen/db";
import { InvitationSendForm, JoinedPools, NoticeBanner, noticeText, ReceivedInvitations, SentInvitations } from "@/components/market/Invitations";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { noticeOf } from "@/lib/invitations";
import { currentOrganisation, pageMarket, type Market } from "@/lib/market";
import { verifiedAddresses } from "@/lib/session";
import { answerInvitation, leavePool, remindInvitation, revokeInvitation, sendInvitation } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; fait?: string }>;
}

interface Lists {
  /** `null`: a company person without a company yet, who cannot send freelancer invitations. */
  readonly sent: readonly SentEmailInvitation[] | null;
  readonly received: readonly InvitationView[];
  /** Only owners and administrators invite freelancers on behalf of the company; freelancers always may. */
  readonly canSend: boolean;
  readonly pools: readonly JoinedPool[];
}

/**
 * A company sees its company's invitations to freelancers and the client invitations it received; a freelancer sees the
 * client invitations they sent and the pool invitations they received. Received ones match a VERIFIED address only.
 */
const listsFor = async (market: Market): Promise<Lists> => {
  const now = new Date();
  const received = await invitationAnswers(market.db).listReceived(market.actor, await verifiedAddresses(), now);
  if (market.person.role === "freelance") {
    const [sent, pools] = await Promise.all([invitations(market.db).listMine(market.actor, now), talentPool(market.db).joined(market.actor)]);
    return { sent, received: received.filter((i) => i.kind === "freelance"), canSend: true, pools };
  }
  const organisation = await currentOrganisation(market);
  const sent = organisation === null ? null : await invitations(market.db).listForOrganisation(market.actor, organisation.id, now);
  const canSend = organisation !== null && (organisation.role === "owner" || organisation.role === "admin");
  return { sent, received: received.filter((i) => i.kind === "client"), canSend, pools: [] };
};

/** Invitations, for both sides: send, follow what was sent, answer what was received. */
export default async function InvitationsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const d = m.invitations;
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const { sent, received, canSend, pools } = await listsFor(market);
  const { erreur, fait } = await searchParams;
  const notice = noticeOf(fait, erreur);
  const side = market.person.role === "freelance" ? d.freelance : d.company;

  return (
    <>
      <header className="app-head">
        <h1>{side.title}</h1>
        <p className="muted measure">{side.lead}</p>
      </header>
      {notice === null ? null : <NoticeBanner ok={notice.ok} text={noticeText(d, notice)} />}
      <ReceivedInvitations lang={lang} d={d} received={received} action={answerInvitation} />
      <JoinedPools lang={lang} d={d} pools={pools} action={leavePool} />
      {sent === null ? (
        <p className="muted measure">{d.noOrganisation}</p>
      ) : (
        <>
          {canSend ? <InvitationSendForm lang={lang} d={d} title={side.formTitle} action={sendInvitation} /> : <p className="muted measure">{d.adminOnly}</p>}
          <SentInvitations lang={lang} d={d} sent={sent} revoke={revokeInvitation} remind={remindInvitation} />
        </>
      )}
    </>
  );
}
