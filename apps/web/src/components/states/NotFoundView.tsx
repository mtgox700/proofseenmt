import { STATES } from "../../i18n/states";
import type { Lang } from "../../i18n/types";
import { PunchAbsent } from "./PunchAbsent";

interface NotFoundViewProps {
  readonly lang: Lang;
  /** Prefix of the ids inside (title, search field), unique on the page. */
  readonly id?: string;
}

/*
 * What an address that leads nowhere shows, in the reader's language: what happened, a way to search, and the public
 * pages worth opening instead, each with its address written out (the trace). Plain links and a GET form: every way
 * out works without JavaScript. The public pages are raw-HTML routes, so plain `<a>`, never a client navigation.
 */
export function NotFoundView({ lang, id = "nf" }: NotFoundViewProps) {
  const copy = STATES[lang].notFound;
  const links = [
    { href: `/${lang}`, label: copy.links.home },
    { href: `/${lang}/missions`, label: copy.links.missions },
    { href: `/${lang}/freelances`, label: copy.links.directory },
    { href: `/${lang}/entreprises`, label: copy.links.companies },
  ];
  return (
    <div className="nf">
      <div className="nf-text">
        <p className="nf-code">{copy.code}</p>
        <h1 id={`${id}-title`} className="nf-title">
          {copy.title}
        </h1>
        <p className="nf-lead">{copy.lead}</p>
        <form className="nf-search" role="search" method="get" action={`/${lang}/missions`}>
          <label htmlFor={`${id}-q`}>{copy.searchLabel}</label>
          <span className="nf-search-row">
            <input id={`${id}-q`} type="search" name="q" maxLength={200} autoComplete="off" enterKeyHint="search" />
            <button className="btn btn-primary" type="submit">
              {copy.searchSubmit}
            </button>
          </span>
        </form>
      </div>
      <figure className="nf-art">
        <PunchAbsent />
        <figcaption className="nf-mark">{copy.mark}</figcaption>
      </figure>
      <nav className="nf-links" aria-labelledby={`${id}-elsewhere`}>
        <h2 id={`${id}-elsewhere`} className="nf-links-title">
          {copy.elsewhere}
        </h2>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href}>
                <span>{link.label}</span>
                <span className="nf-path">{link.href}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
