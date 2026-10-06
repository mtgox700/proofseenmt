import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { loadDemoWorkspace } from "@/data/demo";
import { dictionary, isLang } from "@/i18n";

interface FreelanceLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ lang: string }>;
}

export default async function FreelanceLayout({ children, params }: FreelanceLayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const workspace = await loadDemoWorkspace();
  if (workspace === null) notFound();
  const base = `/${lang}/freelance`;
  return (
    <WorkspaceShell
      lang={lang}
      t={t}
      current="freelance"
      identity={
        <>
          <strong>{workspace.displayName}</strong>
          <code className="muted small">{workspace.reference}</code>
        </>
      }
      items={[
        { href: base, label: t.ws.nav.overview },
        { href: `${base}/rapport`, label: t.ws.nav.report },
        { href: `${base}/preuves`, label: t.ws.nav.proofs },
        { href: `${base}/evolution`, label: t.ws.nav.evolution },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
