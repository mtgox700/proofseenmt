import Link from "next/link";
import { notFound } from "next/navigation";
import { CountUp } from "@/components/motion/CountUp";
import { InView } from "@/components/motion/InView";
import { DossierPath } from "@/components/workspace/DossierPath";
import { EmptyState } from "@/components/EmptyState";
import { getClientSource } from "@/data/client-source";
import { operatorOverview, referenceForEmail } from "@/data/operator-source";
import { dictionary, isLang, type Dictionary, type Lang } from "@/i18n";
import { date } from "@/lib/format";
import { greetingName } from "@/lib/greeting";
import { readHomeNotice, type HomeNotice } from "@/lib/home-notice";
import { requirePerson, type Person } from "@/lib/session";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { CompanyHomeBoard } from "@/components/insights/CompanyHomeBoard";
import { FreelanceHomeBoard } from "@/components/insights/FreelanceHomeBoard";
import { FreelanceMissionsForYou } from "@/components/market/MissionsForYou";
import { marketDictionary } from "@/i18n/market";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { createOrganisation } from "./actions";

/** Depends on who is signed in (and on whether sign-in is configured): rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; avis?: string }>;
}

const KINDS = ["startup", "scaleup", "pme", "eti", "grand_groupe", "esn", "editeur_logiciel", "secteur_public", "association"] as const;

const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr-FR", en: "en-GB" };
const euros = (cents: number, lang: Lang): string =>
  new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100).replace(/\u00a0/g, "\u202f");

async function OperatorHome({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const o = t.app.operator;
  const { views, summary, gate, delivery } = await operatorOverview();
  return (
    <>
      <header className="app-head">
        <h1>{o.title}</h1>
      </header>

      <InView className="tiles">
        <div className="tile" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="tile-label">{o.files}</span>
          <b className="tile-value">
            <CountUp display={String(summary.total)} to={summary.total} locale={LOCALE[lang]} />
          </b>
          <span className="tile-foot muted">
            {summary.waitingOnClient} · {o.waitingClient}
          </span>
        </div>
        <div className="tile" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="tile-label">{o.complete}</span>
          <b className="tile-value num">{summary.complete}</b>
          <span className="tile-foot muted">
            {summary.total - summary.complete - summary.waitingOnClient} · {o.waitingUs}
          </span>
        </div>
        <div className="tile tile-wide" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="tile-label">{o.gateTitle}</span>
          {gate === null ? (
            <span className="muted small">{o.journalUnreadable}</span>
          ) : (
            <>
              <b className="tile-value num">
                {gate.counted}
                <small className="muted"> / {gate.target}</small>
              </b>
              <span className="gate-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${Math.min(1, gate.counted / gate.target)})` }} />
                <span className="gate-provisional" style={{ transform: `scaleX(${Math.min(1, (gate.counted + gate.provisional) / gate.target)})` }} />
              </span>
              <span className="tile-foot muted">
                {o.gateCounted} · {gate.provisional} {o.gateProvisional} · {o.revenue} {euros(gate.revenueCents, lang)}
              </span>
            </>
          )}
        </div>
        <div className="tile" style={{ "--i": 3 } as React.CSSProperties}>
          <span className="tile-label">{o.deliveryTitle}</span>
          {delivery === null ? (
            <span className="muted small">{o.journalUnreadable}</span>
          ) : (
            <>
              <b className="tile-value num">{delivery.pending}</b>
              <span className="tile-foot muted">
                {o.pending} · {delivery.dueSoon} {o.dueSoon}
                {delivery.overdue > 0 ? ` · ${delivery.overdue} ${o.overdue}` : ""}
              </span>
            </>
          )}
        </div>
      </InView>

      <section className="ws-block" aria-labelledby="files-title">
        <h2 id="files-title">{o.tableTitle}</h2>
        {views.length === 0 ? (
          <EmptyState title={o.empty} headingLevel={3}>
            {null}
          </EmptyState>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="files-title">
            <table className="ops">
              <thead>
                <tr>
                  <th scope="col">{o.table.ref}</th>
                  <th scope="col">{o.table.name}</th>
                  <th scope="col">{o.table.next}</th>
                  <th scope="col">{o.table.who}</th>
                  <th scope="col">{o.table.wave}</th>
                  <th scope="col" className="num-col">{o.table.reports}</th>
                </tr>
              </thead>
              <tbody>
                {views.map((view) => (
                  <tr key={view.reference} data-actor={view.complete ? "done" : view.actor}>
                    <th scope="row">
                      <code>{view.reference}</code>
                    </th>
                    <td>{view.displayName ?? <span className="muted">{o.unnamed}</span>}</td>
                    <td>{o.actions[view.action.kind] ?? view.action.kind}</td>
                    <td>
                      <span className={view.complete ? "tag tag-quiet" : view.actor === "client" ? "tag tag-signal" : "tag tag-proof"}>
                        {view.complete ? o.complete : view.actor === "client" ? t.space.yours : t.space.ours}
                      </span>
                    </td>
                    <td>{view.waveId === null ? "" : <code>{view.waveId}</code>}</td>
                    <td className="num num-col">{view.reportFiles.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** The sentence after a one-click action of the home (publish, availability), from a known code only. */
function HomeNoticeLine({ lang, notice }: { readonly lang: Lang; readonly notice: HomeNotice | null }) {
  if (notice === null) return null;
  const s = marketDictionary(lang).insights.stage;
  const text = { publie: s.published, masque: s.publishedButModerated, "dispo-confirmee": s.availability.confirmed, indisponible: s.availability.unavailable }[notice];
  return (
    <p className={notice === "masque" ? "form-error" : "form-ok"} role="status">
      {text}
    </p>
  );
}

