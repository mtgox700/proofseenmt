"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { STATES } from "../../i18n/states";
import { useLang } from "./LangPick";

export interface ErrorViewProps {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}

/** The opaque reference Next attaches to a server error: a hash, safe to show, that support can match in the logs. */
export const incidentReference = (error: { readonly digest?: string }): string | null => {
  const digest = error.digest;
  return typeof digest === "string" && /^[\w-]{1,64}$/.test(digest) ? digest : null;
};

/*
 * A page that failed to render, said plainly. Never the message or the stack of the error: in production a server
 * error reaches the browser without them anyway, and a client error could carry anything. The reader gets a sentence,
 * a way to try again (a fresh render from the server, then the boundary reset), a way home, and the reference of the
 * incident when there is one: the trace, in the mono of the brand.
 */
export function ErrorView({ error, reset }: ErrorViewProps) {
  const lang = useLang();
  const copy = STATES[lang].error;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const reference = incidentReference(error);

  useEffect(() => {
    // For whoever reads the console or the browser reports; the page itself shows none of it.
    console.error(error);
  }, [error]);

  const retry = (): void =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="state-error">
      <p className="nf-code">{copy.code}</p>
      <h1 className="nf-title">{copy.title}</h1>
      <p className="nf-lead">{copy.lead}</p>
      <p className="state-hint">{copy.hint}</p>
      <p className="state-actions">
        <button className="btn btn-primary" type="button" onClick={retry} disabled={pending} aria-busy={pending || undefined}>
          {copy.retry}
        </button>
        <a className="btn" href={`/${lang}`}>
          {copy.home}
        </a>
      </p>
      {reference === null ? null : (
        <p className="state-ref">
          {copy.reference} <code>{reference}</code>
        </p>
      )}
    </div>
  );
}
