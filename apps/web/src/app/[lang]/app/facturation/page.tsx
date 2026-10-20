import { notFound } from "next/navigation";
import { billingView, profiles, vigilance, type FreelanceIdentityView, type RegistryView } from "@proofseen/db";
import { BillingForm } from "@/components/market/BillingForm";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { PayoutAccountButton } from "@/components/market/PayoutAccountButton";
import { StandingNotice } from "@/components/market/StandingNotice";
import { paymentsUi } from "@/data/payments-config";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { BillingDictionary } from "@/i18n/market/billing-fr";
import { date, day } from "@/lib/format";
import { currentOrganisation, pageMarket, type Market } from "@/lib/market";
import { payoutState } from "@/lib/pay-section";
import { declareVigilance, saveBilling } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistre?: string; vigilance?: string; versement?: string }>;
}

const Feedback = ({ error, ok }: { readonly error: string | null; readonly ok: string | null }) =>
  error !== null ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : ok !== null ? (
    <p className="form-ok" role="status">
      {ok}
    </p>
  ) : null;

function Registry({ lang, b, registry, hasSiret }: { readonly lang: Lang; readonly b: BillingDictionary; readonly registry: RegistryView; readonly hasSiret: boolean }) {
  if (!hasSiret) return null;
  const text = registry.status === null ? b.registry.pending : b.registry[registry.status];
  return (
    <p className={registry.status === "active" || registry.status === null ? "muted small" : "form-error"}>
      {text}
      {registry.checkedAt === null ? null : ` · ${b.registry.checkedOn} ${day(registry.checkedAt, lang)}`}
    </p>
  );
}

/** Where the freelancer's missions are paid out: an account they open and fill in on Stripe's side, never here. */
function PayoutAccount({ lang, b, identity, back }: { readonly lang: Lang; readonly b: BillingDictionary; readonly identity: FreelanceIdentityView | null; readonly back: string | undefined }) {
  const p = b.payouts;
  const ui = paymentsUi();
  const state = payoutState(identity);
  const label = state === "none" ? p.open : state === "incomplete" ? p.resume : p.update;
  return (
    <section className="panel" aria-labelledby="payout-title">
      <h2 id="payout-title">{p.title}</h2>
      <p className="muted measure">{p.lead}</p>
      <p>{p.states[state]}</p>
      {ui === null ? (
        <p className="muted small">{p.closed}</p>
      ) : (
        <>
          {ui.testMode ? (
            <p className="form-ok" role="note">
              {p.testMode}
            </p>
          ) : null}
          {back === "retour" && state !== "ready" ? (
            <p className="muted small" role="status">
              {p.returned}
            </p>
          ) : null}
          {back === "expire" ? (
            <p className="form-error" role="alert">
              {p.expired}
            </p>
          ) : null}
          {identity === null ? <p className="muted small">{p.identityFirst}</p> : <PayoutAccountButton lang={lang} label={label} payouts={p} />}
        </>
      )}
    </section>
  );
}

async function Vigilance({ lang, b, market, code }: { readonly lang: Lang; readonly b: BillingDictionary; readonly market: Market; readonly code: string | undefined }) {
  const v = b.vigilance;
  const profile = await profiles(market.db).findMine(market.actor);
  if (profile === null) return null;
  const status = await vigilance(market.db).status(profile.id, new Date());
  const error = code === "expired" ? v.errors.expired : code === "future" ? v.errors.future : code === "invalide" || code === "trop" ? v.errors.invalid : null;
  return (
    <section className="panel" aria-labelledby="vigilance-title">
      <h2 id="vigilance-title">{v.title}</h2>
      <p className="muted measure">{v.lead}</p>
      <p>
        {status.state === "missing" ? v.states.missing : `${v.states[status.state]} ${status.expiresOn === null ? "" : date(status.expiresOn.toISOString(), lang)}`}
        {status.state === "valid" ? <span className="muted"> · {status.verified ? v.verified : v.unverified}</span> : null}
      </p>
      <Feedback error={error} ok={code === "ok" ? v.saved : null} />
      <form action={declareVigilance} className="panel-grid">
        <input type="hidden" name="lang" value={lang} />
        <div className="field">
          <label htmlFor="issuedOn">{v.issuedOn}</label>
          <input id="issuedOn" name="issuedOn" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="securityCode">{v.securityCode}</label>
          <input id="securityCode" name="securityCode" type="text" required maxLength={60} autoCapitalize="characters" aria-describedby="code-hint" />
          <p id="code-hint" className="field-hint">{v.securityCodeHint}</p>
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn">
            {v.declare}
          </button>
        </div>
      </form>
    </section>
  );
}

/** The person's billing identity: their own as a freelancer, their company's as an owner or administrator. */
export default async function BillingPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const market = await pageMarket(lang, ["company", "freelance"]);
  const dict = marketDictionary(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const b = dict.billing;
  const { erreur, enregistre, vigilance: vigilanceCode, versement } = await searchParams;
  const errors: Readonly<Record<string, string>> = { invalide: b.errors.invalid, siret: b.errors.siretTaken, profil: b.errors.noProfile, trop: b.errors.tooMany, admin: b.errors.notAdmin };
  const error = erreur === undefined ? null : (errors[erreur] ?? b.errors.invalid);
  const ok = enregistre === undefined ? null : b.saved;
  const view = billingView(market.db);

  if (market.person.role === "company") {
    const organisation = await currentOrganisation(market);
    const identity = organisation === null ? null : await view.organisation(market.actor, organisation.id);
    return (
      <>
        <header className="app-head">
          <h1>{b.title}</h1>
          <p className="muted measure">{b.leadCompany}</p>
        </header>
        <Feedback error={error} ok={ok} />
        {organisation !== null && identity === null ? (
          <p className="muted">{b.errors.notAdmin}</p>
        ) : (
          <>
            {identity === null ? null : <Registry lang={lang} b={b} registry={identity.registry} hasSiret={identity.siret !== null} />}
            <BillingForm lang={lang} b={b} action={saveBilling} values={identity === null ? null : { ...identity, vatRateBp: 0 }} freelance={false} mandateAt={null} />
          </>
        )}
      </>
    );
  }

  const identity = await view.freelance(market.actor);
  return (
    <>
      <header className="app-head">
        <h1>{b.title}</h1>
        <p className="muted measure">{b.leadFreelance}</p>
      </header>
      <StandingNotice lang={lang} market={market} topics={["vigilance"]} />
      <Feedback error={error} ok={ok} />
      {identity === null ? null : <Registry lang={lang} b={b} registry={identity.registry} hasSiret={identity.siret !== null} />}
      <PayoutAccount lang={lang} b={b} identity={identity} back={versement} />
      <BillingForm lang={lang} b={b} action={saveBilling} values={identity} freelance mandateAt={identity?.invoicingMandateAt === null || identity === null ? null : day(identity.invoicingMandateAt, lang)} />
      <Vigilance lang={lang} b={b} market={market} code={vigilanceCode} />
    </>
  );
}
