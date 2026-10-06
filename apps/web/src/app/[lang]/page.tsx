import { notFound } from "next/navigation";
import { Charter } from "@/components/landing/Charter";
import { Companies } from "@/components/landing/Companies";
import { Deliverable } from "@/components/landing/Deliverable";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { Journey } from "@/components/landing/Journey";
import { Method } from "@/components/landing/Method";
import { Offers } from "@/components/landing/Offers";
import { Study } from "@/components/landing/Study";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { byFreshnessThenId } from "@proofseen/profiles";
import { getSource } from "@/data/file-source";
import { DEMO_REFERENCE } from "@/data/source";
import { dictionary, isLang } from "@/i18n";

export default async function LandingPage({ params }: { readonly params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const source = getSource();
  const [workspace, answers, directory] = await Promise.all([source.freelance(DEMO_REFERENCE), source.answers(), source.profiles()]);
  const freshest = [...directory.profiles].sort(byFreshnessThenId)[0] ?? null;
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1}>
        <Hero lang={lang} t={t} answers={answers} />
        <Journey lang={lang} t={t} />
        <Method lang={lang} t={t} report={workspace?.report ?? null} />
        <Study lang={lang} t={t} />
        <Deliverable lang={lang} t={t} />
        <Offers lang={lang} t={t} />
        <Companies lang={lang} t={t} profile={freshest} />
        <Charter t={t} />
        <Faq t={t} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
