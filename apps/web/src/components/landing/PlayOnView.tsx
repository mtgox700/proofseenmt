"use client";

import { useEffect, useRef, useState } from "react";

interface PlayOnViewProps {
  readonly className: string;
  readonly children: React.ReactNode;
  /** Share of the block that must be on screen before the gesture plays. */
  readonly threshold: number;
  /** Earliest start, in ms after navigation: nothing moves while the headline (the LCP) is being painted. */
  readonly notBefore?: number;
  /** Label of the replay button. Without it, the gesture plays once and cannot be replayed. */
  readonly replayLabel?: string;
  /** Server-rendered content of the bar under the block (a link), next to the replay button. */
  readonly aside?: React.ReactNode;
}

/*
 * The only script of the signature moments: it watches one block and sets `data-play` on it once, when enough of it is
 * on screen. Everything else is CSS (home.css): the final state is the server render, readable without JavaScript and
 * under reduced motion; the waiting state exists only under `(scripting: enabled)`, so nothing jumps at hydration.
 * No data crosses to the client: the block itself is server HTML passed through as children.
 */
export function PlayOnView({ className, children, threshold, notBefore = 0, replayLabel, aside }: PlayOnViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const [canReplay, setCanReplay] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (el === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          el.dataset.play = "";
          setCanReplay(true);
        }, Math.max(0, notBefore - performance.now()));
      },
      { threshold },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [threshold, notBefore]);

  const replay = (): void => {
    const el = root.current;
    if (el === null) return;
    delete el.dataset.play;
    // Reading the layout flushes the removal, so the same animations start again from their first frame.
    void el.offsetWidth;
    el.dataset.play = "";
  };

  return (
    <div className={className} ref={root}>
      {children}
      {aside === undefined && replayLabel === undefined ? null : (
        <div className="play-bar">
          {aside}
          {replayLabel !== undefined && canReplay ? (
            <button type="button" className="btn play-replay" onClick={replay}>
              {replayLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
