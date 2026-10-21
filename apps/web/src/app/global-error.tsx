"use client";

import "@proofseen/brand/tokens.css";
import "@proofseen/brand/chrome.css";
import "@/styles/base.css";
import "@/styles/states.css";
import { useEffect } from "react";
import { incidentReference, type ErrorViewProps } from "@/components/states/ErrorView";
import { STATES } from "@/i18n/states";

/*
 * Last resort: the root layout itself failed, so nothing of the page is left, not even its language. Both languages,
 * French first (the site's default), with no router hook: this boundary must render even when the router could not.
 * Never the message or the stack of the error, only its opaque reference.
 */
export default function GlobalError({ error, reset }: ErrorViewProps) {
  const reference = incidentReference(error);
  const fr = STATES.fr.error;
  const en = STATES.en.error;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <title>{`${fr.title} · Proofseen`}</title>
        <meta name="robots" content="noindex" />
      </head>
      <body>
        <main id="contenu" className="wrap state-page">
          <div className="state-error">
            <p className="nf-code">{fr.code}</p>
            <h1 className="nf-title">{fr.title}</h1>
            <p className="nf-lead">{fr.lead}</p>
            <p className="state-actions">
              <button className="btn btn-primary" type="button" onClick={reset}>
                {fr.retry}
              </button>
              <a className="btn" href="/fr">
                {fr.home}
              </a>
            </p>
            <section lang="en" className="state-error">
              <h2 className="empty-title">{en.title}</h2>
              <p className="state-hint">{en.lead}</p>
              <p className="state-actions">
                <button className="btn" type="button" onClick={reset}>
                  {en.retry}
                </button>
                <a className="btn" href="/en">
                  {en.home}
                </a>
              </p>
            </section>
            {reference === null ? null : (
              <p className="state-ref">
                {fr.reference} / <span lang="en">{en.reference}</span> <code>{reference}</code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
