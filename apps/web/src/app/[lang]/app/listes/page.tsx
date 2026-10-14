import Link from "next/link";
import { notFound } from "next/navigation";
import { freelanceLists } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { createList, deleteList } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

/** The company's freelancer lists, shared by every member: create, open, delete. */
export default async function ListsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const l = m.search.lists;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const organisation = await currentOrganisation(market);
  const header = (
    <header className="app-head">
      <h1>{l.title}</h1>
      <p className="muted measure">{l.lead}</p>
    </header>
  );
  if (organisation === null) {
    return (
      <>
        {header}
        <p className="measure">
          <Link href={`/${lang}/app`}>{m.search.noOrganisation}</Link>
        </p>
      </>
    );
  }
  const lists = (await freelanceLists(market.db).lists(market.actor, organisation.id)) ?? [];
  const { erreur } = await searchParams;
  const error = erreur === "limite" ? l.errors.limit : erreur === "trop" ? l.errors.tooMany : erreur === "invalide" ? l.errors.invalid : null;

  return (
    <>
      {header}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel" aria-labelledby="lists-title">
        <h2 id="lists-title">{l.title}</h2>
        {lists.length === 0 ? (
          <p className="muted">{l.empty}</p>
        ) : (
          <ul className="plain-list">
            {lists.map((list) => (
              <li key={list.id} className="org-member">
                <span>
                  <Link href={`/${lang}/app/listes/${list.id}`}>{list.name}</Link>{" "}
                  <span className="muted small">
                    {l.count(list.itemCount)} · {list.createdByName === null ? l.createdByGone : l.createdBy(list.createdByName)} · {day(list.createdAt, lang)}
                  </span>
                </span>
                {list.removable ? (
                  <form action={deleteList}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="listId" value={list.id} />
                    <button type="submit" className="btn btn-quiet" aria-describedby="list-remove-hint">
                      {l.remove}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {lists.some((list) => list.removable) ? (
          <p id="list-remove-hint" className="field-hint">
            {l.removeHint}
          </p>
        ) : null}
        <Link className="btn" href={`/${lang}/app/recherche`}>
          {l.search}
        </Link>
      </section>
      <form action={createList} className="panel" aria-labelledby="list-new">
        <input type="hidden" name="lang" value={lang} />
        <h2 id="list-new">{l.create}</h2>
        <div className="field">
          <label htmlFor="list-name">{l.name}</label>
          <input id="list-name" name="name" type="text" required maxLength={80} aria-describedby="list-name-hint" />
          <p id="list-name-hint" className="field-hint">
            {l.nameHint}
          </p>
        </div>
        <button type="submit" className="btn btn-primary">
          {l.create}
        </button>
      </form>
    </>
  );
}
