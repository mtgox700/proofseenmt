import "@proofseen/brand/tokens.css";
import "@proofseen/brand/chrome.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/states.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { FONT_FILES, THEME_COLOR } from "@proofseen/brand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { NotFoundView } from "@/components/states/NotFoundView";
import { dictionary, type Lang } from "@/i18n";
import { STATES } from "@/i18n/states";
import { BRAND_ICONS } from "@/lib/brand-metadata";
import { LANG_HEADER, readLangHeader } from "@/lib/request-lang";

/*
 * The 404 of every address no page or route answers (enabled by `experimental.globalNotFound`, next.config.ts):
 * without it, Next serves its own white page in English. Rendered on the server, status 404, readable without
 * JavaScript. Next gives it no params: the middleware reads the language from the address (/fr/..., /en/...). An
 * address in neither gets the French page, the site's default, with one line and a link for the English reader.
 */

export const metadata: Metadata = {
  title: "404 · Proofseen",
  robots: { index: false, follow: false },
  icons: BRAND_ICONS,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: THEME_COLOR,
};

export default async function GlobalNotFound() {
  const asked = readLangHeader((await headers()).get(LANG_HEADER));
  const lang: Lang = asked === "none" ? "fr" : asked;
  const other: Lang = lang === "fr" ? "en" : "fr";
  const t = dictionary(lang);
  const line = STATES.fr.notFound.otherLang;
  return (
    <html lang={lang}>
      <head>
        <link rel="preload" href={FONT_FILES.display} as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <a className="skip" href="#contenu">
          {t.skip}
        </a>
        <SiteHeader lang={lang} t={t} variant="site" otherHref={`/${other}`} />
        <main id="contenu" tabIndex={-1} className="wrap state-page">
          <NotFoundView lang={lang} />
          {asked === "none" ? (
            <p className="nf-other" lang="en">
              {line.text} <a href="/en">{line.link}</a>
            </p>
          ) : null}
        </main>
        <SiteFooter lang={lang} t={t} />
      </body>
    </html>
  );
}
