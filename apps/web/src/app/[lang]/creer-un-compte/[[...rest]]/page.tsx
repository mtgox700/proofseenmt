import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthUnavailable } from "@/components/app/AuthUnavailable";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { dictionary, isLang } from "@/i18n";
import { authConfigured } from "@/lib/auth-config";

/** Depends on who is signed in (and on whether sign-in is configured): rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).app.signUpTitle, robots: { index: false } } : {};
}

export default async function SignUpPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1} className="wrap auth-page">
        <div className="auth-copy">
          <h1>{t.app.signUpTitle}</h1>
          <p className="muted measure">{t.app.signInLead}</p>
        </div>
        <div className="auth-widget">
          {authConfigured() ? (
            <SignUp path={`/${lang}/creer-un-compte`} signInUrl={`/${lang}/connexion`} fallbackRedirectUrl={`/${lang}/app/bienvenue`} />
          ) : (
            <AuthUnavailable t={t} />
          )}
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
