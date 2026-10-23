import { INVITATION_MESSAGE_MAX, INVITATION_TTL_DAYS, MAX_INVITATIONS_PER_SENDER_PER_DAY, type InvitationView, type JoinedPool, type SentEmailInvitation } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { InvitationsDictionary } from "@/i18n/market/invitations-fr";
import { day } from "@/lib/format";
import type { Notice } from "@/lib/invitations";
import { EmptyNote } from "@/components/EmptyState";

/*
 * The invitations screen (C23): send form, sent list (state, revoke, one reminder) and received list (accept, decline).
 * Server-rendered forms posting to server actions; no client JavaScript.
 */

type Action = (formData: FormData) => Promise<void>;

/** The sentence of a notice, on the list page or on the link's page (`masked`: the invited address, half hidden). */
export const noticeText = (d: InvitationsDictionary, notice: Notice, masked = ""): string => {
  const texts: Readonly<Record<string, string>> = {
    envoyee: d.done.sent,
    revoquee: d.done.revoked,
    relancee: d.done.reminded,
    refusee: d.done.declined,
    quitte: d.done.left,
    "acceptee-vivier": d.answer.acceptedText.freelance,
    "acceptee-rattachee": d.answer.acceptedText.clientLinked,
    "acceptee-client": d.answer.acceptedText.clientPending,
    trop: d.errors.tooMany,
    indisponible: d.errors.unavailable,
    entreprise: d.noOrganisation,
    invalide: d.errors.invalid,
    soi: d.errors.self,
    introuvable: d.errors.absent,
    profil: d.errors.noProfile,
    deja: d.errors.already,
    limite: d.errors.limit,
    "mot-contact": d.errors.contact,
    "mot-html": d.errors.html,
    "mot-long": d.errors.long,
    "mot-empty": d.errors.long,
    close: d.errors.closed,
    "trop-tot": d.errors.tooSoon,
    "deja-relancee": d.errors.alreadyReminded,
    expiree: d.answer.expiredText,
    adresse: d.answer.mismatch(masked),
    cote: d.answer.self,
  };
  return texts[notice.key] ?? d.errors.invalid;
};

export function NoticeBanner({ text, ok }: { readonly text: string; readonly ok: boolean }) {
  return ok ? (
    <p className="form-ok" role="status">
      {text}
    </p>
  ) : (
    <p className="form-error" role="alert">
      {text}
    </p>
  );
}

export function InvitationSendForm({ lang, d, title, action }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly title: string; readonly action: Action }) {
  return (
    <form action={action} className="panel" aria-labelledby="invite-title">
      <h2 id="invite-title">{title}</h2>
      <input type="hidden" name="lang" value={lang} />
      <div className="field">
        <label htmlFor="invite-email">{d.email}</label>
        <input id="invite-email" name="email" type="email" required maxLength={254} autoComplete="off" aria-describedby="invite-email-hint" />
        <p id="invite-email-hint" className="field-hint">
          {d.emailHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="invite-message">{d.message}</label>
        <textarea id="invite-message" name="message" rows={3} maxLength={INVITATION_MESSAGE_MAX} aria-describedby="invite-message-hint" />
        <p id="invite-message-hint" className="field-hint">
          {d.messageHint(INVITATION_MESSAGE_MAX)}
        </p>
      </div>
      <p className="muted small">{d.rules(INVITATION_TTL_DAYS, MAX_INVITATIONS_PER_SENDER_PER_DAY)}</p>
      <button type="submit" className="btn btn-primary">
        {d.submit}
      </button>
    </form>
  );
}

const stateText = (d: InvitationsDictionary, invitation: SentEmailInvitation, lang: Lang): string => {
  if (invitation.state === "pending") return d.state.pending(day(invitation.expiresAt, lang));
  if (invitation.state === "accepted" && invitation.kind === "client") return invitation.linkedOrganisationName === null ? d.notLinked : d.linked(invitation.linkedOrganisationName);
  return d.state[invitation.state];
};

function SentRow({ lang, d, invitation, revoke, remind }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly invitation: SentEmailInvitation; readonly revoke: Action; readonly remind: Action }) {
  return (
    <li className="thread-row">
      <span className="thread-who">
        <strong>{invitation.email}</strong>
        <span className="muted small"> · {stateText(d, invitation, lang)}</span>
      </span>
      <span className="thread-last muted small">
        {d.sentOn(day(invitation.createdAt, lang))}
        {invitation.reminded ? ` · ${d.reminded}` : null}
      </span>
      {invitation.manageable && invitation.state === "pending" ? (
        <span className="filters-actions">
          {invitation.remindable ? (
            <form action={remind}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="id" value={invitation.id} />
              <button type="submit" className="btn" aria-label={d.remindLabel(invitation.email)}>
                {d.remind}
              </button>
            </form>
          ) : null}
          <form action={revoke}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="id" value={invitation.id} />
            <button type="submit" className="btn btn-quiet" aria-label={d.revokeLabel(invitation.email)}>
              {d.revoke}
            </button>
          </form>
        </span>
      ) : null}
    </li>
  );
}

