import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/newsreader/wght.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/landing.css";
import "@/styles/workspace.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { dictionary, isLang, LANGS, type Lang } from "@/i18n";

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
  colorScheme: "dark",
  // Mirrors --bg: browser chrome is configured here, outside CSS, so it cannot read the token.
  themeColor: "#070b14",
};

export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dictionary(lang);
  return {
    title: { default: t.meta.title, template: "%s · Proofseen" },
    description: t.meta.description,
    alternates: { languages: { fr: "/fr", en: "/en" } },
    robots: { index: false, follow: false },
  };
}

export default async function LangLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  return (
    <html lang={lang}>
      <body>
        <a className="skip" href="#contenu">
          {t.skip}
        </a>
        <AuthProvider lang={lang}>{children}</AuthProvider>
      </body>
    </html>
  );
}
