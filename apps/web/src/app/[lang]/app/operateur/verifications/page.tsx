import { notFound } from "next/navigation";
import { proofDisputes, registryDesk, vigilanceDesk } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome } from "@/components/operator/OperatorParts";
import { VerificationQueues } from "@/components/operator/VerificationQueues";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { recheckCompany } from "../verification-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string; registre?: string; q?: string }>;
}

const REGISTRY_OUTCOMES = new Set(["recorded", "attempted", "changed"]);

/** URSSAF certificates, contested address proofs and companies in the registry. */
export default async function VerificationsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const v = o.verifications;
  const { etat, registre, q } = await searchParams;
  const now = new Date();
  const [attestations, disputes, companies] = await Promise.all([
    vigilanceDesk(context.db, context.operator).pending(now),
    proofDisputes(context.db, context.operator).list(),
    registryDesk(context.db, context.operator).list(q ?? ""),
  ]);
  const registryNotice = registre === undefined ? null : REGISTRY_OUTCOMES.has(registre) ? v[registre as "recorded" | "attempted" | "changed"] : null;

  return (
    <>
      <header className="app-head">
        <h1>{v.title}</h1>
      </header>
      <Outcome flag={etat ?? (registryNotice === null ? registre : undefined)} o={o} />
      <VerificationQueues lang={lang} o={o} attestations={attestations} disputes={disputes} />
      <section className="panel" id="entreprises" aria-labelledby="companies-title">
        <h2 id="companies-title">{v.companiesTitle}</h2>
        <p className="muted measure">{v.companiesLead}</p>
        {registryNotice === null ? null : (
          <p className={registre === "recorded" ? "form-ok" : "form-error"} role="status">
            {registryNotice}
          </p>
        )}
        <form method="get" className="op-forms">
          <div className="field">
            <label htmlFor="company-search">{v.search}</label>
            <input id="company-search" name="q" type="text" defaultValue={q ?? ""} maxLength={120} />
          </div>
          <button type="submit" className="btn">
            {o.common.filter}
          </button>
        </form>
        <div className="op-table-wrap">
          <table className="op-table">
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.moderatedAt === null ? null : <span className="tag">{o.users.hiddenTag}</span>}
                  </td>
                  <td className="op-num">{c.siret ?? v.noSiret}</td>
                  <td>
                    {c.registryStatus === null ? v.never : v.status[c.registryStatus]}
                    {c.registryName === null ? null : <span className="muted small"> · {c.registryName}</span>}
                    {c.registryCheckedAt === null ? null : <span className="muted small"> · {day(c.registryCheckedAt, lang)}</span>}
                  </td>
                  <td>
                    {c.siret === null ? null : (
                      <form action={recheckCompany}>
                        <LangField lang={lang} />
                        <input type="hidden" name="organisationId" value={c.id} />
                        <button type="submit" className="btn btn-quiet">
                          {v.recheck}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
