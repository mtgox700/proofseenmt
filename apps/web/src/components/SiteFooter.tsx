import type { Dictionary } from "@/i18n";
import { Lockup } from "./Lockup";

/*
 * The footer of the React pages, on the same CSS as the footer of the hub (`footer.foot`, @proofseen/brand/chrome.css).
 * The legal pages are raw-HTML routes (no React), so they are reached with plain links, not `next/link`: a client-side
 * navigation would try to fetch a React payload that those routes do not have.
 */
export function SiteFooter({ t }: { readonly t: Dictionary }) {
  return (
    <footer className="foot">
      <div className="chrome">
        <p className="brand">
          <Lockup />
        </p>
        <p>{t.footer.line}</p>
        <nav aria-label={t.footer.legalNav.label}>
          {t.footer.legalNav.links.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? " · " : null}
              <a href={link.href}>{link.label}</a>
            </span>
          ))}
        </nav>
        <p>{t.footer.legal}</p>
        <p>{t.footer.marks}</p>
      </div>
    </footer>
  );
}
