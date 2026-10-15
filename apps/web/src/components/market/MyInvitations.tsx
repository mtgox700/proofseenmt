import Link from "next/link";
import type { MyInvitation } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MissionsDictionary } from "@/i18n/market/missions-fr";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";
import { day } from "@/lib/format";

interface MyInvitationsProps {
  readonly lang: Lang;
  readonly m: MissionsDictionary;
  readonly s: MissionsSpaceDictionary;
  readonly invitations: readonly MyInvitation[];
  readonly dismiss: (formData: FormData) => Promise<void>;
}

/** Invitations to apply received by the freelancer, on missions still open. Nothing shown when there are none. */
export function MyInvitations({ lang, m, s, invitations, dismiss }: MyInvitationsProps) {
  if (invitations.length === 0) return null;
  const t = s.mine;
  return (
    <section className="ws-block" aria-labelledby="invitations-title">
      <h2 id="invitations-title">{t.invitations}</h2>
      <p className="muted small measure">{t.invitationsLead}</p>
      <ul className="threads">
        {invitations.map((invitation) => (
          <li key={invitation.invitationId} className="thread-row">
            <span className="thread-who">
              <strong>{invitation.mission.title}</strong>
              <span className="muted small"> · {invitation.mission.organisationName}</span>
            </span>
            <span className="thread-last muted small">
              {m.workModes[invitation.mission.workMode]}
              {invitation.mission.city === null ? null : ` · ${invitation.mission.city}`} · {t.invitedOn} {day(invitation.createdAt, lang)}
              {invitation.applied ? ` · ${t.applied}` : null}
            </span>
            <span className="row-actions">
              {invitation.applied ? null : (
                <Link className="btn btn-primary" href={`/${lang}/app/missions/${invitation.mission.id}/postuler`}>
                  {t.apply}
                </Link>
              )}
              <form action={dismiss}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="invitationId" value={invitation.invitationId} />
                <button type="submit" className="btn btn-quiet">
                  {t.dismiss}
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
