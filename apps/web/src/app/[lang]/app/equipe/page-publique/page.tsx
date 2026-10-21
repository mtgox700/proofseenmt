import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { companyPages } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StandingNotice } from "@/components/market/StandingNotice";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { publishCompanyPage, unpublishCompanyPage } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistre?: string; retiree?: string }>;
}

/** The company's opt-in public page: off by default, turned on, edited and withdrawn by owners and administrators. */
export default async function CompanyPublicPageSettings({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const c = dict.missionsSpace.companyPage;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const settings = await companyPages(market.db).settings(market.actor, organisation.id);
  if (settings === null) notFound();
  const { erreur, enregistre, retiree } = await searchParams;
  const error = erreur === "invalide" ? c.invalid : erreur === "trop" ? c.tooMany : erreur === "droits" ? c.readOnly : null;
  const ok = enregistre !== undefined ? c.saved : retiree !== undefined ? c.removed : null;

  return (
    <>
      <p>
        <Link href={`/${lang}/app/equipe`}>← {dict.team.nav}</Link>
      </p>
      <header className="app-head">
        <h1>{c.title}</h1>
        <p className="muted measure">{c.lead}</p>
        <p className="thread-meta">
          <span className={settings.enabled ? "tag tag-done" : "tag tag-quiet"}>{settings.enabled ? c.enabled : c.disabled}</span>
          {settings.enabled && settings.slug !== null ? (
            <a href={`/${lang}/entreprises/${settings.slug}`}>{c.view}</a>
          ) : null}
        </p>
      </header>
      <StandingNotice lang={lang} market={market} topics={["company", "organisation"]} />
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {ok === null ? null : (
        <p className="form-ok" role="status">
          {ok}
        </p>
      )}
      {settings.canEdit ? (
        <>
          <form action={publishCompanyPage} className="panel">
            <input type="hidden" name="lang" value={lang} />
            <div className="field">
              <label htmlFor="publicName">{c.name}</label>
              <input id="publicName" name="publicName" type="text" required minLength={2} maxLength={200} defaultValue={settings.publicName} aria-describedby="publicName-hint" />
              <p id="publicName-hint" className="field-hint">{c.nameHint}</p>
            </div>
            <div className="field">
              <label htmlFor="description">{c.description}</label>
              <textarea id="description" name="description" maxLength={1000} rows={5} defaultValue={settings.description ?? ""} aria-describedby="description-hint" />
              <p id="description-hint" className="field-hint">{c.descriptionHint}</p>
            </div>
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="website">{c.website}</label>
                <input id="website" name="website" type="url" inputMode="url" maxLength={200} placeholder="https://" defaultValue={settings.website ?? ""} aria-describedby="website-hint" />
                <p id="website-hint" className="field-hint">{c.websiteHint}</p>
              </div>
              <div className="field">
                <label htmlFor="city">{c.city}</label>
                <input id="city" name="city" type="text" maxLength={120} autoComplete="address-level2" defaultValue={settings.city ?? ""} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              {settings.enabled ? c.update : c.publish}
            </button>
          </form>
          {settings.enabled ? (
            <form action={unpublishCompanyPage} className="panel">
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="btn btn-quiet" aria-describedby="unpublish-hint">
                {c.unpublish}
              </button>
              <p id="unpublish-hint" className="muted small">
                {c.unpublishHint}
              </p>
            </form>
          ) : null}
        </>
      ) : (
        <p className="muted">{c.readOnly}</p>
      )}
    </>
  );
}
