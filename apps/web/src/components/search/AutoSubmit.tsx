"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement of a GET filter form: ticking a box or choosing an option applies it at once. Text fields
 * still wait for Enter or the submit button, and without script the button does everything.
 */
export function AutoSubmit({ formId }: { readonly formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return undefined;
    const onChange = (event: Event): void => {
      const target = event.target;
      const choice = target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio"));
      if (choice) form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formId]);
  return null;
}
