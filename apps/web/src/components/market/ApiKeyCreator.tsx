"use client";

import { useActionState } from "react";
import { createApiKey, type CreateKeyState } from "@/app/[lang]/app/equipe/actions";
import type { Lang } from "@/i18n";
import type { TeamDictionary } from "@/i18n/market/team-fr";

interface ApiKeyCreatorProps {
  readonly lang: Lang;
  readonly k: TeamDictionary["keys"];
  readonly errors: { readonly invalid: string; readonly tooMany: string; readonly notAdmin: string };
}

const INITIAL: CreateKeyState = { kind: "idle" };

/**
 * The only client island of the administration page: a new key must be shown once, right where it was asked for, and
 * a redirect would have to carry it in an address. After a reload, it is gone for good.
 */
export function ApiKeyCreator({ lang, k, errors }: ApiKeyCreatorProps) {
  const [state, action, pending] = useActionState(createApiKey, INITIAL);
  const message =
    state.kind !== "error" ? null : state.code === "limite" ? k.tooMany : state.code === "trop" ? errors.tooMany : state.code === "absent" ? errors.notAdmin : errors.invalid;
  return (
    <form action={action} className="panel-grid">
      <input type="hidden" name="lang" value={lang} />
      <div className="field">
        <label htmlFor="key-name">{k.name}</label>
        <input id="key-name" name="name" type="text" required maxLength={60} aria-describedby="key-name-hint" />
        <p id="key-name-hint" className="field-hint">
          {k.nameHint}
        </p>
      </div>
      <div className="filters-actions">
        <button type="submit" className="btn" disabled={pending}>
          {k.create}
        </button>
      </div>
      {message === null ? null : (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {state.kind === "created" ? (
        <div className="form-ok key-once" role="status">
          <p>{k.shownOnce}</p>
          <code>{state.key}</code>
        </div>
      ) : null}
    </form>
  );
}
