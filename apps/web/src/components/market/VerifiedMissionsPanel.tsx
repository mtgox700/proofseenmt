import { CONFIRMATION_SUMMARY_MAX, MAX_PENDING_CONFIRMATIONS, type MyConfirmationRequest, type VerifiedMissionRecord } from "@proofseen/db";
import { requestMissionConfirmation, withdrawMissionConfirmation } from "@/app/[lang]/app/preuves/mission-actions";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { day, month } from "@/lib/format";

/*
 * The "verified missions" section of the proofs page: what is already public, the requests waiting for a client, and
 * the form to ask for a new confirmation. Server-rendered, plain forms, no client JavaScript.
 */

type C = MarketDictionary["confirmations"];

interface PanelProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly missions: readonly VerifiedMissionRecord[];
  readonly requests: readonly MyConfirmationRequest[];
  /** Message to show after an action, already translated. */
  readonly notice: { readonly kind: "ok" | "error"; readonly text: string } | null;
}

const verifiedLine = (c: C, kind: string, on: string): string =>
  kind === "client_confirmation" ? c.freelance.verifiedOn.client_confirmation(on) : kind === "paid_on_platform" ? c.freelance.verifiedOn.paid_on_platform(on) : c.freelance.verifiedOn.other(on);

function Verified({ lang, m, missions }: { readonly lang: Lang; readonly m: MarketDictionary; readonly missions: readonly VerifiedMissionRecord[] }) {
  const c = m.confirmations;
  return (
    <>
      <h3>{c.freelance.verifiedTitle}</h3>
      {missions.length === 0 ? (
        <p className="muted">{c.freelance.verifiedEmpty}</p>
      ) : (
        <ul className="plain-list">
          {missions.map((mission) => (
            <li key={mission.id} className="proof-item">
              <div className="proof-head">
                <strong>{mission.role}</strong>
                <span className="tag tag-proof">{verifiedLine(c, mission.evidenceKind, day(mission.verifiedAt, lang))}</span>
              </div>
              <p className="muted small">
                {m.company.kinds[mission.clientKind]} · {c.months(mission.durationMonths)}
                {mission.clientName === null ? null : ` · ${c.freelance.clientShown(mission.clientName)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const stateText = (c: C, r: MyConfirmationRequest, lang: Lang): string => {
  if (r.state === "pending") return c.freelance.state.pending(day(r.expiresAt, lang));
  if (r.state === "confirmed") return c.freelance.state.confirmed(day(r.decidedAt ?? r.createdAt, lang));
  return r.state === "expired" ? c.freelance.state.expired : c.freelance.state.refused;
};

function Requests({ lang, c, requests }: { readonly lang: Lang; readonly c: C; readonly requests: readonly MyConfirmationRequest[] }) {
  return (
    <>
      <h3>{c.freelance.requestsTitle}</h3>
      {requests.length === 0 ? (
        <p className="muted">{c.freelance.requestsEmpty}</p>
      ) : (
        <ul className="plain-list">
          {requests.map((r) => (
            <li key={r.id} className="proof-item">
              <div className="proof-head">
                <span>
                  <strong>{r.role}</strong> · {r.clientName} <span className="muted small">({c.freelance.target[r.target]})</span>
                </span>
                <span className={r.state === "pending" ? "tag tag-signal" : r.state === "confirmed" ? "tag tag-proof" : "tag tag-quiet"}>{stateText(c, r, lang)}</span>
                {r.state === "pending" ? (
                  <form action={withdrawMissionConfirmation}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="btn btn-quiet" aria-label={c.freelance.withdrawLabel(r.role)}>
                      {c.freelance.withdraw}
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="muted small">{c.period(month(r.startedOn, lang), month(r.endedOn, lang))}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Field({ id, label, hint, children }: { readonly id: string; readonly label: string; readonly hint?: string; readonly children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function RequestForm({ lang, m }: { readonly lang: Lang; readonly m: MarketDictionary }) {
  const f = m.confirmations.freelance;
  return (
    <form action={requestMissionConfirmation} className="panel-grid" aria-labelledby="mission-form-title">
      <input type="hidden" name="lang" value={lang} />
      <h3 id="mission-form-title" className="panel-span">
        {f.formTitle}
      </h3>
      <p className="muted measure panel-span">{f.formLead}</p>
      <Field id="mission-role" label={f.role} hint={f.roleHint}>
        <input id="mission-role" name="role" required minLength={2} maxLength={200} aria-describedby="mission-role-hint" />
      </Field>
      <Field id="mission-client" label={f.clientName} hint={f.clientNameHint}>
        <input id="mission-client" name="clientName" required minLength={2} maxLength={200} autoComplete="organization" aria-describedby="mission-client-hint" />
      </Field>
      <Field id="mission-kind" label={f.clientKind}>
        <select id="mission-kind" name="clientKind" defaultValue="pme">
          {Object.entries(m.company.kinds).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="mission-siret" label={f.clientSiret} hint={f.clientSiretHint}>
        <input id="mission-siret" name="clientSiret" inputMode="numeric" maxLength={17} autoComplete="off" aria-describedby="mission-siret-hint" />
      </Field>
      <Field id="mission-email" label={f.contactEmail} hint={f.contactEmailHint}>
        <input id="mission-email" name="contactEmail" type="email" maxLength={254} autoComplete="off" aria-describedby="mission-email-hint" />
      </Field>
      <Field id="mission-start" label={f.startedOn} hint={f.periodHint}>
        <input id="mission-start" name="startedOn" type="month" required pattern="[0-9]{4}-[0-9]{2}" placeholder="2025-01" aria-describedby="mission-start-hint" />
      </Field>
      <Field id="mission-end" label={f.endedOn}>
        <input id="mission-end" name="endedOn" type="month" required pattern="[0-9]{4}-[0-9]{2}" placeholder="2025-06" />
      </Field>
      <div className="panel-span">
        <Field id="mission-summary" label={f.summary} hint={f.summaryHint(CONFIRMATION_SUMMARY_MAX)}>
          <textarea id="mission-summary" name="summary" required minLength={10} maxLength={CONFIRMATION_SUMMARY_MAX} rows={4} aria-describedby="mission-summary-hint" />
        </Field>
      </div>
      <div className="filters-actions panel-span">
        <button type="submit" className="btn btn-primary">
          {f.submit}
        </button>
      </div>
    </form>
  );
}

export function VerifiedMissionsPanel({ lang, m, missions, requests, notice }: PanelProps) {
  const c = m.confirmations;
  const pending = requests.filter((r) => r.state === "pending").length;
  return (
    <section className="panel" id="missions" aria-labelledby="missions-title">
      <h2 id="missions-title">{c.freelance.title}</h2>
      <p className="muted measure">{c.freelance.lead}</p>
      {notice === null ? null : notice.kind === "ok" ? (
        <p className="form-ok" role="status">
          {notice.text}
        </p>
      ) : (
        <p className="form-error" role="alert">
          {notice.text}
        </p>
      )}
      <Verified lang={lang} m={m} missions={missions} />
      <Requests lang={lang} c={c} requests={requests} />
      {pending >= MAX_PENDING_CONFIRMATIONS ? <p className="muted measure">{c.freelance.limit(MAX_PENDING_CONFIRMATIONS)}</p> : <RequestForm lang={lang} m={m} />}
    </section>
  );
}
