import "@proofseen/brand/profile-card.css";
import "@/styles/app-choisir.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { freelanceLists, type ListedProfile, type ListReaction } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { ProfileResultCard } from "@/components/search/ProfileResultCard";
import { ReferenceCard } from "@/components/search/ReferenceCard";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { date } from "@/lib/format";
import { profileCardKey } from "@/lib/profile-card-view";
import { pageMarket } from "@/lib/market";
import { deleteList, react, removeFromList, saveNote } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistre?: string }>;
}

interface LineProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly listId: string;
  readonly item: ListedProfile;
  /** The instant the 30-day availability rule is read at, the same for every card of the page. */
  readonly now: Date;
}

const Hidden = ({ lang, listId, itemId }: { readonly lang: Lang; readonly listId: string; readonly itemId: string }) => (
  <>
    <input type="hidden" name="lang" value={lang} />
    <input type="hidden" name="listId" value={listId} />
    <input type="hidden" name="itemId" value={itemId} />
  </>
);

/** A thumb button: pressed when it is the person's own opinion; pressing it again withdraws it. */
function Thumb({ lang, m, listId, item, value }: Omit<LineProps, "now"> & { readonly value: ListReaction }) {
  const l = m.search.lists;
  const pressed = item.myReaction === value;
  return (
    <form action={react}>
      <Hidden lang={lang} listId={listId} itemId={item.itemId} />
      <input type="hidden" name="reaction" value={pressed ? "none" : value} />
      <button type="submit" className="btn thumb" aria-pressed={pressed}>
        {value === "up" ? l.up : l.down}
      </button>
    </form>
  );
}

/** What stays inside the company, under the card: who added the line, the thumbs, the private note, the actions. */
function Desk({ lang, m, listId, item }: Omit<LineProps, "now">) {
  const l = m.search.lists;
  const added = date(item.addedAt.toISOString(), lang);
  return (
    <div className="choice-desk">
      <p className="choice-trace">{item.addedByName === null ? l.addedByGone(added) : l.addedBy(item.addedByName, added)}</p>
      <div className="row-actions thumbs">
        <Thumb lang={lang} m={m} listId={listId} item={item} value="up" />
        <Thumb lang={lang} m={m} listId={listId} item={item} value="down" />
        <span className="muted small">
          {l.reactions(item.ups, item.downs)}
          {item.myReaction === null ? "" : ` · ${l.yours(item.myReaction === "up" ? l.up : l.down)}`}
        </span>
      </div>
      <form action={saveNote} className="field">
        <Hidden lang={lang} listId={listId} itemId={item.itemId} />
        <label htmlFor={`note-${item.itemId}`}>{l.note}</label>
        <textarea id={`note-${item.itemId}`} name="note" maxLength={2000} defaultValue={item.note ?? ""} aria-describedby={`note-hint-${item.itemId}`} />
        <p id={`note-hint-${item.itemId}`} className="field-hint">
          {l.noteHint}
        </p>
        <div className="row-actions">
          <button type="submit" className="btn">
            {l.saveNote}
          </button>
        </div>
      </form>
      <div className="row-actions">
        {item.published ? (
          <Link className="btn btn-primary" href={`/${lang}/app/contact/${encodeURIComponent(item.reference)}`}>
            {m.search.card.contact}
          </Link>
        ) : null}
        <form action={removeFromList}>
          <Hidden lang={lang} listId={listId} itemId={item.itemId} />
          <button type="submit" className="btn btn-quiet">
            {l.removeItem}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * One freelancer of the list, on the one profile card of the marketplace (the search's card, the public directory's
 * body): the same facts, dates and languages. A profile no longer published keeps its reference and the company's notes.
 */
function Line({ lang, m, listId, item, now }: LineProps) {
  const desk = <Desk lang={lang} m={m} listId={listId} item={item} />;
  return (
    <li id={`item-${item.itemId}`}>
      {item.card === null ? (
        <ReferenceCard
          reference={item.reference}
          title={m.search.card.pseudonym(item.reference)}
          headingId={`item-title-${item.itemId}`}
          {...(item.published ? {} : { note: m.search.lists.unpublished })}
        >
          {desk}
        </ReferenceCard>
      ) : (
        <ProfileResultCard lang={lang} card={item.card} now={now}>
          {desk}
        </ProfileResultCard>
      )}
    </li>
  );
}

/** A shared list of the company; another company's list is simply not found. */
export default async function ListPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const l = m.search.lists;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const now = new Date();
  const list = await freelanceLists(market.db).detail(market.actor, id, now);
  if (list === null) notFound();
  const { erreur, enregistre } = await searchParams;
  const error = erreur === "invalide" ? l.errors.invalid : erreur === "trop" ? l.errors.tooMany : erreur === "absent" ? l.errors.absent : null;

  return (
    <>
      <header className="app-head">
        <p>
          <Link href={`/${lang}/app/listes`}>{l.back}</Link>
        </p>
        <h1>{list.name}</h1>
        <p className="muted measure">{l.detailLead}</p>
      </header>
      {error === null ? (
        enregistre === undefined ? null : (
          <p className="form-ok" role="status">
            {l.saved}
          </p>
        )
      ) : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="ws-block" aria-labelledby="items-title">
        <div className="results-head">
          <h2 id="items-title">{l.count(list.items.length)}</h2>
        </div>
        {list.items.length === 0 ? (
          <EmptyState title={l.itemsEmpty} headingLevel={3} actions={[{ href: `/${lang}/app/recherche`, label: m.search.nav }]} />
        ) : (
          <>
            {/* The key of the cards, as on the search and the public directory; no green when no card carries a proof. */}
            <div dangerouslySetInnerHTML={{ __html: profileCardKey(list.items.flatMap((item) => (item.card === null ? [] : [item.card])), lang, now) }} />
            <ul className="choice-grid">
              {list.items.map((item) => (
                <Line key={item.itemId} lang={lang} m={m} listId={list.id} item={item} now={now} />
              ))}
            </ul>
          </>
        )}
        <div className="row-actions">
          <Link className="btn" href={`/${lang}/app/recherche`}>
            {l.search}
          </Link>
          {list.removable ? (
            <form action={deleteList}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="listId" value={list.id} />
              <button type="submit" className="btn btn-quiet">
                {l.remove}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}
