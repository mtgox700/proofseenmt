import Link from "next/link";
import type { Dictionary, Lang } from "@/i18n";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";

interface SiteHeaderProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  /** "site" shows the landing anchors; "app" shows the two workspaces. */
  readonly variant: "site" | "app";
  readonly current?: "freelance" | "recruiter" | undefined;
}

export function SiteHeader({ lang, t, variant, current }: SiteHeaderProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Logo />
          <span>Proofseen</span>
        </Link>
        <nav className="nav" aria-label={variant === "site" ? t.nav.home : t.ws.sectionNav}>
          {variant === "site" ? (
            <>
              <a className="hide-narrow" href={`/${lang}#methode`}>{t.nav.method}</a>
              <a className="hide-narrow" href={`/${lang}#mesure`}>{t.nav.study}</a>
              <a className="hide-narrow" href={`/${lang}#offres`}>{t.nav.offers}</a>
              <Link className="hide-narrow" href={`/${lang}/entreprise`}>{t.nav.recruiter}</Link>
              <Link className="hide-narrow" href={`/${lang}/freelance`}>{t.nav.freelance}</Link>
              <Link className="hide-narrow" href={`/${lang}/connexion`}>{t.nav.signIn}</Link>
              <Link className="nav-cta" href={`/${lang}/inscription`}>{t.nav.start}</Link>
            </>
          ) : (
            <>
              <Link href={`/${lang}/freelance`} aria-current={current === "freelance" ? "page" : undefined}>{t.ws.freelanceShort}</Link>
              <Link href={`/${lang}/entreprise`} aria-current={current === "recruiter" ? "page" : undefined}>{t.ws.recruiterShort}</Link>
            </>
          )}
          <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
        </nav>
      </div>
    </header>
  );
}
