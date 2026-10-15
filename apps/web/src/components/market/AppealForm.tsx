"use client";

import { useActionState } from "react";
import { sendAppeal, type AppealState } from "@/app/[lang]/app/appeal-actions";
import type { StandingDictionary } from "@/i18n/market/standing-fr";

const INITIAL: AppealState = { kind: "idle" };

/** A short message to the Proofseen team about a decision; the answer comes by e-mail. */
export function AppealForm({ s, id }: { readonly s: StandingDictionary; readonly id: string }) {
  const [state, action, pending] = useActionState(sendAppeal, INITIAL);
  if (state.kind === "sent") {
    return (
      <p className="form-ok" role="status">
        {s.appealSent}
      </p>
    );
  }
  const error = state.kind === "invalid" ? s.appealError : state.kind === "too_many" || state.kind === "unavailable" ? s.appealTooMany : null;
  return (
    <form action={action} className="fieldset" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{s.appealTitle}</h3>
      <p className="field-hint">{s.appealHint}</p>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-body`}>{s.appealLabel}</label>
        <textarea id={`${id}-body`} name="body" rows={3} minLength={5} maxLength={2000} required />
      </div>
      <button type="submit" className="btn" disabled={pending}>
        {s.appealSend}
      </button>
    </form>
  );
}
