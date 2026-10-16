import { notFound } from "next/navigation";
import { proofDisputes, registryDesk, vigilanceDesk } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { CompanySearch } from "@/components/operator/CompanySearch";
import { Outcome } from "@/components/operator/OperatorParts";
import { VerificationQueues } from "@/components/operator/VerificationQueues";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";
import { companyRows } from "@/lib/company-rows";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string; registre?: string }>;
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
  const { etat, registre } = await searchParams;
  const now = new Date();
  const [attestations, disputes, companies] = await Promise.all([
    vigilanceDesk(context.db, context.operator).pending(now),
    proofDisputes(context.db, context.operator).list(),
    registryDesk(context.db, context.operator).list(),
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
        <CompanySearch lang={lang} o={o} initial={companyRows(companies)} />
      </section>
    </>
  );
}
