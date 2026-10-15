import Link from "next/link";
import { notFound } from "next/navigation";
import { articleDesk } from "@proofseen/db";
import { renderMarkdown } from "@proofseen/hub";
import { ArticleForm } from "@/components/market/ArticleForm";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { sourcesToField } from "@/lib/article-form";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { publishArticle, unpublishArticle } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ enregistre?: string; publie?: string; retire?: string; erreur?: string; champs?: string }>;
}

/** One article on the desk: edit, preview the saved text as it will be published, publish or unpublish. */
export default async function ArticlePage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const a = m.articles;
  const market = await pageMarket(lang, ["operator"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const article = await articleDesk(market.db, { role: "operator" }).get(id);
  if (article === null) notFound();
  const flags = await searchParams;
  const fields = (flags.champs ?? "").split(",").filter((f) => f !== "");
  const labels: Readonly<Record<string, string>> = a.fields;
  const error =
    flags.erreur === "trop" ? a.errors.tooMany : flags.erreur === "invalide" ? (fields.length === 1 && fields[0] === "sources" ? a.errors.sources : a.errors.invalid(fields.map((f) => labels[f] ?? f).join(", "))) : null;
  const notice = flags.publie === "1" ? a.published : flags.retire === "1" ? a.unpublished : flags.enregistre === "1" ? a.saved : null;
  // Safe HTML: micromark escapes raw HTML and empties dangerous addresses (tested in @proofseen/hub).
  const preview = renderMarkdown(article.body).html;
  const isPublished = article.status === "published";

  return (
    <>
      <header className="app-head">
        <Link href={`/${lang}/app/articles`}>{a.back}</Link>
        <h1>{a.editTitle}</h1>
        <p className="muted measure">
          {a.status[article.status]}
          {article.publishedAt === null ? null : ` · ${a.publishedOn(day(article.publishedAt, lang))}`}
          {isPublished ? (
            <>
              {" · "}
              <a href={`/${article.lang}/blog/${article.slug}`}>{a.publicLink}</a>
            </>
          ) : null}
        </p>
      </header>
      {notice === null ? null : (
        <p className="form-ok" role="status">
          {notice}
        </p>
      )}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form action={isPublished ? unpublishArticle : publishArticle} className="panel">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={article.id} />
        <button type="submit" className={isPublished ? "btn btn-quiet" : "btn btn-primary"}>
          {isPublished ? a.unpublish : a.publish}
        </button>
      </form>
      <section className="panel" aria-labelledby="article-preview">
        <h2 id="article-preview">{a.preview}</h2>
        <p className="field-hint">{a.previewHint}</p>
        <h3>{article.title}</h3>
        <p className="muted">{article.description}</p>
        <div className="measure" dangerouslySetInnerHTML={{ __html: preview }} />
      </section>
      <ArticleForm
        lang={lang}
        id={article.id}
        initial={{
          articleLang: article.lang,
          slug: article.slug,
          title: article.title,
          description: article.description,
          body: article.body,
          category: article.category,
          audience: article.audience,
          authorName: article.authorName,
          sources: sourcesToField(article.sources),
        }}
      />
    </>
  );
}
