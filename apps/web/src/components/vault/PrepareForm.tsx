import "@/styles/vault.css";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/i18n/types";
import { clauseField, type Draft, type GroupSpec, type Owner, type Problem } from "@/lib/vault/choices";
import { vaultText } from "@/lib/vault/dictionary";
import { ChoiceField } from "./ChoiceField";
import { ErrorSummary, type Refusal } from "./ErrorSummary";
import { PendingSubmit } from "./PendingSubmit";

/*
 * E2, « Préparer le contrat de prestation, version n » (storyboard L1.6, §4 E2). Server-rendered, posted to a server
 * action: it works without JavaScript, and comes back from the server with its values and its errors. What the parties
 * accepted on the quote is shown, read only; then one fieldset per subject, each saying whose choice it is; then the
 * review note, the button, and the hidden version the person saw (`attendu`), which makes a double submission, or two
 * parties preparing at once, produce one version only.
 */

export interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

export interface PrepareFormProps {
  readonly lang: Lang;
  readonly action: (formData: FormData) => Promise<void>;
  readonly contractId: string;
  /** The document a version 2 and later joins; null for the first. */
  readonly documentId: string | null;
  readonly next: number;
  readonly facts: readonly Fact[];
  readonly groups: readonly GroupSpec[];
  readonly values: Draft;
  readonly problems: readonly Problem[];
  readonly missingFacts: readonly string[];
  readonly refusal: Refusal | null;
  readonly message: string | null;
  readonly cancelHref: string;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

export function PrepareForm(props: PrepareFormProps) {
  const { lang, action, contractId, documentId, next, facts, groups, values, problems, missingFacts, refusal, message, cancelHref } = props;
  const t = vaultText(lang).prepare;
  const owner = (o: Owner) => (o === "client" ? t.owner.client : o === "provider" ? t.owner.provider : t.owner.common);
  const problemOf = (name: string) => problems.find((p) => p.name === name)?.kind;
  return (
    <form className="vault-form" action={action} noValidate>
      <Hidden name="lang" value={lang} />
      <Hidden name="contractId" value={contractId} />
      <Hidden name="attendu" value={String(next - 1)} />
      {documentId === null ? null : <Hidden name="documentId" value={documentId} />}
      <ErrorSummary lang={lang} groups={groups} problems={problems} facts={missingFacts} refusal={refusal} message={message} />

      <section aria-labelledby="facts-title" className="vault-section">
        <h2 id="facts-title">{t.fromContract}</h2>
        <dl className="vault-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="vault-hint">{t.wrongCondition}</p>
      </section>

      {groups.map((group) => (
        <fieldset key={group.id} id={`g-${group.id}`} className={group.condition === null ? undefined : "vault-cond"} data-cond={group.condition === null ? undefined : group.id}>
          <legend>{group.legend}</legend>
          {group.toggles.length > 0 ? null : <p className="vault-owner">{owner(group.owner)}</p>}
          {group.onlyIf === null ? null : <p className="vault-onlyif">{t.hints.onlyIf(group.onlyIf)}</p>}
          {group.fields.map((field) =>
            field.condition !== null && group.condition === null ? (
              <div key={field.name} className="vault-cond" data-cond={field.name}>
                <p className="vault-onlyif">{t.hints.onlyIf(vaultText(lang).prepare.onlyIfText.dpa)}</p>
                <ChoiceField lang={lang} field={field} value={values[field.name]} problem={problemOf(field.name)} labelHidden={field.label === group.legend} />
              </div>
            ) : (
              <ChoiceField key={field.name} lang={lang} field={field} value={values[field.name]} problem={problemOf(field.name)} labelHidden={field.label === group.legend} />
            ),
          )}
          {group.toggles.map((toggle) => (
            <div key={toggle.clause} className="vault-field">
              <label className="vault-choice" htmlFor={toggle.id}>
                <input id={toggle.id} type="checkbox" name={clauseField(toggle.clause)} value="included" defaultChecked={values[clauseField(toggle.clause)] === "included"} />
                <span>
                  {toggle.label}
                  <span className="vault-owner">{owner(toggle.owner)}</span>
                </span>
              </label>
              {toggle.fields.length === 0 ? null : (
                <div className="vault-cond" data-cond={clauseField(toggle.clause)}>
                  <p className="vault-onlyif">{t.hints.onlyIf(toggle.clause === "insurance" ? t.onlyIfText.insurance : t.onlyIfText.nonSolicitation)}</p>
                  {toggle.fields.map((field) => (
                    <ChoiceField key={field.name} lang={lang} field={field} value={values[field.name]} problem={problemOf(field.name)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </fieldset>
      ))}

      {documentId === null ? (
        <fieldset>
          <legend>{t.legends.lang}</legend>
          <p className="vault-hint">{t.hints.lang}</p>
          <ul className="vault-choices" role="radiogroup" aria-label={t.langLabel}>
            {(["fr", "en"] as const).map((code) => (
              <li key={code}>
                <label className="vault-choice" htmlFor={`f-lang-${code}`}>
                  <input id={`f-lang-${code}`} type="radio" name="docLang" value={code} defaultChecked={(values.docLang ?? lang) === code} />
                  <span lang={code}>{t.langs[code]}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <div className="vault-field">
        <label htmlFor="f-reason">{t.reasonLabel}</label>
        <p id="f-reason-hint" className="vault-hint">
          {t.hints.reason}
        </p>
        {problemOf("reason") === undefined ? null : (
          <p id="f-reason-error" className="vault-error">
            {t.field.contact}
          </p>
        )}
        <input id="f-reason" name="reason" type="text" maxLength={300} defaultValue={values.reason} aria-describedby={problemOf("reason") === undefined ? "f-reason-hint" : "f-reason-hint f-reason-error"} aria-invalid={problemOf("reason") === undefined ? undefined : true} />
      </div>

      <p className="vault-note">{t.reviewNote}</p>
      <div className="vault-submit">
        <PendingSubmit label={t.submit(next)} pendingLabel={t.pending(next)} />
        <Link href={cancelHref}>{t.cancel}</Link>
      </div>
    </form>
  );
}
