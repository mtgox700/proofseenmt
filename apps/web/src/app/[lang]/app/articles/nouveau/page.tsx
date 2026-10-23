import "@/styles/app-compte.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/market/ArticleForm";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** A new article starts as a draft: nothing is public until the operator publishes it. */
export default async function NewArticlePage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const a = m.articles;
  const market = await pageMarket(lang, ["operator"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  return (
    <>
      <header className="app-head">
        <Link className="back-link" href={`/${lang}/app/articles`}>
          <span aria-hidden="true">←</span> {a.back}
        </Link>
        <h1>{a.newTitle}</h1>
        <p className="muted measure">{a.lead}</p>
      </header>
      <ArticleForm lang={lang} initial={{ articleLang: lang, category: "guide", audience: "freelance", authorName: a.defaultAuthor }} />
    </>
  );
}
