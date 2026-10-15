import type { SentInvitation } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";
import { day } from "@/lib/format";

type Action = (formData: FormData) => Promise<void>;

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

/** Invite a published freelancer, by public reference, to apply to this open mission; and the invitations already sent. */
export function InvitePanel({ lang, s, missionId, sent, notice, action }: { readonly lang: Lang; readonly s: MissionsSpaceDictionary; readonly missionId: string; readonly sent: readonly SentInvitation[]; readonly notice: string | undefined; readonly action: Action }) {
  const i = s.invite;
  const errors: Readonly<Record<string, string>> = { ...i.errors, trop: i.errors.tooMany };
  const message = notice === undefined || notice === "invited" ? null : (errors[notice] ?? null);
  return (
    <section className="panel" aria-labelledby="invite-title">
      <h2 id="invite-title">{i.title}</h2>
      <p className="muted measure">{i.lead}</p>
      {notice === "invited" ? (
        <p className="form-ok" role="status">
          {i.sent}
        </p>
      ) : message === null ? null : (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <form action={action} className="panel-grid">
        <Hidden name="lang" value={lang} />
        <Hidden name="missionId" value={missionId} />
        <div className="field">
          <label htmlFor="invite-reference">{i.reference}</label>
          <input id="invite-reference" name="reference" type="text" required maxLength={8} pattern="[Ff][Rr]-[A-Za-z0-9]{5}" placeholder="FR-XXXXX" autoComplete="off" />
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn btn-primary">
            {i.send}
          </button>
        </div>
      </form>
      {sent.length === 0 ? null : (
        <>
          <h3>{i.listTitle}</h3>
          <ul className="plain-list">
            {sent.map((invitation) => (
              <li key={`${invitation.reference}-${invitation.createdAt.getTime()}`} className="org-member">
                <span>
                  <strong>{invitation.reference}</strong>
                  <span className="muted small">
                    {" "}
                    · {i.on} {day(invitation.createdAt, lang)} · {invitation.applied ? i.applied : i.pending}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Duplicate the mission into a new draft, or keep it as a template for later missions. */
export function MissionTools({ lang, s, missionId, title, notice, duplicate, saveTemplate }: { readonly lang: Lang; readonly s: MissionsSpaceDictionary; readonly missionId: string; readonly title: string; readonly notice: string | undefined; readonly duplicate: Action; readonly saveTemplate: Action }) {
  const t = s.templates;
  const message = notice === "enregistre" ? t.saved : notice === "limite" ? t.limit : notice === "invalide" ? t.invalid : null;
  return (
    <section className="panel" aria-labelledby="tools-title">
      <h2 id="tools-title">{t.saveTitle}</h2>
      {message === null ? null : (
        <p className={notice === "enregistre" ? "form-ok" : "form-error"} role={notice === "enregistre" ? "status" : "alert"}>
          {message}
        </p>
      )}
      <form action={saveTemplate} className="panel-grid">
        <Hidden name="lang" value={lang} />
        <Hidden name="missionId" value={missionId} />
        <div className="field">
          <label htmlFor="template-name">{t.name}</label>
          <input id="template-name" name="name" type="text" required maxLength={120} defaultValue={title.slice(0, 120)} />
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn">
            {t.save}
          </button>
        </div>
      </form>
      <form action={duplicate}>
        <Hidden name="lang" value={lang} />
        <Hidden name="missionId" value={missionId} />
        <button type="submit" className="btn" aria-describedby="duplicate-hint">
          {s.duplicate.action}
        </button>
        <p id="duplicate-hint" className="muted small">
          {s.duplicate.hint}
        </p>
      </form>
    </section>
  );
}
