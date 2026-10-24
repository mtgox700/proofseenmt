import Link from "next/link";
import { publicMenu } from "@proofseen/hub";
import type { Dictionary, Lang } from "@/i18n";
import { LangSwitch } from "./LangSwitch";
import { Lockup } from "./Lockup";

interface SiteHeaderProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  /** "site" shows the public menu (missions, freelancers, skills, sign-in); "app" keeps only the brand and the language. */
  readonly variant: "site" | "app";
  /** A fixed address for the other language, when the current one has no counterpart (the 404 outside /fr and /en). */
  readonly otherHref?: string;
}

/*
 * The header of the React pages is the header of the HTML hub (packages/hub, market-shell.ts): the same links in the
 * same order, read from the same list, on the same CSS (@proofseen/brand/chrome.css). The public menu points only at
 * pages filled from the database or from sourced rates. Plain links (`<a>`) for those: they are route handlers serving
 * raw HTML, not pages of the React tree. Plain links too for sign-in and sign-up: a prefetch would bring Clerk.
 *
 * Under 64 rem (STORYBOARD_V2 §2, Kensa M10) the row of links gives way to « Se connecter », « Créer un compte » and a
 * menu button: a native <details> whose sheet lists the menu and the other language, without any script
 * (styles/site-header.css).
 */
export function SiteHeader({ lang, t, variant, otherHref }: SiteHeaderProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  const menu = publicMenu(lang);
  const langLink =
    otherHref === undefined ? (
      <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
    ) : (
      <a className="lang" href={otherHref} hrefLang={other} lang={other} title={t.nav.otherLangLabel}>
        {t.nav.otherLang}
      </a>
    );
  return (
    <header className={variant === "site" ? "top has-sheet" : "top bare"}>
      <div className="chrome">
        <Link className="brand" href={`/${lang}`} aria-label={t.nav.home}>
          <Lockup />
        </Link>
        {variant === "site" ? (
          <>
            <nav className="nav" aria-label={menu.label}>
              {menu.items.map((item) => (
                <a key={item.key} href={item.href}>
                  {item.label}
                </a>
              ))}
              <a href={menu.signIn.href}>{menu.signIn.label}</a>
            </nav>
            <a className="signin-m" href={menu.signIn.href}>
              {menu.signIn.label}
            </a>
            <a className="btn btn-primary signup" href={menu.signUp.href}>
              {menu.signUp.label}
            </a>
            <details className="sheet">
              <summary className="sheet-toggle" aria-label={t.nav.menu}>
                <span className="sheet-bars" aria-hidden="true" />
              </summary>
              <div className="sheet-panel">
                <nav aria-label={menu.label}>
                  {menu.items.map((item) => (
                    <a key={item.key} href={item.href}>
                      {item.label}
                    </a>
                  ))}
                  <a href={menu.signIn.href}>{menu.signIn.label}</a>
                </nav>
                {langLink}
              </div>
            </details>
          </>
        ) : null}
        {langLink}
      </div>
    </header>
  );
}
