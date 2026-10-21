"use client";

import { ErrorView, type ErrorViewProps } from "@/components/states/ErrorView";

/*
 * A page of the [lang] segment that failed to render (the home page, a signed link, a form page, or the layout of the
 * connected space). The root layout stays: the skip link still leads here.
 */
export default function LangError({ error, reset }: ErrorViewProps) {
  return (
    <main id="contenu" tabIndex={-1} className="wrap state-page">
      <ErrorView error={error} reset={reset} />
    </main>
  );
}
