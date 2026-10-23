"use client";

import { useEffect } from "react";

/** What this device has already seen: opaque ids of verified facts, nothing personal, never sent anywhere. */
export const SEEN_KEY = "ps-seals-seen";
/** At most three strikes per page, 80 ms apart (CONNECTED_PLAN §2.4); the rest are simply there. */
export const MAX_STRIKES = 3;
/** Ids kept, the most recent last: enough for any register, small enough for any storage. */
const KEEP = 200;

const readSeen = (): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Unreadable (private mode, policy, a value that is not ours): start from nothing. If the write is refused too,
    // nothing strikes (below).
    return [];
  }
};

/** Writes what this device has seen; `false` when the storage refuses it. */
const store = (ids: readonly string[]): boolean => {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
};

/** The ids to strike now: the first ones not seen yet, in the order of the page, at most `MAX_STRIKES`. */
export const freshIds = (onPage: readonly string[], seen: readonly string[]): readonly string[] =>
  onPage.filter((id) => !seen.includes(id)).slice(0, MAX_STRIKES);

/** What to remember after this visit: what was seen, then what is on the page, without repeats, the last `KEEP`. */
export const rememberIds = (onPage: readonly string[], seen: readonly string[]): readonly string[] => [...new Set([...seen, ...onPage])].slice(-KEEP);

/*
 * The island of the strike (CONNECTED_PLAN §2.4): the seals are drawn by the server, already there without script and
 * under reduced motion. Once hydrated, it strikes the seals of the facts this device has not seen yet (marked
 * `data-seal-id` by the register), then remembers every id on the page. A fact strikes once per device; a page that
 * struck on every load would strike nothing. The motion itself is the CSS of @proofseen/brand/seal.css, played only
 * under prefers-reduced-motion: no-preference.
 */
export function StrikeOnce({ scope }: { readonly scope: string }) {
  useEffect(() => {
    const root = document.getElementById(scope);
    if (root === null) return;
    const marks = [...root.querySelectorAll<HTMLElement>("[data-seal-id]")];
    const onPage = marks.flatMap((mark) => (mark.dataset.sealId === undefined ? [] : [mark.dataset.sealId]));
    if (onPage.length === 0) return;
    const seen = readSeen();
    // Without storage a strike could not be "once": play none.
    if (!store(rememberIds(onPage, seen))) return;
    freshIds(onPage, seen).forEach((id, index) => {
      const seal = marks.find((mark) => mark.dataset.sealId === id)?.querySelector(".seal");
      seal?.setAttribute("data-strike-i", String(index));
      seal?.setAttribute("data-strike", "");
    });
  }, [scope]);
  return null;
}
