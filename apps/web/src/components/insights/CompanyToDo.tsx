import "@/styles/app-confirmer.css";
import Link from "next/link";
import type { CompanyDesk } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { count, day } from "@/lib/format";

type T = MarketDictionary["confirmDesk"]["todo"];

interface Row {
  readonly key: string;
  readonly n: number;
  readonly what: string;
  readonly href: string;
  /** The nearest deadline, when the work has one: written out, never shown by its colour alone. */
  readonly when?: { readonly at: Date; readonly text: string };
}

/** The rows a person can act on: the work of administrators only for them, in the order a decision unblocks others. */
const rowsOf = (lang: Lang, t: T, desk: CompanyDesk): readonly Row[] => {
  const app = `/${lang}/app`;
  const confirmations = desk.confirmations;
  const rows: readonly (Row | null)[] = [
    confirmations === null
      ? null
      : {
          key: "confirmations",
          n: confirmations.count,
          what: t.confirmations(confirmations.count),
          href: `${app}/confirmations`,
          ...(confirmations.soonest === null ? {} : { when: { at: confirmations.soonest, text: t.soonest(day(confirmations.soonest, lang)) } }),
        },
    desk.toSign === null ? null : { key: "sign", n: desk.toSign, what: t.toSign(desk.toSign), href: `${app}/contrats` },
    desk.toPay === null ? null : { key: "pay", n: desk.toPay, what: t.toPay(desk.toPay), href: `${app}/contrats` },
    { key: "unread", n: desk.unreadApplications, what: t.unread(desk.unreadApplications), href: `${app}/missions` },
  ];
  return rows.filter((row): row is Row => row !== null);
};

function RowBody({ lang, row }: { readonly lang: Lang; readonly row: Row }) {
  return (
    <>
      <span className="todo-n">{count(row.n, lang)}</span>{" "}
      <span className="todo-what">{row.what}</span>
      {row.when === undefined ? null : (
        <>
          {" "}
          <time className="todo-when" dateTime={row.when.at.toISOString()}>
            {row.when.text}
          </time>
        </>
      )}
    </>
  );
}

/**
 * « À traiter », at the head of the company home (CONNECTED_PLAN section 2.2): what waits for this company, counted in
 * the database when the page opened (packages/db/src/company-desk.ts). A row with work is a link to the screen where it
 * is done; a row at zero stays, in the secondary ink, so that « nothing waits » is said and not guessed. No score, no
 * order of people: counts and a deadline.
 */
export function CompanyToDo({ lang, t, organisation, desk }: { readonly lang: Lang; readonly t: T; readonly organisation: string; readonly desk: CompanyDesk }) {
  return (
    <section className="ws-block" aria-labelledby="todo-title">
      <h2 id="todo-title">{t.title}</h2>
      <p className="muted small">{t.lead(organisation)}</p>
      <ul className="todo-list">
        {rowsOf(lang, t, desk).map((row) => (
          <li key={row.key}>
            {row.n === 0 ? (
              <p className="todo-row is-clear">
                <RowBody lang={lang} row={row} />
              </p>
            ) : (
              <Link className="todo-row" href={row.href}>
                <RowBody lang={lang} row={row} />
              </Link>
            )}
          </li>
        ))}
      </ul>
      {desk.admin ? null : <p className="muted small measure">{t.adminsOnly(organisation)}</p>}
    </section>
  );
}
