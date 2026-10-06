import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary, Lang } from "@/i18n";
import { WorkspaceNav, type NavItem } from "./WorkspaceNav";

interface WorkspaceShellProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly current: "freelance" | "recruiter";
  readonly identity: React.ReactNode;
  readonly items: readonly NavItem[];
  readonly children: React.ReactNode;
}

export function WorkspaceShell({ lang, t, current, identity, items, children }: WorkspaceShellProps) {
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="app" current={current} />
      <div className="ws-banner">
        <p className="wrap">{t.ws.demo}</p>
      </div>
      <div className="wrap ws-shell">
        <aside className="ws-side">
          <div className="ws-id">{identity}</div>
          <WorkspaceNav items={items} label={t.ws.sectionNav} />
        </aside>
        <main id="contenu" tabIndex={-1} className="ws-main">
          {children}
        </main>
      </div>
      <SiteFooter t={t} />
    </>
  );
}
