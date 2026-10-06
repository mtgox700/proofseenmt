import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { dictionary, isLang } from "@/i18n";

interface RecruiterLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ lang: string }>;
}

export default async function RecruiterLayout({ children, params }: RecruiterLayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  return (
    <WorkspaceShell
      lang={lang}
      t={t}
      current="recruiter"
      identity={
        <>
          <strong>{t.ws.recruiterTitle}</strong>
        </>
      }
      items={[{ href: `/${lang}/entreprise`, label: t.ws.nav.directory }]}
    >
      {children}
    </WorkspaceShell>
  );
}
