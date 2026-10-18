import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiKeys, largeAccounts, organisationView, type ApiKeySummary, type MemberView, type PoolMember } from "@proofseen/db";
import { ApiKeyCreator } from "@/components/market/ApiKeyCreator";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { date, day } from "@/lib/format";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { addMember, removeMember, revokeApiKey, setApprovalLevels } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; ajoute?: string; validation?: string }>;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

function Members({ lang, m, members, admin }: { readonly lang: Lang; readonly m: MarketDictionary; readonly members: readonly MemberView[]; readonly admin: boolean }) {
  const t = m.team.members;
  return (
    <section className="panel" aria-labelledby="members-title">
      <h2 id="members-title">{t.title}</h2>
      <ul className="plain-list">
        {members.map((member) => (
          <li key={member.userId} className="org-member">
            <span>
              <strong>{member.displayName}</strong>
              {member.isMe ? <span className="muted"> ({t.you})</span> : null}
              {member.email === null ? null : <span className="muted small"> · {member.email}</span>}
            </span>
            <span className="tag tag-quiet">{m.company.roles[member.role]}</span>
            {member.isMe || (admin && member.role !== "owner") ? (
              <form action={removeMember}>
                <Hidden name="lang" value={lang} />
                <Hidden name="userId" value={member.userId} />
                <button type="submit" className="btn btn-quiet">
                  {member.isMe ? t.leave : t.remove}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {admin ? (
        <form action={addMember} className="panel-grid">
          <Hidden name="lang" value={lang} />
          <div className="field">
            <label htmlFor="member-email">{t.email}</label>
            <input id="member-email" name="email" type="email" required maxLength={320} autoComplete="off" aria-describedby="member-hint" />
          </div>
          <div className="field">
            <label htmlFor="member-role">{t.role}</label>
            <select id="member-role" name="role" defaultValue="member">
              <option value="member">{t.roles.member}</option>
              <option value="admin">{t.roles.admin}</option>
            </select>
          </div>
          <div className="filters-actions">
            <button type="submit" className="btn">
              {t.add}
            </button>
          </div>
          <p id="member-hint" className="field-hint">
            {t.addHint}
          </p>
        </form>
      ) : null}
    </section>
  );
}

function Approvals({ lang, m, levels, owner, error }: { readonly lang: Lang; readonly m: MarketDictionary; readonly levels: number; readonly owner: boolean; readonly error: string | null }) {
  const a = m.team.approvals;
  return (
    <section className="panel" aria-labelledby="approvals-title">
      <h2 id="approvals-title">{a.title}</h2>
      <p className="muted measure">{a.lead}</p>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form action={setApprovalLevels} className="panel-grid">
        <Hidden name="lang" value={lang} />
        <fieldset className="fieldset" disabled={!owner}>
          <legend className="sr-only">{a.title}</legend>
          {([1, 2] as const).map((value) => (
            <div key={value} className="field field-inline">
              <input id={`levels-${value}`} name="approvalLevels" type="radio" value={value} defaultChecked={levels === value} />
              <label htmlFor={`levels-${value}`}>{value === 1 ? a.one : a.two}</label>
            </div>
          ))}
        </fieldset>
        <div className="filters-actions">{owner ? <button type="submit" className="btn">{a.save}</button> : <p className="muted small">{a.ownerOnly}</p>}</div>
      </form>
    </section>
  );
}

function Pool({ lang, m, pool }: { readonly lang: Lang; readonly m: MarketDictionary; readonly pool: readonly PoolMember[] }) {
  const p = m.team.pool;
  return (
    <section className="panel" aria-labelledby="pool-title">
      <h2 id="pool-title">{p.title}</h2>
      <p className="muted measure">{p.lead}</p>
      {pool.length === 0 ? (
        <p className="muted">{p.empty}</p>
      ) : (
        <ul className="threads">
          {pool.map((freelance) => (
            <li key={freelance.profileId} className="thread-row">
              <span className="thread-who">
                <strong>{freelance.reference}</strong>
                {freelance.headline === null ? null : <span className="muted small"> · {freelance.headline}</span>}
              </span>
              <Link className="btn" href={`/${lang}/app/contact/${freelance.reference}`}>
                {p.write}
              </Link>
              <span className="thread-last muted small">
                {freelance.lastMissionStartedOn === null ? null : (
                  <>
                    {p.facts(freelance.paidMissions, freelance.totalDays)} · {p.last} {date(freelance.lastMissionStartedOn.toISOString(), lang)}
                  </>
                )}
                {freelance.invitedOn === null ? null : (
                  <>
                    {freelance.lastMissionStartedOn === null ? null : " · "}
                    {p.invited(date(freelance.invitedOn.toISOString(), lang))}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Keys({ lang, m, keys }: { readonly lang: Lang; readonly m: MarketDictionary; readonly keys: readonly ApiKeySummary[] }) {
  const k = m.team.keys;
  return (
    <section className="panel" aria-labelledby="keys-title">
      <h2 id="keys-title">{k.title}</h2>
      <p className="muted measure">{k.lead}</p>
      {keys.length === 0 ? null : (
        <ul className="plain-list">
          {keys.map((key) => (
            <li key={key.id} className="org-member">
              <span>
                <strong>{key.name}</strong> <code className="muted small">{key.prefix}…</code>
                <span className="muted small">
                  {" "}
                  · {k.created} {day(key.createdAt, lang)} · {key.lastUsedAt === null ? k.neverUsed : `${k.lastUsed} ${day(key.lastUsedAt, lang)}`}
                </span>
              </span>
              {key.revokedAt === null ? (
                <form action={revokeApiKey}>
                  <Hidden name="lang" value={lang} />
                  <Hidden name="keyId" value={key.id} />
                  <button type="submit" className="btn btn-quiet">
                    {k.revoke}
                  </button>
                </form>
              ) : (
                <span className="tag tag-quiet">{k.revoked}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <ApiKeyCreator lang={lang} k={k} errors={{ invalid: m.team.errors.invalid, tooMany: m.team.errors.tooMany, notAdmin: m.team.notAdmin }} />
      <p className="muted small">{k.docs}</p>
    </section>
  );
}

/** The company's administration, for its members; the sensitive parts for its owners and administrators only. */
export default async function TeamPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const admin = organisation.role === "owner" || organisation.role === "admin";
  const [members, levels, pool, keys] = await Promise.all([
    organisationView(market.db).members(market.actor, organisation.id),
    organisationView(market.db).approvalLevels(market.actor, organisation.id),
    largeAccounts(market.db).talentPool(market.actor, organisation.id),
    admin ? apiKeys(market.db).list(market.actor, organisation.id) : Promise.resolve(null),
  ]);
  const { erreur, ajoute, validation } = await searchParams;
  const error = erreur === undefined ? null : erreur === "trop" ? m.team.errors.tooMany : erreur === "proprietaire" ? m.team.members.lastOwner : m.team.errors.invalid;
  const approvalError = validation === "un" ? m.team.approvals.singleAdmin : validation === "proprietaire" ? m.team.approvals.ownerOnly : null;
  const e = m.team.export;

  return (
    <>
      <header className="app-head">
        <h1>{m.team.title}</h1>
        <p className="muted measure">{m.team.lead}</p>
        <p>
          <Link href={`/${lang}/app/equipe/page-publique`}>{m.missionsSpace.companyPage.link}</Link>
        </p>
      </header>
      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : ajoute === undefined ? null : (
        <p className="form-ok" role="status">
          {m.team.members.added}
        </p>
      )}
      {members === null ? null : <Members lang={lang} m={m} members={members} admin={admin} />}
      {levels === null ? null : <Approvals lang={lang} m={m} levels={levels} owner={organisation.role === "owner"} error={approvalError} />}
      <Pool lang={lang} m={m} pool={pool ?? []} />
      {admin && keys !== null ? (
        <>
          <Keys lang={lang} m={m} keys={keys} />
          <section className="panel" aria-labelledby="export-title">
            <h2 id="export-title">{e.title}</h2>
            <p className="muted measure">{e.lead}</p>
            <form method="get" action={`/api/organisations/${organisation.id}/accounting-export`} className="panel-grid">
              <div className="field">
                <label htmlFor="export-from">{e.from}</label>
                <input id="export-from" name="from" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="export-to">{e.to}</label>
                <input id="export-to" name="to" type="date" required />
              </div>
              <div className="filters-actions">
                <button type="submit" className="btn">
                  {e.download}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </>
  );
}
