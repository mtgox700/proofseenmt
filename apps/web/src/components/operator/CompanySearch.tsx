"use client";

import { useActionState } from "react";
import { recheckCompany, searchCompanies } from "@/app/[lang]/app/operateur/verification-actions";
import type { CompanyRow, CompanySearchState } from "@/lib/company-rows";
import type { Lang } from "@/i18n";
import type { OperatorDictionary } from "@/i18n/market/operator-fr";
import { LangField } from "./OperatorParts";

interface Props {
  readonly lang: Lang;
  readonly o: OperatorDictionary;
  /** The companies shown before any search, read by the page. */
  readonly initial: readonly CompanyRow[];
}

/**
 * Companies in the registry, searched by name or SIRET. The query goes in the request body of a server action, never
 * in the address bar, a browser history or an access log (wave-3 review, L14).
 */
export function CompanySearch({ lang, o, initial }: Props) {
  const v = o.verifications;
  const [state, action, pending] = useActionState(searchCompanies, { kind: "hits", rows: initial } satisfies CompanySearchState);
  const day = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <>
      <form action={action} className="op-forms">
        <LangField lang={lang} />
        <div className="field">
          <label htmlFor="company-search">{v.search}</label>
          <input id="company-search" name="q" type="text" maxLength={120} autoComplete="off" />
        </div>
        <button type="submit" className="btn" disabled={pending}>
          {o.common.filter}
        </button>
      </form>
      <div aria-live="polite">
        {state.kind === "too_many" ? (
          <p className="form-error">{o.common.tooMany}</p>
        ) : (
          <div className="op-table-wrap">
            <table className="op-table">
              <tbody>
                {state.rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.name}
                      {c.hidden ? <span className="tag">{o.users.hiddenTag}</span> : null}
                      <span className="muted small"> · {c.id}</span>
                    </td>
                    <td className="op-num">{c.siret ?? v.noSiret}</td>
                    <td>
                      {c.registryStatus === null ? v.never : v.status[c.registryStatus]}
                      {c.registryName === null ? null : <span className="muted small"> · {c.registryName}</span>}
                      {c.registryCheckedAt === null ? null : <span className="muted small"> · {day.format(new Date(c.registryCheckedAt))}</span>}
                    </td>
                    <td>
                      {c.siret === null ? null : (
                        <form action={recheckCompany}>
                          <LangField lang={lang} />
                          <input type="hidden" name="organisationId" value={c.id} />
                          <button type="submit" className="btn btn-quiet">
                            {v.recheck}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
