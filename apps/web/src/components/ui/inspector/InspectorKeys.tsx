"use client";

import { useEffect } from "react";

/*
 * The only script of the inspector (LEGENDS_P2_CONCEPT §B.7, budget 2 KB): it moves the focus to the title when the
 * reader opened the panel, and Escape follows the close link. Without it the panel is still drawn, titled and closed
 * by its link.
 *
 * The focus follows an action, never a page load: when the panel arrives with the first load of a shared address, the
 * focus stays at the top of the page, where the skip link is; after a click on a row, it goes to the panel's title.
 * Escape does nothing while a field, a dialog (the command palette) or another handler holds it: a half-written reason
 * is never lost to a key.
 */

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function InspectorKeys({ titleId, closeId }: { readonly titleId: string; readonly closeId: string }) {
  useEffect(() => {
    const active = document.activeElement;
    if (active !== null && active !== document.body) document.getElementById(titleId)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(EDITABLE) || document.querySelector("dialog[open]") !== null) return;
      document.getElementById(closeId)?.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [titleId, closeId]);
  return null;
}
