"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";

/*
 * The signup form. Client-side on purpose: it has to show the refusals the server sends back, and those refusals are
 * the useful part — « aucune adresse vérifiable » tells someone exactly what to change.
 *
 * No validation is duplicated here. The browser checks nothing the server does not check again: a form that accepts
 * what the server refuses, or refuses what it accepts, teaches a rule that is false half the time.
 */

interface Props {
  readonly t: Dictionary["intake"];
  readonly lang: "fr" | "en";
}

type State = { readonly kind: "idle" | "sending" } | { readonly kind: "ok"; readonly reference: string } | { readonly kind: "error"; readonly blockers: readonly string[] };

export function IntakeForm({ t, lang }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    const payload = {
      displayName: String(form.get("displayName") ?? "").trim(),
      urls: String(form.get("urls") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== ""),
      email: String(form.get("email") ?? "").trim(),
      lang,
      // The moment the person ticked the box, not a date the server invents for them.
      consentAt: new Date().toISOString(),
    };
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok: boolean; reference?: string; blockers?: string[] };
      if (data.ok && typeof data.reference === "string") setState({ kind: "ok", reference: data.reference });
      else setState({ kind: "error", blockers: data.blockers ?? [t.errGeneric] });
    } catch {
      setState({ kind: "error", blockers: [t.errGeneric] });
    }
  };

  if (state.kind === "ok") {
    return (
      <div className="intake-ok" role="status">
        <h2>{t.okTitle}</h2>
        <p>{t.okBody}</p>
        <p className="intake-ref">{state.reference}</p>
      </div>
    );
  }

  return (
    <form className="intake-form" onSubmit={submit} noValidate>
      {state.kind === "error" && (
        <div className="intake-error" role="alert">
          <strong>{t.errTitle}</strong>
          <ul>
            {state.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="displayName">{t.name}</label>
      <input id="displayName" name="displayName" required minLength={2} maxLength={120} autoComplete="name" />

      <label htmlFor="urls">{t.urls}</label>
      <textarea id="urls" name="urls" rows={4} required placeholder="https://…" />
      <p className="intake-hint">{t.urlsHint}</p>

      <label htmlFor="email">{t.email}</label>
      <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
      <p className="intake-hint">{t.emailHint}</p>

      <label className="intake-consent">
        <input type="checkbox" name="consent" required />
        <span>{t.consent}</span>
      </label>

      <button type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? t.sending : t.submit}
      </button>
      <p className="intake-hint">{t.noPromise}</p>
    </form>
  );
}
