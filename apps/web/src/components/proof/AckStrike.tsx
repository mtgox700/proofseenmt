"use client";

import { useEffect, useRef } from "react";

const KEY = "ps-struck";
/** The last acknowledgements struck on this device: enough to never strike one twice, small enough to stay unread. */
const KEEP = 20;

/** The opaque ids already struck on this device; anything unreadable counts as none. */
const struck = (): string[] => {
  const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
};

/*
 * The only script of the acknowledgement of a decision: once per device and per decision, when the seal is in view, it
 * sets `data-strike` on it, and @proofseen/brand/seal.css plays the strike and the ink. The server decides whether the
 * decision is fresh enough to strike (lib/strike.ts); the seal itself is server HTML passed through as children, set
 * and complete without JavaScript and under reduced motion. The device keeps only the opaque ids of what it has seen,
 * never a name, and sends nothing. Without storage there is no memory, so the strike does not play rather than replay.
 */
export function AckStrike({ id, children }: { readonly id: string; readonly children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seal = root.current?.querySelector(".seal") ?? null;
    if (seal === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    try {
      if (struck().includes(id)) return undefined;
    } catch {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        try {
          localStorage.setItem(KEY, JSON.stringify([id, ...struck().filter((value) => value !== id)].slice(0, KEEP)));
        } catch {
          return;
        }
        seal.setAttribute("data-strike", "");
      },
      { threshold: 0.6 },
    );
    observer.observe(seal);
    return () => observer.disconnect();
  }, [id]);

  return (
    <div className="ack-seal" data-strike-once="" ref={root}>
      {children}
    </div>
  );
}
