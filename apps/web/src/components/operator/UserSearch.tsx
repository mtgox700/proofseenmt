"use client";

import Link from "next/link";
import { useActionState } from "react";
import { searchUsers, type UserSearchState } from "@/app/[lang]/app/operateur/user-actions";
import type { Lang } from "@/i18n";
import type { OperatorDictionary } from "@/i18n/market/operator-fr";

interface Props {
  readonly lang: Lang;
  readonly u: OperatorDictionary["users"];
  readonly tooMany: string;
}

const INITIAL: UserSearchState = { kind: "idle" };

/** Account search. The query goes in the request body, never in the address bar. */
export function UserSearch({ lang, u, tooMany }: Props) {
  const [state, action, pending] = useActionState(searchUsers, INITIAL);
  const day = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <>
      <form action={action} className="panel">
        <input type="hidden" name="lang" value={lang} />
        <div className="field">
          <label htmlFor="user-query">{u.query}</label>
          <input id="user-query" name="q" type="text" required minLength={2} maxLength={254} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {u.search}
        </button>
      </form>
      <div aria-live="polite">
        {state.kind === "too_many" ? (
          <p className="form-error">{tooMany}</p>
        ) : state.kind === "hits" && state.hits.length === 0 ? (
          <p className="muted">{u.noHit}</p>
        ) : state.kind === "hits" ? (
          <ul className="op-list">
            {state.hits.map((hit) => (
              <li key={hit.id} className="op-item">
                <p>
                  <Link href={`/${lang}/app/operateur/utilisateurs/${hit.id}`}>{hit.email}</Link> · {hit.displayName}
                  {hit.reference === null ? null : ` · ${hit.reference}`}{" "}
                  <span className="muted small">
                    {u.created} {day.format(new Date(hit.createdAt))}
                  </span>
                  {hit.suspended ? <span className="tag">{u.suspended}</span> : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
