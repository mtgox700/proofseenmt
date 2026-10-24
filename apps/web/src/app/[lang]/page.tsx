import "@proofseen/brand/seal.css";
import "@/styles/home.css";
import "@/styles/home-bento.css";
import "@/styles/home-journey.css";
import "@/styles/home-sections.css";
import "@/styles/home-registre.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiVisibility } from "@/components/landing/AiVisibility";
import { Capabilities } from "@/components/landing/Capabilities";
import { CompanyBento } from "@/components/landing/CompanyBento";
import { CompanyCover } from "@/components/landing/CompanyCover";
import { Doors } from "@/components/landing/Doors";
import { Faq } from "@/components/landing/Faq";
import { FreelanceBento } from "@/components/landing/FreelanceBento";
import { HomeHero } from "@/components/landing/HomeHero";
import { LandingFx } from "@/components/landing/LandingFx";
import { Manifesto } from "@/components/landing/Manifesto";
import { MissionPath } from "@/components/landing/MissionPath";
import { Resources } from "@/components/landing/Resources";
import { Verified } from "@/components/landing/Verified";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { homeCopy } from "@/content/home";
import { getSource } from "@/data/file-source";
import { dictionary, isLang } from "@/i18n";
import { shareMetadata, siteOrigin } from "@/lib/brand-metadata";
import { homeJsonLd } from "@/lib/home-jsonld";

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
 * Real payments open only on the founder's GO PAIEMENT LIVE (PROOFSEEN_PAYMENTS_LIVE=GO on the server). Until then the
 * payment step of the journey says, in words, that it runs in test mode. Read when the page is built: a build without
 * the variable shows the line, which is the safe side.
 */
const paymentsInTestMode = (): boolean => process.env.PROOFSEEN_PAYMENTS_LIVE !== "GO";

/*
 * The home page v2 (STORYBOARD_V2.md), twelve scenes in the order of the visit: two sides and one proof; everything a
 * mission needs; the freelancer's side; what is verified and by whom; one mission from the post to the proof (the
 * flagship); the turn to the companies; their side; the position; the measure in AI answers; the open data; the
 * questions; two doors. Strong, quiet, medium, quiet, strong: never two heavy moments on one screen. Every scene is
 * server HTML in its final state, in the order of the page: no Suspense here, a boundary would stream a scene out of
 * order into a hidden block that only a script reveals (Kensa B1). No price, no Clerk.
 */
export default async function LandingPage({ params }: { readonly params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const copy = homeCopy(lang);
  // The founder's J0 wave (real answers, approved for publication): the only data read here.
  const answers = await getSource().answers();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(lang, siteOrigin(), t.meta.description) }} />
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1} className="home">
        <HomeHero lang={lang} copy={copy.hero} />
        <Capabilities copy={copy.capabilities} />
        <FreelanceBento lang={lang} copy={copy.freelance} />
        <Verified lang={lang} copy={copy.verified} />
        <MissionPath copy={copy.journey} testMode={paymentsInTestMode()} />
        <CompanyCover lang={lang} copy={copy.cover} />
        <CompanyBento copy={copy.company} sample={copy.freelance.sample} />
        <Manifesto lang={lang} copy={copy.manifesto} />
        <AiVisibility lang={lang} copy={copy.ai} field={t.field} answers={answers} />
        <Resources lang={lang} copy={copy.resources} />
        <Faq copy={copy.faq} />
        <Doors lang={lang} copy={copy.doors} />
      </main>
      <SiteFooter lang={lang} t={t} />
      <LandingFx />
    </>
  );
}
