import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { LiveCounts } from "@proofseen/db";
import { LiveCount } from "@/components/live/LiveCount";
import { LangSwitch } from "@/components/LangSwitch";
import { Lockup } from "@/components/Lockup";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
import type { Dictionary, Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { Person } from "@/lib/session";
import { sectionsFor } from "./workspace-sections";

interface AppShellProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly person: Person;
  /** Unread messages and notifications at render time; `null` when they could not be read (C15). */
  readonly counts?: LiveCounts | null;
  readonly children: React.ReactNode;
}

/*
 * The frame of every connected page. The bar reads in the order of the markup: the lockup and the role, then the
 * notifications, the other language and the account (two lines on a phone, one from 64rem). The menu shows exactly
 * what the server will let this role open (`sectionsFor`).
 */
export function AppShell({ lang, t, person, counts = null, children }: AppShellProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  const market = marketDictionary(lang);
  const live = market.live;
  const sections = sectionsFor(lang, person.role, counts);
  return (
    <div className="app">
      <header className="app-top">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Lockup />
        </Link>
        {person.role === null ? null : <span className="tag tag-quiet app-role">{t.app.roles[person.role]}</span>}
        <div className="app-tools">
          {person.role === null ? null : (
            <Link className="app-bell" href={`/${lang}/app/notifications`}>
              {live.bell}
              <LiveCount which="notifications" initial={counts?.notifications ?? 0} label={live.unreadLabel} />
            </Link>
          )}
          <nav className="app-lang" aria-label={t.nav.otherLangLabel}>
            <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
          </nav>
          <UserButton />
        </div>
      </header>
      <div className="app-body">
        {sections.length === 0 ? null : <WorkspaceNav sections={sections} label={t.app.nav.label} />}
        <main id="contenu" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
