import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, invitationAnswers, type InvitationView } from "@proofseen/db";
import { AnswerForm, InvitationCard, NoticeBanner, noticeText } from "@/components/market/Invitations";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { hasDatabase } from "@/data/intake-sink";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { InvitationsDictionary } from "@/i18n/market/invitations-fr";
import { authConfigured } from "@/lib/auth-config";
import { day } from "@/lib/format";
import { invitationPath } from "@/lib/invitation-secret";
import { noticeOf, sideAllows } from "@/lib/invitations";
import { answerMarket, currentOrganisation } from "@/lib/market";
import { session, type Person } from "@/lib/session";
import { answerInvitation } from "../actions";

/** Depends on who is signed in and on the link: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ t?: string; erreur?: string }>;
}

/*
 * The page an invitation e-mail opens (C23). Opening it decides nothing. Signed out, it asks to sign in (or sign up)
 * with the invited address and comes back here; signed in, it offers accept or decline. The action then requires one
 * of the account's verified addresses to be the invited one: the link alone lets no one into a private pool.
 */

function Closed({ lang, title, text, d }: { readonly lang: Lang; readonly title: string; readonly text: string; readonly d: InvitationsDictionary }) {
  return (
    <section className="panel" aria-labelledby="invitation-closed">
      <h1 id="invitation-closed">{title}</h1>
      <p className="measure">{text}</p>
      <Link className="btn" href={`/${lang}/app`}>
        {d.answer.toApp}
      </Link>
    </section>
  );
}

function SignInFirst({ lang, d, back }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly back: string }) {
  const redirect = encodeURIComponent(back);
  return (
    <section className="panel" aria-labelledby="invitation-sign-in">
      <h2 id="invitation-sign-in">{d.answer.signInTitle}</h2>
      <p className="measure">{d.answer.signInText}</p>
      <p className="filters-actions">
        <Link className="btn btn-primary" href={`/${lang}/connexion?redirect_url=${redirect}`}>
          {d.answer.signIn}
        </Link>
        <Link className="btn" href={`/${lang}/creer-un-compte?redirect_url=${redirect}`}>
          {d.answer.signUp}
        </Link>
      </p>
    </section>
  );
}

/** What the signed-in person may do: answer (with a hint), or read why the invitation is for the other side. */
async function Answer({ lang, d, view, token, person }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly view: InvitationView; readonly token: string; readonly person: Person }) {
  if (!sideAllows(person.role, view.kind)) return <p className="form-error">{person.role === "operator" ? d.answer.self : d.answer.wrongSide[view.kind]}</p>;
  let hint: string | null = person.role === null ? d.answer.sideHint[view.kind] : null;
  if (person.role === "company" && view.kind === "client") {
    const organisation = await currentOrganisation(await answerMarket(lang));
    hint = organisation === null ? null : d.answer.asOrganisation(organisation.name);
  }
  return <AnswerForm lang={lang} d={d} invitation={view} token={token} action={answerInvitation} hint={hint} />;
}

export default async function InvitationAnswerPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const d = m.invitations;
  if (!authConfigured() || !hasDatabase()) return <MarketUnavailable text={m.notConfigured} />;
  const { t, erreur } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const found = await invitationAnswers(getDb()).lookup(id, token, new Date());
  if (found.kind === "invalid") return <Closed lang={lang} d={d} title={d.answer.invalidTitle} text={d.answer.invalidText} />;
  if (found.kind === "expired") return <Closed lang={lang} d={d} title={d.answer.expiredTitle} text={d.answer.expiredText} />;
  if (found.kind === "closed") return <Closed lang={lang} d={d} title={d.answer.closedTitle} text={d.answer.closedText} />;
  const { view } = found;
  const state = await session();
  const notice = noticeOf(undefined, erreur);
  const noticeLine =
    notice === null ? null : notice.key === "invalide" ? d.answer.invalidText : notice.key === "soi" ? d.answer.self : notice.key === "cote" ? d.answer.wrongSide[view.kind] : noticeText(d, notice, view.maskedEmail);

  return (
    <>
      <header className="app-head">
        <h1>{d.answer.title}</h1>
        <p className="muted small">
          {d.answer.for(view.maskedEmail)} {d.answer.expires(day(view.expiresAt, lang))}
        </p>
      </header>
      {noticeLine === null ? null : <NoticeBanner ok={false} text={noticeLine} />}
      <ul className="plain-list">
        <InvitationCard lang={lang} d={d} invitation={view}>
          {state.kind === "signed-in" ? <Answer lang={lang} d={d} view={view} token={token} person={state.person} /> : null}
        </InvitationCard>
      </ul>
      {state.kind === "signed-in" ? null : <SignInFirst lang={lang} d={d} back={invitationPath(lang, view.id, token)} />}
    </>
  );
}
