import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
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
  readonly children: React.ReactNode;
}

/** Navigation by role: what someone sees in the menu is exactly what the server will let them open. */
const itemsFor = (lang: Lang, t: Dictionary, person: Person): NavItem[] => {
  const base = `/${lang}/app`;
  const home = { href: base, label: t.app.nav.home };
  const messages = { href: `${base}/messages`, label: t.app.nav.messages };
  const m = marketDictionary(lang).missions.nav;
  if (person.role === "operator") return [home, messages, { href: `/${lang}/entreprise`, label: t.app.nav.directory }];
  const billing = { href: `${base}/facturation`, label: marketDictionary(lang).billing.nav };
  if (person.role === "company") return [home, { href: `${base}/missions`, label: m.company }, messages, billing, { href: `/${lang}/entreprise`, label: t.app.nav.directory }];
  return [home, { href: `${base}/profil`, label: marketDictionary(lang).profile.nav }, { href: `${base}/missions`, label: m.freelance }, messages, billing, { href: `/${lang}/missions`, label: marketDictionary(lang).nav.missions }];
};

export function AppShell({ lang, t, person, children }: AppShellProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return (
    <div className="app">
      <header className="app-top">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Logo />
          <span>Proofseen</span>
        </Link>
        <div className="app-top-right">
          {person.role === null ? null : <span className="tag tag-quiet">{t.app.roles[person.role]}</span>}
          <nav className="nav" aria-label={t.nav.otherLangLabel}>
            <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
          </nav>
          <UserButton />
        </div>
      </header>
      <div className="app-body">
        <aside className="app-side">
          <WorkspaceNav items={itemsFor(lang, t, person)} label={t.app.nav.label} />
        </aside>
        <main id="contenu" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
