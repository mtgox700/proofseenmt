import Link from "next/link";
import type { Lang } from "@/i18n";
import type { OperatorDictionary } from "@/i18n/market/operator-fr";

/* Small building blocks shared by the back-office pages: section links, the outcome of the last action, the reason field. */

const SECTIONS = [
  ["overview", ""],
  ["moderation", "/moderation"],
  ["community", "/communaute"],
  ["contacts", "/contacts"],
  ["verifications", "/verifications"],
  ["users", "/utilisateurs"],
  ["feedback", "/retours"],
  ["funnel", "/entonnoir"],
  ["measurements", "/mesures"],
  ["journal", "/journal"],
] as const;

export const operatorBase = (lang: Lang): string => `/${lang}/app/operateur`;

export function OperatorNav({ lang, o }: { readonly lang: Lang; readonly o: OperatorDictionary }) {
  return (
    <nav className="op-nav" aria-label={o.title}>
      <ul>
        {SECTIONS.map(([key, path]) => (
          <li key={key}>
            <Link href={`${operatorBase(lang)}${path}`}>{o.sections[key]}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type NoticeKey = "done" | "unchanged" | "absent" | "invalid" | "tooMany" | "self";

const NOTICES: Readonly<Partial<Record<string, NoticeKey>>> = { fait: "done", inchange: "unchanged", absent: "absent", invalide: "invalid", trop: "tooMany", soi: "self" };

/** What the last action did, read from `?etat=` after its redirect. */
export function Outcome({ flag, o }: { readonly flag: string | undefined; readonly o: OperatorDictionary }) {
  const key = flag === undefined ? undefined : NOTICES[flag];
  if (key === undefined) return null;
  const ok = key === "done";
  return (
    <p className={ok ? "form-ok" : "form-error"} role={ok ? "status" : "alert"}>
      {o.common[key]}
    </p>
  );
}

export function ReasonField({ id, o, required = true }: { readonly id: string; readonly o: OperatorDictionary; readonly required?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id}>{o.common.reason}</label>
      <textarea id={id} name="reason" rows={2} minLength={3} maxLength={1000} required={required} />
      <p className="field-hint">{o.common.reasonHint}</p>
    </div>
  );
}

export function LangField({ lang }: { readonly lang: Lang }) {
  return <input type="hidden" name="lang" value={lang} />;
}
