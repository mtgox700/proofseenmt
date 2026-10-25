"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/*
 * The one island of the vault (storyboard L1.6, §4 E3): the button of « Préparer ». Without a script it is a plain
 * submit button and the browser shows its own progress. With one: disabled at once (no double submission), the form
 * aria-busy, and only after 400 ms (most renderings end before) the sentence « Préparation de la version 3… » in the
 * button and in a polite live region. No spinner, no breathing bar: a sentence.
 */

const LATE_MS = 400;

export function PendingSubmit({ label, pendingLabel }: { readonly label: string; readonly pendingLabel: string }) {
  const { pending } = useFormStatus();
  const [late, setLate] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const form = button.current?.form;
    if (!pending) return;
    form?.setAttribute("aria-busy", "true");
    const timer = setTimeout(() => setLate(true), LATE_MS);
    return () => {
      clearTimeout(timer);
      form?.removeAttribute("aria-busy");
      setLate(false);
    };
  }, [pending]);
  const said = pending && late ? pendingLabel : null;
  return (
    <>
      <button ref={button} type="submit" className="btn btn-primary" disabled={pending}>
        {said ?? label}
      </button>
      <span className="sr-only" aria-live="polite">
        {said ?? ""}
      </span>
    </>
  );
}
