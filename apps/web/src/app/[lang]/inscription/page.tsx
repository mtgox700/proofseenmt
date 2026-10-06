import "@/styles/intake.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IntakeForm } from "@/components/intake/IntakeForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { dictionary, isLang } from "@/i18n";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).intake.title } : {};
}

export default async function InscriptionPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);

  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1} className="wrap intake">
        <h1>{t.intake.title}</h1>
        <p className="lede">{t.intake.lede}</p>
        <IntakeForm t={t.intake} lang={lang} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
