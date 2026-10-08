import Link from "next/link";
import { notFound } from "next/navigation";
import { inbox } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { contactProfile } from "../../messages/actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; reference: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

const MAX_BODY = 10_000;

const errorText = (code: string | undefined, m: MarketDictionary): string | null => {
  const c = m.contact;
  const map: Readonly<Record<string, string>> = { trop: c.tooMany, invalide: c.invalid, coordonnees: c.contactBlocked, limite: c.limit, entreprise: c.noOrganisation };
  return code === undefined ? null : (map[code] ?? c.invalid);
};

/** A company's first message to a published profile, reached from the profile's public page. */
export default async function ContactPage({ params, searchParams }: PageProps) {
  const { lang, reference } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  // A malformed escape in the address is a page that does not exist, not a server error.
  const decoded = (() => {
    try {
      return decodeURIComponent(reference);
    } catch {
      return null;
    }
  })();
  const target = decoded === null ? null : await inbox(market.db).contactTarget(decoded);
  if (target === null) notFound();
  const error = errorText((await searchParams).erreur, m);

  const header = (
    <header className="app-head">
      <h1>{m.contact.title(target.reference)}</h1>
      {target.headline === null ? null : <p className="muted">{target.headline}</p>}
    </header>
  );

  if (market.person.role !== "company") {
    return (
      <>
        {header}
        <p className="muted">{m.contact.notCompany}</p>
      </>
    );
  }
  if ((await currentOrganisation(market)) === null) {
    return (
      <>
        {header}
        <p className="measure">{m.contact.noOrganisation}</p>
        <p>
          <Link className="btn btn-primary" href={`/${lang}/app`}>
            {m.company.createTitle}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      {header}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form action={contactProfile} className="panel">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="reference" value={target.reference} />
        <p className="muted measure">{m.contact.lead}</p>
        <div className="field">
          <label htmlFor="body">{m.contact.body}</label>
          <textarea id="body" name="body" required maxLength={MAX_BODY} rows={6} />
        </div>
        <button type="submit" className="btn btn-primary">
          {m.contact.send}
        </button>
      </form>
    </>
  );
}
