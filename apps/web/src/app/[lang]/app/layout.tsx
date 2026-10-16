import "@/styles/market.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { AuthUnavailable } from "@/components/app/AuthUnavailable";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { headerCounts } from "@/data/live-counts";
import { dictionary, isLang } from "@/i18n";
import { manifestPath } from "@/lib/pwa/manifest";
import { session } from "@/lib/session";

interface AppLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ lang: string }>;
}

/** Every connected page renders per request: what it shows depends on who is asking. */
export const dynamic = "force-dynamic";

/*
 * The installable app (C20) lives here and only here: the manifest link and the service worker are part of the
 * connected space, never of the public pages, which stay raw HTML without script for search engines.
 */
export async function generateMetadata({ params }: Pick<AppLayoutProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  return {
    robots: { index: false, follow: false },
    ...(isLang(lang) ? { manifest: manifestPath(lang) } : {}),
    appleWebApp: { capable: true, title: "Proofseen", statusBarStyle: "black-translucent" },
  };
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const state = await session();

  if (state.kind !== "signed-in") {
    // Signed out: the pages themselves redirect to sign-in. Unconfigured: say so, with the public site around it.
    return (
      <>
        <SiteHeader lang={lang} t={t} variant="site" />
        <main id="contenu" tabIndex={-1} className="wrap auth-page">
          {state.kind === "unconfigured" ? <AuthUnavailable t={t} /> : children}
        </main>
        <SiteFooter t={t} />
      </>
    );
  }

  return (
    <AppShell lang={lang} t={t} person={state.person} counts={await headerCounts(state.person)}>
      <ServiceWorkerRegistrar />
      {children}
    </AppShell>
  );
}
