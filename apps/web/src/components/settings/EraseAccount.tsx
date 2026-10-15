"use client";

import { useState } from "react";
import { confirmationMatches, eraseOutcome, type EraseOutcome } from "@/lib/settings";

interface EraseAccountProps {
  readonly lang: "fr" | "en";
  readonly texts: {
    readonly confirmLabel: string;
    readonly submit: string;
    readonly pending: string;
    readonly mismatch: string;
    readonly done: string;
    readonly outcomes: Readonly<Record<Exclude<EraseOutcome, "erased">, string>>;
  };
}

type State = { readonly kind: "idle" } | { readonly kind: "pending" } | { readonly kind: "done" } | { readonly kind: "refused"; readonly message: string };

/**
 * Erasure, guarded by a typed word. Calls the existing route (`DELETE /api/me`, JSON confirmation: a cross-site form
 * cannot send it) and explains its refusal in the person's language, then leaves the app once the account is gone.
 */
export function EraseAccount({ lang, texts }: EraseAccountProps) {
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const ready = confirmationMatches(typed, lang);

  const erase = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!ready) {
      setState({ kind: "refused", message: texts.mismatch });
      return;
    }
    setState({ kind: "pending" });
    try {
      const response = await fetch("/api/me", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const outcome = eraseOutcome(await response.json().catch(() => null));
      if (outcome === "erased") {
        setState({ kind: "done" });
        window.location.assign(`/${lang}`);
        return;
      }
      setState({ kind: "refused", message: texts.outcomes[outcome] });
    } catch {
      setState({ kind: "refused", message: texts.outcomes.failed });
    }
  };

  return (
    <form onSubmit={erase} noValidate>
      <div className="field">
        <label htmlFor="erase-word">{texts.confirmLabel}</label>
        <input id="erase-word" name="confirm" type="text" autoComplete="off" spellCheck={false} value={typed} onChange={(event) => setTyped(event.target.value)} aria-describedby="erase-status" />
      </div>
      <p id="erase-status" role={state.kind === "refused" ? "alert" : "status"} className={state.kind === "refused" ? "form-error" : state.kind === "done" ? "form-ok" : "sr-only"}>
        {state.kind === "refused" ? state.message : state.kind === "done" ? texts.done : state.kind === "pending" ? texts.pending : ""}
      </p>
      <button type="submit" className="btn btn-danger" disabled={!ready || state.kind === "pending" || state.kind === "done"}>
        {state.kind === "pending" ? texts.pending : texts.submit}
      </button>
    </form>
  );
}
