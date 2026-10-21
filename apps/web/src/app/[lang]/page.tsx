import "@/styles/home.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Charter } from "@/components/landing/Charter";
import { Companies } from "@/components/landing/Companies";
import { Deliverable } from "@/components/landing/Deliverable";
import { Exit } from "@/components/landing/Exit";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { Journey } from "@/components/landing/Journey";
import { Method } from "@/components/landing/Method";
import { Piece } from "@/components/landing/Piece";
import { Study } from "@/components/landing/Study";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSource } from "@/data/file-source";
import { dictionary, isLang } from "@/i18n";
import { shareMetadata } from "@/lib/brand-metadata";

/*
 * The home page is public and listed in sitemap-pages.xml: it opts out of the noindex default of the [lang] layout,
 * with its canonical address and its share card.
 */
export async function generateMetadata({ params }: { readonly params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dictionary(lang);
  return {
    alternates: { canonical: `/${lang}`, languages: { fr: "/fr", en: "/en", "x-default": "/fr" } },
    robots: { index: true, follow: true },
    ...shareMetadata(lang, { title: t.meta.title, description: t.meta.description, path: `/${lang}` }),
  };
}

/*
 * The storefront (STORYBOARD lot b), in the order of the visit: the house and its own register, the legend of that
 * register in figures, what a piece of evidence is, one question followed to the count, the five steps, what a client
 * receives, the company side, the charter, the questions, and two doors out. No price: none is public before real
 * data exists (decision of 2026-10-07). Strong, quiet, strong, medium, quiet: never two strong moments on one screen.
 */
export default async function LandingPage({ params }: { readonly params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  // The founder's J0 wave (real answers, approved for publication): the only data read here.
  const answers = await getSource().answers();
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1}>
        <Hero lang={lang} t={t} answers={answers} />
        <Study t={t} />
        <Piece lang={lang} t={t} />
        <Journey lang={lang} t={t} />
        <Method t={t} />
        <Deliverable lang={lang} t={t} />
        <Companies lang={lang} t={t} />
        <Charter t={t} />
        <Faq t={t} />
        <Exit lang={lang} t={t} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
