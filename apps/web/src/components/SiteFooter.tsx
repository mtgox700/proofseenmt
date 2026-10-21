import { Fragment } from "react";
import { LEGAL_LABELS, LEGAL_PAGES } from "@proofseen/hub";
import type { Dictionary, Lang } from "@/i18n";
import { Lockup } from "./Lockup";

/*
 * The footer of the React pages: the same footer as the HTML hub (`marketFooter`, packages/hub/src/market-shell.ts),
 * on the same CSS (`footer.foot`, @proofseen/brand/chrome.css). The three legal pages come from the hub's own list and
 * labels, the trademark notice is the hub's sentence, and test/site-footer.test.ts holds the two markups equal. No
 * sales line and no link to an order page: the site shows no price (decision of 2026-10-07).
 * The legal pages are raw-HTML routes (no React), so they are reached with plain links, not `next/link`: a client-side
 * navigation would try to fetch a React payload that those routes do not have.
 */
export function SiteFooter({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const labels = LEGAL_LABELS[lang];
  return (
    <footer className="foot">
      <div className="chrome">
        <p className="brand">
          <Lockup />
        </p>
        <nav aria-label={labels.nav}>
          {LEGAL_PAGES.map((page, index) => (
            <Fragment key={page}>
              {index > 0 ? " · " : null}
              <a href={`/${lang}/${page}`}>{labels[page]}</a>
            </Fragment>
          ))}
        </nav>
        <p>{t.footer.marks}</p>
      </div>
    </footer>
  );
}
