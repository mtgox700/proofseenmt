import { CONFIRMATION_SUMMARY_MAX, MAX_PENDING_CONFIRMATIONS, type MyConfirmationRequest } from "@proofseen/db";
import { requestMissionConfirmation, withdrawMissionConfirmation } from "@/app/[lang]/app/preuves/mission-actions";
import { EmptyNote } from "@/components/EmptyState";
import "@/styles/app-registre.css";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { day, month } from "@/lib/format";
import { requestsInOrder } from "@/lib/proof-register";

/*
 * "À l'essai" on /app/preuves (CONNECTED_PLAN §2.1, lot 2): the confirmation requests sent to clients, the nearest
 * deadline first, each with its state in words, in amber while it waits; the closed ones folded under them; then the
 * form to ask for a new one. A confirmed request is not green here: its mission carries the poinçon at the top of the
 * page, once. Server-rendered, plain forms, no client JavaScript.
 */

interface PanelProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly requests: readonly MyConfirmationRequest[];
  /** Message to show after an action, already translated. */
  readonly notice: { readonly kind: "ok" | "error"; readonly text: string } | null;
}

const stateText = (m: MarketDictionary, r: MyConfirmationRequest, lang: Lang): string => {
  const f = m.confirmations.freelance;
  if (r.state === "pending") return f.state.pending(day(r.expiresAt, lang));
  if (r.state === "confirmed") return r.decidedAt === null ? m.proofs.trial.confirmedUndated : m.proofs.trial.confirmedHere(day(r.decidedAt, lang));
  return r.state === "expired" ? f.state.expired : f.state.refused;
};

const tagOf = (r: MyConfirmationRequest): string => (r.state === "pending" ? "tag tag-signal" : r.state === "confirmed" ? "tag tag-done" : "tag tag-quiet");

function Request({ lang, m, r }: { readonly lang: Lang; readonly m: MarketDictionary; readonly r: MyConfirmationRequest }) {
  const f = m.confirmations.freelance;
  return (
    <li className="reg-request" data-state={r.state}>
      <p className="reg-request-what">
        <strong>{r.role}</strong> · {r.clientName} <span className="muted small">({f.target[r.target]})</span>
      </p>
      <p className="muted small">{m.confirmations.period(month(r.startedOn, lang), month(r.endedOn, lang))}</p>
      <p className="reg-request-state">
        <span className={tagOf(r)}>{stateText(m, r, lang)}</span>
      </p>
      {r.state === "pending" ? (
        <form action={withdrawMissionConfirmation}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" className="btn btn-quiet" aria-label={f.withdrawLabel(r.role)}>
            {f.withdraw}
          </button>
        </form>
      ) : null}
    </li>
  );
}

function Requests({ lang, m, requests }: { readonly lang: Lang; readonly m: MarketDictionary; readonly requests: readonly MyConfirmationRequest[] }) {
  const ordered = requestsInOrder(requests);
  const open = ordered.filter((r) => r.state === "pending");
  const closed = ordered.filter((r) => r.state !== "pending");
  return (
    <>
      {open.length === 0 ? (
        <EmptyNote>{m.confirmations.freelance.requestsEmpty}</EmptyNote>
      ) : (
        <ul className="reg-requests">
          {open.map((r) => (
            <Request key={r.id} lang={lang} m={m} r={r} />
          ))}
        </ul>
      )}
      {closed.length === 0 ? null : (
        <details className="reg-closed">
          <summary>
            {m.proofs.trial.closed} <span className="num">({closed.length})</span>
          </summary>
          <ul className="reg-requests">
            {closed.map((r) => (
              <Request key={r.id} lang={lang} m={m} r={r} />
            ))}
          </ul>
        </details>
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
    <form action={requestMissionConfirmation} className="panel-grid reg-request-form" aria-labelledby="mission-form-title">
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

export function MissionTrial({ lang, m, requests, notice }: PanelProps) {
  const t = m.proofs.trial;
  const pending = requests.filter((r) => r.state === "pending").length;
  return (
    <section className="panel" id="missions" aria-labelledby="missions-title">
      <h2 id="missions-title">{t.title}</h2>
      <p className="muted measure">{t.lead}</p>
      {notice === null ? null : notice.kind === "ok" ? (
        <p className="form-ok" role="status">
          {notice.text}
        </p>
      ) : (
        <p className="form-error" role="alert">
          {notice.text}
        </p>
      )}
      <Requests lang={lang} m={m} requests={requests} />
      {pending >= MAX_PENDING_CONFIRMATIONS ? <p className="muted measure">{m.confirmations.freelance.limit(MAX_PENDING_CONFIRMATIONS)}</p> : <RequestForm lang={lang} m={m} />}
    </section>
  );
}
