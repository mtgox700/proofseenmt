import Link from "next/link";
import type { Dictionary, Lang } from "@/i18n";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";

interface SiteHeaderProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  /** "site" shows the public menu (missions, freelancers, skills, sign-in); "app" keeps only the brand and the language. */
  readonly variant: "site" | "app";
}

/*
 * The public menu points only at pages filled from the database: the open missions, the directory of published
 * profiles and the skill pages. Plain links (`<a>`) for those three: they are route handlers serving raw HTML, not
 * pages of the React tree.
 */
export function SiteHeader({ lang, t, variant }: SiteHeaderProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Logo />
          <span>Proofseen</span>
        </Link>
        <nav className="nav" aria-label={t.nav.label}>
          {variant === "site" ? (
            <>
              <a className="hide-narrow" href={`/${lang}/missions`}>{t.nav.missions}</a>
              <a className="hide-narrow" href={`/${lang}/freelances`}>{t.nav.freelancers}</a>
              <a className="hide-narrow" href={`/${lang}/metiers`}>{t.nav.skills}</a>
              <Link className="hide-narrow" href={`/${lang}/connexion`}>{t.nav.signIn}</Link>
              <Link className="nav-cta" href={`/${lang}/creer-un-compte`}>{t.nav.signUp}</Link>
            </>
          ) : null}
          <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
        </nav>
      </div>
    </header>
  );
}