async function FreelanceHome({ lang, t, person, notice }: { readonly lang: Lang; readonly t: Dictionary; readonly person: Person; readonly notice: HomeNotice | null }) {
  const f = t.app.freelance;
  const reference = await referenceForEmail(person.email);
  const view = reference === null ? null : await getClientSource().view(reference);
  return (
    <>
      <header className="app-head">
        {/* The first name, else the display name, else a neutral greeting: never the e-mail address (C23). */}
        <h1>{f.title(greetingName({ firstName: person.firstName, displayName: view?.displayName ?? person.name }))}</h1>
        {view === null ? null : (
          <dl className="meta-strip">
            <div>
              <dt>{t.space.reference}</dt>
              <dd>
                <code>{view.reference}</code>
              </dd>
            </div>
            <div>
              <dt>{t.space.steps.possession.title}</dt>
              <dd className="num">{t.space.urls(view.facts.verifiedUrls, view.facts.ownedUrls)}</dd>
            </div>
            {view.surfaceCheckedAt === null ? null : (
              <div>
                <dt>{t.space.steps.surface.title}</dt>
                <dd>{date(view.surfaceCheckedAt, lang)}</dd>
              </div>
            )}
          </dl>
        )}
      </header>
      <HomeNoticeLine lang={lang} notice={notice} />
      <FreelanceHomeBoard lang={lang} />
      <FreelanceMissionsForYou lang={lang} />
      {view === null ? (
        <p className="muted small">
          <Link href={`/${lang}/inscription`}>{marketDictionary(lang).profile.homeAudit}</Link>
        </p>
      ) : (
        <section className="ws-block" aria-labelledby="path-title">
          <h2 id="path-title">{view.complete ? t.space.allDone : t.space.pathTitle}</h2>
          <DossierPath t={t.space} action={view.action} />
        </section>
      )}
    </>
  );
}

/** The company form, shown until the account has created its company: nothing else works without one. */
function CreateOrganisation({ lang, error }: { readonly lang: Lang; readonly error: string | undefined }) {
  const m = marketDictionary(lang).company;
  const message = error === undefined ? null : error === "trop" ? m.errors.tooMany : error === "siret" ? m.errors.siret : m.errors.invalid;
  return (
    <form action={createOrganisation} className="panel" aria-labelledby="org-title">
      <input type="hidden" name="lang" value={lang} />
      <h2 id="org-title">{m.createTitle}</h2>
      <p className="muted measure">{m.createLead}</p>
      {message === null ? null : (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="org-name">{m.name}</label>
          <input id="org-name" name="name" type="text" required minLength={2} maxLength={200} autoComplete="organization" aria-describedby="org-name-hint" />
          <p id="org-name-hint" className="field-hint">{m.nameHint}</p>
        </div>
        <div className="field">
          <label htmlFor="org-kind">{m.kind}</label>
          <select id="org-kind" name="kind" required defaultValue="pme">
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {m.kinds[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="org-siret">{m.siret}</label>
          <input id="org-siret" name="siret" type="text" inputMode="numeric" pattern="[0-9 ]{14,17}" maxLength={17} aria-describedby="org-siret-hint" />
          <p id="org-siret-hint" className="field-hint">{m.siretHint}</p>
        </div>
      </div>
      <button type="submit" className="btn btn-primary">
        {m.create}
      </button>
    </form>
  );
}

async function CompanyHome({ lang, t, person, error }: { readonly lang: Lang; readonly t: Dictionary; readonly person: Person; readonly error: string | undefined }) {
  const c = t.app.company;
  const m = marketDictionary(lang);
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const organisation = await currentOrganisation(market);
  return (
    <>
      <header className="app-head">
        <h1>{c.title(greetingName({ firstName: person.firstName, displayName: person.name }))}</h1>
        {organisation === null ? null : (
          <p className="org-card">
            <strong>{organisation.name}</strong>
            <span className="tag tag-quiet">{m.company.kinds[organisation.kind]}</span>
            <span className="muted small">{m.company.roles[organisation.role]}</span>
          </p>
        )}
        <p className="muted measure">{c.lead}</p>
      </header>
      {organisation === null ? <CreateOrganisation lang={lang} error={error} /> : <CompanyHomeBoard lang={lang} market={market} organisationId={organisation.id} />}
      <form className="filters" method="get" action={`/${lang}/app/recherche`} role="search" aria-label={c.search}>
        <div className="field">
          <label htmlFor="skill">{t.directory.form.skill}</label>
          <input id="skill" name="competences" type="search" maxLength={200} aria-describedby="skill-hint" />
          <p id="skill-hint" className="field-hint">{t.directory.form.skillHint}</p>
        </div>
        <div className="field">
          <label htmlFor="area">{t.directory.form.area}</label>
          <input id="area" name="ville" type="search" maxLength={120} aria-describedby="area-hint" />
          <p id="area-hint" className="field-hint">{t.directory.form.areaHint}</p>
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn btn-primary">{c.search}</button>
        </div>
      </form>
    </>
  );
}

export default async function AppHome({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const person = await requirePerson(lang);
  if (person === null) return null;
  if (person.role === "operator") return <OperatorHome lang={lang} t={t} />;
  const query = await searchParams;
  if (person.role === "company") return <CompanyHome lang={lang} t={t} person={person} error={query.erreur} />;
  return <FreelanceHome lang={lang} t={t} person={person} notice={readHomeNotice(query.avis)} />;
}
