import Link from "next/link";
import { notFound } from "next/navigation";
import { articleDesk } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** The operator's article desk: every draft and published article, most recently changed first. */
export default async function ArticlesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const a = m.articles;
  const market = await pageMarket(lang, ["operator"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const list = await articleDesk(market.db, { role: "operator" }).list();

  return (
    <>
      <header className="app-head">
        <h1>{a.title}</h1>
        <p className="muted measure">{a.lead}</p>
      </header>
      <section className="panel" aria-labelledby="articles-title">
        <h2 id="articles-title">{a.title}</h2>
        {list.length === 0 ? (
          <p className="muted">{a.empty}</p>
        ) : (
          <ul className="plain-list">
            {list.map((article) => (
              <li key={article.id} className="org-member">
                <span>
                  <Link href={`/${lang}/app/articles/${article.id}`}>{article.title}</Link>{" "}
                  <span className="muted small">
                    {a.langs[article.lang]} · {a.categories[article.category]} · {a.status[article.status]} · {a.cols.updated} {day(article.updatedAt, lang)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link className="btn btn-primary" href={`/${lang}/app/articles/nouveau`}>
          {a.create}
        </Link>
      </section>
    </>
  );
}
