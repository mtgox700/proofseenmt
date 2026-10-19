import { notFound } from "next/navigation";
import { missionAlerts, notifications, type AlertRecord, type NotificationKind } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { createAlert, removeAlert, saveEmailPreferences } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistre?: string; alerte?: string }>;
}

/** The e-mails each side can receive: a company is never told about contacts it made, a freelancer about applications. */
const KINDS: Readonly<Record<"company" | "freelance", readonly NotificationKind[]>> = {
  company: ["application_received", "message_received", "profile_match", "contract_update", "invitation_accepted"],
  freelance: ["contact_received", "message_received", "application_status", "application_read", "mission_invitation", "mission_match", "company_mission", "contract_update", "vigilance_expiring", "availability_reminder", "invitation_accepted"],
};
const MODES = ["remote", "hybrid", "onsite"] as const;

const describe = (alert: AlertRecord, m: MarketDictionary, lang: Lang): string => {
  const f = alert.filters;
  const parts = [
    ...f.workModes.map((mode) => m.missions.workModes[mode]),
    ...(f.city === undefined ? [] : [f.city]),
    ...f.skills,
    ...(f.minDailyRateCents === undefined ? [] : [m.account.alerts.from(money(f.minDailyRateCents, "EUR", lang))]),
    ...(f.maxDurationMonths === undefined ? [] : [m.account.alerts.upTo(f.maxDurationMonths)]),
  ];
  return parts.length === 0 ? m.account.alerts.any : parts.join(" · ");
};

function Alerts({ lang, m, alerts, error }: { readonly lang: Lang; readonly m: MarketDictionary; readonly alerts: readonly AlertRecord[]; readonly error: string | null }) {
  const a = m.account.alerts;
  return (
    <section className="panel" aria-labelledby="alerts-title">
      <h2 id="alerts-title">{a.listTitle}</h2>
      <p className="muted measure">{a.listLead}</p>
      {alerts.length === 0 ? (
        <p className="muted">{a.empty}</p>
      ) : (
        <ul className="plain-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="org-member">
              <span>{describe(alert, m, lang)}</span>
              <form action={removeAlert}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="alertId" value={alert.id} />
                <button type="submit" className="btn btn-quiet">
                  {a.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form action={createAlert} className="panel-grid" aria-labelledby="alert-new">
        <input type="hidden" name="lang" value={lang} />
        <h3 id="alert-new" className="panel-span">
          {a.createTitle}
        </h3>
        <fieldset className="fieldset">
          <legend>{a.workModes}</legend>
          {MODES.map((mode) => (
            <div key={mode} className="field field-inline">
              <input id={`mode-${mode}`} name={`mode-${mode}`} type="checkbox" />
              <label htmlFor={`mode-${mode}`}>{m.missions.workModes[mode]}</label>
            </div>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="alert-city">{a.city}</label>
          <input id="alert-city" name="city" type="text" maxLength={120} autoComplete="address-level2" />
        </div>
        <div className="field">
          <label htmlFor="alert-skills">{a.skills}</label>
          <input id="alert-skills" name="skills" type="text" maxLength={700} aria-describedby="alert-skills-hint" />
          <p id="alert-skills-hint" className="field-hint">
            {a.skillsHint}
          </p>
        </div>
        <div className="field">
          <label htmlFor="alert-rate">{a.minRate}</label>
          <input id="alert-rate" name="minRate" type="text" inputMode="decimal" maxLength={12} />
        </div>
        <div className="field">
          <label htmlFor="alert-duration">{a.maxDuration}</label>
          <input id="alert-duration" name="maxDuration" type="number" min={1} max={600} step={1} inputMode="numeric" />
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn btn-primary">
            {a.create}
          </button>
        </div>
      </form>
    </section>
  );
}

/** What Proofseen e-mails the person, and, for a freelancer, the mission searches they follow. */
export default async function AlertsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const side = market.person.role === "company" ? "company" : "freelance";
  const [preferences, alerts] = await Promise.all([
    notifications(market.db).preferences(market.actor),
    side === "freelance" ? missionAlerts(market.db).list(market.actor) : Promise.resolve([]),
  ]);
  const { erreur, enregistre, alerte } = await searchParams;
  const e = m.account.emails;
  const alertError = alerte === "limite" ? m.account.alerts.limit : alerte === "invalide" ? m.account.alerts.invalid : null;

  return (
    <>
      <header className="app-head">
        <h1>{m.account.alerts.title}</h1>
        <p className="muted measure">{m.account.alerts.lead}</p>
      </header>
      {erreur === "trop" ? (
        <p className="form-error" role="alert">
          {m.team.errors.tooMany}
        </p>
      ) : enregistre === undefined ? null : (
        <p className="form-ok" role="status">
          {e.saved}
        </p>
      )}
      <form action={saveEmailPreferences} className="panel" aria-labelledby="emails-title">
        <input type="hidden" name="lang" value={lang} />
        <h2 id="emails-title">{e.title}</h2>
        <p className="muted measure">{e.lead}</p>
        <fieldset className="fieldset">
          <legend className="sr-only">{e.title}</legend>
          {KINDS[side].map((kind) => (
            <div key={kind} className="field field-inline">
              <input type="hidden" name="shown" value={kind} />
              <input id={`email-${kind}`} name={kind} type="checkbox" defaultChecked={preferences[kind]} />
              <label htmlFor={`email-${kind}`}>{e.kinds[kind]}</label>
            </div>
          ))}
        </fieldset>
        <button type="submit" className="btn">
          {e.save}
        </button>
      </form>
      {side === "freelance" ? <Alerts lang={lang} m={m} alerts={alerts} error={alertError} /> : null}
    </>
  );
}
