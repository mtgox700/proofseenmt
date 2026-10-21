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
}

/*
 * The header of the React pages is the header of the HTML hub (packages/hub, market-shell.ts): the same links in the
 * same order, read from the same list, on the same CSS (@proofseen/brand/chrome.css). The public menu points only at
 * pages filled from the database or from sourced rates. Plain links (`<a>`) for those: they are route handlers serving
 * raw HTML, not pages of the React tree. On a phone the menu is a second row that scrolls sideways, without script.
 */
export function SiteHeader({ lang, t, variant }: SiteHeaderProps) {
  const other: Lang = lang === "fr" ? "en" : "fr";
  const menu = publicMenu(lang);
  return (
    <header className={variant === "site" ? "top" : "top bare"}>
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
              <Link href={menu.signIn.href}>{menu.signIn.label}</Link>
            </nav>
            <Link className="btn btn-primary signup" href={menu.signUp.href}>
              {menu.signUp.label}
            </Link>
          </>
        ) : null}
        <LangSwitch to={other} label={t.nav.otherLang} title={t.nav.otherLangLabel} />
      </div>
    </header>
  );
}
