"use client";

import { useEffect, useRef } from "react";

/** The one memory of the strike on this device: opaque ids of what it has seen, nothing personal, never sent anywhere. */
export const SEEN_KEY = "ps-struck";
/** At most three strikes per page, 80 ms apart (CONNECTED_PLAN §2.4); the rest are simply there. */
export const MAX_STRIKES = 3;
/** Ids kept, the most recent last: enough for any register, small enough for any storage. */
export const KEEP = 200;

/** The mark that a register (`scope`) has already been read once on this device. */
export const visitedMark = (scope: string): string => `visited:${scope}`;

/** What this device has seen; `null` when the storage cannot be read, so that nothing strikes rather than replays. */
const readSeen = (): readonly string[] | null => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return null;
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

/** What to remember: what was seen, then the new ids, without repeats, the last `KEEP`. */
export const rememberIds = (fresh: readonly string[], seen: readonly string[]): readonly string[] => [...new Set([...seen, ...fresh])].slice(-KEEP);

/**
 * The strikes of a register: on the first visit of that register on this device nothing strikes, everything already
 * known is only remembered; afterwards, only the facts that appeared since the last visit strike, three at most, in the
 * order of the page.
 */
export const planRegister = (scope: string, onPage: readonly string[], seen: readonly string[]): { readonly strike: readonly string[]; readonly remember: readonly string[] } => {
  const mark = visitedMark(scope);
  const first = !seen.includes(mark);
  return {
    strike: first ? [] : onPage.filter((id) => !seen.includes(id)).slice(0, MAX_STRIKES),
    remember: rememberIds([mark, ...onPage], seen),
  };
};

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A register: strikes the seals (`[data-seal-id] .seal`) of the facts new since the last visit, 80 ms apart. */
export const strikeRegister = (scope: string): void => {
  const root = document.getElementById(scope);
  const seen = readSeen();
  if (root === null || seen === null) return;
  const marks = [...root.querySelectorAll<HTMLElement>("[data-seal-id]")];
  const onPage = marks.flatMap((mark) => (mark.dataset.sealId === undefined ? [] : [mark.dataset.sealId]));
  const plan = planRegister(scope, onPage, seen);
  // Without storage a strike could not be "once": play none. Under reduced motion the facts are only remembered.
  if (!store(plan.remember) || reducedMotion()) return;
  plan.strike.forEach((id, index) => {
    const seal = marks.find((mark) => mark.dataset.sealId === id)?.querySelector(".seal");
    seal?.setAttribute("data-strike-i", String(index));
    seal?.setAttribute("data-strike", "");
  });
};

/** An acknowledgement: the seal of a decision the server read as fresh strikes once, when it comes into view. */
const strikeAck = (id: string, seal: Element): (() => void) | undefined => {
  const seen = readSeen();
  if (seen === null || seen.includes(id) || reducedMotion()) return undefined;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (!store(rememberIds([id], readSeen() ?? seen))) return;
      seal.setAttribute("data-strike", "");
    },
    { threshold: 0.6 },
  );
  observer.observe(seal);
  return () => observer.disconnect();
};

type StrikeOnceProps =
  /** A register of facts (/app/preuves): the id of the element that holds the seals marked `data-seal-id`. */
  | { readonly scope: string; readonly id?: undefined; readonly children?: undefined }
  /**
   * The acknowledgement of a decision (lot 3): its opaque id and its seal, passed through as server HTML. The server
   * decides whether it is fresh enough to strike at all (lib/strike.ts); the device only makes sure it strikes once.
   */
  | { readonly id: string; readonly children: React.ReactNode; readonly scope?: undefined };

/*
 * The only script of the strike (CONNECTED_PLAN §2.4), one island for the whole connected space. The seals are drawn
 * by the server and are already there without JavaScript and under reduced motion; once hydrated, this sets
 * `data-strike` on the ones to strike and @proofseen/brand/seal.css plays the strike and the ink. Both uses share one
 * memory on the device and the rule that a fact strikes once: a register strikes only what appeared since the last
 * visit (nothing on the first one), an acknowledgement strikes its fresh decision once. A page that struck on every
 * load would strike nothing.
 */
export function StrikeOnce(props: StrikeOnceProps) {
  const root = useRef<HTMLDivElement>(null);
  const { scope, id } = props;

  useEffect(() => {
    if (scope !== undefined) {
      strikeRegister(scope);
      return undefined;
    }
    const seal = root.current?.querySelector(".seal") ?? null;
    return seal === null || id === undefined ? undefined : strikeAck(id, seal);
  }, [scope, id]);

  if (props.scope !== undefined) return null;
  return (
    <div className="ack-seal" data-strike-once="" ref={root}>
      {props.children}
    </div>
  );
}
