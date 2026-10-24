"use client";

import { useEffect } from "react";

/*
 * Escape closes the phone's menu sheet and gives the focus back to its button (STORYBOARD_V2 §2, Kensa N8). Progressive:
 * the sheet is a native <details> that opens, closes and closes on a click outside without any script (chrome.css);
 * this only adds the key. Renders nothing.
 */
export function SheetKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const open = document.querySelector<HTMLDetailsElement>("details.sheet[open]");
      if (open === null) return;
      open.open = false;
      open.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
