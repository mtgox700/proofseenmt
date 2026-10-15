import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { LiveCounts } from "@proofseen/db";
import { LiveCount } from "@/components/live/LiveCount";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { WorkspaceNav, type NavItem } from "@/components/workspace/WorkspaceNav";
import type { Dictionary, Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { Person } from "@/lib/session";

interface AppShellProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly person: Person;
  /** Unread messages and notifications at render time; `null` when they could not be read (C15). */
  readonly counts?: LiveCounts | null;
  readonly children: React.ReactNode;
}

/** Navigation by role: what someone sees in the menu is exactly what the server will let them open. */
const itemsFor = (lang: Lang, t: Dictionary, person: Person, counts: LiveCounts | null): NavItem[] => {
  const base = `/${lang}/app`;
  const home = { href: base, label: t.app.nav.home };
  const messages: NavItem = { href: `${base}/messages`, label: t.app.nav.messages, live: { which: "messages", initial: counts?.messages ?? 0, label: marketDictionary(lang).live.unreadLabel } };
  const m = marketDictionary(lang).missions.nav;
  if (person.role === "operator") return [home, { href: `${base}/operateur`, label: marketDictionary(lang).operator.nav }, messages, { href: `${base}/articles`, label: marketDictionary(lang).articles.nav }, { href: `/${lang}/freelances`, label: t.app.nav.directory }];
  const billing = { href: `${base}/facturation`, label: marketDictionary(lang).billing.nav };
  const deals = marketDictionary(lang).deals;
  const alertsItem = { href: `${base}/alertes`, label: marketDictionary(lang).account.alerts.nav };
  const settingsItem = { href: `${base}/reglages`, label: marketDictionary(lang).settings.nav };
  const contractsItem = { href: `${base}/contrats`, label: deals.contracts.nav };
  const invoicesItem = { href: `${base}/factures`, label: deals.invoices.nav };
  const search = marketDictionary(lang).search;
  if (person.role === "company") return [home, { href: `${base}/recherche`, label: search.nav }, { href: `${base}/listes`, label: search.lists.nav }, { href: `${base}/missions`, label: m.company }, messages, contractsItem, invoicesItem, billing, { href: `${base}/equipe`, label: marketDictionary(lang).team.nav }, { href: `${base}/confirmations`, label: marketDictionary(lang).confirmations.nav }, alertsItem, settingsItem];
  const visibilityItem = { href: `${base}/visibilite`, label: marketDictionary(lang).visibility.nav };
  return [home, { href: `${base}/profil`, label: marketDictionary(lang).profile.nav }, visibilityItem, { href: `${base}/preuves`, label: marketDictionary(lang).proofs.nav }, { href: `${base}/missions`, label: m.freelance }, messages, contractsItem, invoicesItem, billing, alertsItem, settingsItem, { href: `/${lang}/missions`, label: marketDictionary(lang).nav.missions }];
};

export function AppShell({ lang, t, person, counts = null, children }: AppShellProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  const live = marketDictionary(lang).live;
  return (
    <div className="app">
      <header className="app-top">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Logo />
          <span>Proofseen</span>
        </Link>
        <div className="app-top-right">
          {person.role === null ? null : <span className="tag tag-quiet">{t.app.roles[person.role]}</span>}
          {person.role === null ? null : (
            <Link className="app-bell" href={`/${lang}/app/notifications`}>
              {live.bell}
              <LiveCount which="notifications" initial={counts?.notifications ?? 0} label={live.unreadLabel} />
            </Link>
          )}
          <nav className="nav" aria-label={t.nav.otherLangLabel}>
            <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
          </nav>
          <UserButton />
        </div>
      </header>
      <div className="app-body">
        <aside className="app-side">
          <WorkspaceNav items={itemsFor(lang, t, person, counts)} label={t.app.nav.label} />
        </aside>
        <main id="contenu" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
