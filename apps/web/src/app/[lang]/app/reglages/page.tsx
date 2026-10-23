import "@/styles/insights.css";
import "@/styles/app-compte.css";
import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { organisations, users, type OrganisationRecord } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { EraseAccount } from "@/components/settings/EraseAccount";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { SettingsDictionary } from "@/i18n/market/settings-fr";
import { authConfigured } from "@/lib/auth-config";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { ERASE_WORDS } from "@/lib/settings";
import { chooseOrganisation, saveEmailLanguage } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ reglage?: string }>;
}

function Notice({ s, code }: { readonly s: SettingsDictionary; readonly code: string | undefined }) {
  if (code === "langue") return <p className="form-ok" role="status">{s.saved.language}</p>;
  if (code === "entreprise") return <p className="form-ok" role="status">{s.saved.organisation}</p>;
  if (code === "trop") return <p className="form-error" role="alert">{s.errors.throttled}</p>;
  if (code === "invalide") return <p className="form-error" role="alert">{s.errors.invalid}</p>;
  return null;
}

function LanguageForm({ lang, s, current }: { readonly lang: Lang; readonly s: SettingsDictionary; readonly current: "fr" | "en" }) {
  return (
    <form action={saveEmailLanguage} className="panel" aria-labelledby="langue">
      <input type="hidden" name="lang" value={lang} />
      <h2 id="langue">{s.language.title}</h2>
      <p className="muted measure">{s.language.lead}</p>
      <div className="settings-row">
        <div className="field">
          <label htmlFor="email-lang">{s.language.label}</label>
          <select id="email-lang" name="emailLang" defaultValue={current}>
            <option value="fr" lang="fr">
              {s.language.options.fr}
            </option>
            <option value="en" lang="en">
              {s.language.options.en}
            </option>
          </select>
        </div>
        <button type="submit" className="btn">
          {s.language.save}
        </button>
      </div>
    </form>
  );
}

function OrganisationForm({ lang, s, mine, current }: { readonly lang: Lang; readonly s: SettingsDictionary; readonly mine: readonly OrganisationRecord[]; readonly current: string | null }) {
  return (
    <form action={chooseOrganisation} className="panel" aria-labelledby="entreprise">
      <input type="hidden" name="lang" value={lang} />
      <h2 id="entreprise">{s.organisation.title}</h2>
      <p className="muted measure">{s.organisation.lead}</p>
      <div className="settings-row">
        <div className="field">
          <label htmlFor="organisation-id">{s.organisation.label}</label>
          <select id="organisation-id" name="organisationId" defaultValue={current ?? undefined}>
            {mine.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">
          {s.organisation.save}
        </button>
      </div>
    </form>
  );
}

/** Account settings: e-mail language, notifications, sign-in, company, export and erasure of the person's data. */
export default async function SettingsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const s = m.settings;
  const market = await pageMarket(lang, ["freelance", "company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const [emailLang, mine, current] = await Promise.all([
    users(market.db).lang(market.actor.userId),
    market.person.role === "company" ? organisations(market.db).listMine(market.actor) : Promise.resolve([]),
    market.person.role === "company" ? currentOrganisation(market) : Promise.resolve(null),
  ]);
  const word = ERASE_WORDS[lang];
  return (
    <>
      <header className="app-head">
        <h1>{s.title}</h1>
        <p className="muted measure">{s.lead}</p>
      </header>
      <Notice s={s} code={(await searchParams).reglage} />
      <LanguageForm lang={lang} s={s} current={emailLang} />
      <section className="panel" aria-labelledby="notifications">
        <h2 id="notifications">{s.notifications.title}</h2>
        <p className="muted measure">{s.notifications.lead}</p>
        <p>
          <Link className="btn" href={`/${lang}/app/alertes`}>
            {s.notifications.link}
          </Link>
        </p>
      </section>
      {mine.length > 1 ? <OrganisationForm lang={lang} s={s} mine={mine} current={current?.id ?? null} /> : null}
      <section className="panel" aria-labelledby="connexion">
        <h2 id="connexion">{s.account.title}</h2>
        <p className="muted measure">{s.account.lead}</p>
        {authConfigured() ? (
          <div className="settings-clerk">
            <UserProfile routing="hash" />
          </div>
        ) : null}
      </section>
      <section className="panel" aria-labelledby="donnees">
        <h2 id="donnees">{s.data.title}</h2>
        <p className="muted measure">{s.data.lead}</p>
        <p>
          {/* A plain download of the existing GDPR route: works without JavaScript, the session cookie authenticates it. */}
          <a className="btn" href="/api/me" download>
            {s.data.export}
          </a>
        </p>
      </section>
      <section className="panel settings-danger" aria-labelledby="suppression">
        <h2 id="suppression">{s.erase.title}</h2>
        <p className="measure">{s.erase.lead}</p>
        <p className="muted measure">{s.erase.blocked}</p>
        <EraseAccount
          lang={lang}
          texts={{ confirmLabel: s.erase.confirmLabel(word), submit: s.erase.submit, pending: s.erase.pending, mismatch: s.erase.mismatch(word), done: s.erase.done, outcomes: s.erase.outcomes }}
        />
      </section>
    </>
  );
}