export function SentInvitations(props: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly sent: readonly SentEmailInvitation[]; readonly revoke: Action; readonly remind: Action }) {
  const { lang, d, sent } = props;
  return (
    <section className="panel" aria-labelledby="sent-title">
      <h2 id="sent-title">{d.sentTitle}</h2>
      {sent.length === 0 ? (
        <EmptyNote>{d.sentEmpty}</EmptyNote>
      ) : (
        <ul className="threads invitations-sent">
          {sent.map((invitation) => (
            <SentRow key={invitation.id} lang={lang} d={d} invitation={invitation} revoke={props.revoke} remind={props.remind} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Accept or decline: two submit buttons; `token` only when the page was reached from the e-mail link. */
export function AnswerForm(props: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly invitation: InvitationView; readonly token: string | null; readonly action: Action; readonly hint: string | null }) {
  const { lang, d, invitation, token } = props;
  return (
    <form action={props.action} className="filters-actions">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={invitation.id} />
      <input type="hidden" name="kind" value={invitation.kind} />
      {token === null ? null : <input type="hidden" name="t" value={token} />}
      {props.hint === null ? null : <p className="muted small panel-span">{props.hint}</p>}
      <button type="submit" name="decision" value="accept" className="btn btn-primary">
        {d.answer.accept}
      </button>
      <button type="submit" name="decision" value="decline" className="btn btn-quiet">
        {d.answer.decline}
      </button>
    </form>
  );
}

export function InvitationCard({ lang, d, invitation, children }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly invitation: InvitationView; readonly children?: React.ReactNode }) {
  // A company whose name carries a link or contact is shown neutrally, as in the e-mail.
  const inviter = invitation.inviter ?? d.someCompany;
  return (
    <li className="panel" aria-labelledby={`inv-${invitation.id}`}>
      <h3 id={`inv-${invitation.id}`}>{d.from(inviter)}</h3>
      <p className="measure">{d.answer.lead[invitation.kind](inviter)}</p>
      {invitation.message === null ? null : (
        <blockquote className="measure" aria-label={d.answer.note}>
          {invitation.message}
        </blockquote>
      )}
      <p className="muted small">{d.expires(day(invitation.expiresAt, lang))}</p>
      {children}
    </li>
  );
}

export function ReceivedInvitations(props: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly received: readonly InvitationView[]; readonly action: Action }) {
  const { lang, d, received } = props;
  if (received.length === 0) return null;
  return (
    <section aria-labelledby="received-title">
      <h2 id="received-title">{d.receivedTitle}</h2>
      <p className="muted measure">{d.receivedLead}</p>
      <ul className="plain-list">
        {received.map((invitation) => (
          <InvitationCard key={invitation.id} lang={lang} d={d} invitation={invitation}>
            <AnswerForm lang={lang} d={d} invitation={invitation} token={null} action={props.action} hint={null} />
          </InvitationCard>
        ))}
      </ul>
    </section>
  );
}

/** The pools the freelancer joined by invitation, each with a "leave" button: the company is not told. */
export function JoinedPools({ lang, d, pools, action }: { readonly lang: Lang; readonly d: InvitationsDictionary; readonly pools: readonly JoinedPool[]; readonly action: Action }) {
  if (pools.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="pools-title">
      <h2 id="pools-title">{d.poolsTitle}</h2>
      <p className="muted measure">{d.poolsLead}</p>
      <ul className="threads">
        {pools.map((pool) => (
          <li key={pool.organisationId} className="thread-row">
            <span className="thread-who">
              <strong>{pool.name}</strong>
              <span className="muted small"> · {d.joinedOn(day(pool.joinedAt, lang))}</span>
            </span>
            <form action={action}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="organisationId" value={pool.organisationId} />
              <button type="submit" className="btn btn-quiet" aria-label={d.leaveLabel(pool.name)}>
                {d.leave}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
