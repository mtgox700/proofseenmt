import "@proofseen/brand/tokens.css";
import "@proofseen/brand/chrome.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/landing.css";
import "@/styles/states.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { FONT_FILES, THEME_COLOR } from "@proofseen/brand";
import { dictionary, isLang, LANGS, type Lang } from "@/i18n";
import { BRAND_ICONS, shareMetadata, siteOrigin } from "@/lib/brand-metadata";

interface LayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ lang: string }>;
}

export const dynamicParams = false;

export const generateStaticParams = (): { lang: Lang }[] => LANGS.map((lang) => ({ lang }));

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Dark only (BRAND_BOOK_V2, section 2): one scheme, one browser colour, the page background.
  colorScheme: "dark",
  themeColor: THEME_COLOR,
};

/*
 * Safe by default: every page of this segment is noindex unless it opts in. The public pages listed in the sitemap
 * (the home page) declare `index, follow` themselves; the connected space, the signed links, sign-in and the forms
 * keep this default.
 */
export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dictionary(lang);
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: t.meta.title, template: "%s · Proofseen" },
    description: t.meta.description,
    alternates: { languages: { fr: "/fr", en: "/en" } },
    robots: { index: false, follow: false },
    icons: BRAND_ICONS,
    ...shareMetadata(lang, { title: t.meta.title, description: t.meta.description }),
  };
}

export default async function LangLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  return (
    <html lang={lang}>
      <head>
        {/* The face of every title: the only font fetched before the first paint. PS Mono loads when used. */}
        <link rel="preload" href={FONT_FILES.display} as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <a className="skip" href="#contenu">
          {t.skip}
        </a>
        {/* No Clerk here: the home page and the public pages load none of it (STORYBOARD_V2 §8). The connected space
            and the sign-in and sign-up pages wrap themselves in AuthProvider. */}
        {children}
      </body>
    </html>
  );
}
