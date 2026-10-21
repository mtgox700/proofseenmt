"use client";

import { useRef, useState } from "react";

export interface Shot {
  readonly key: string;
  readonly label: string;
  readonly src: string;
  readonly alt: string;
}

interface ShowcaseProps {
  readonly shots: readonly Shot[];
  readonly label: string;
}

/*
 * The product, shown as it is: real screenshots of the workspaces, captured from the running app and pre-encoded to
 * WebP (scripts/optimize-shots.ts), in a plain window. No tilt, no glow (STORYBOARD b.6).
 * Tabs switch the view; keyboard: arrow keys move between tabs, as in any tablist. Without JavaScript the tabs cannot
 * work, so home.css hides them under `(scripting: none)` and stacks both screenshots, each under its own label. With
 * JavaScript the inactive screenshot is `display: none`: out of sight and out of the accessibility tree alike.
 */
export function Showcase({ shots, label }: ShowcaseProps) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number): void => {
    const next = (index + shots.length) % shots.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  const onKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (event.key === "ArrowRight") select(index + 1);
    if (event.key === "ArrowLeft") select(index - 1);
  };

  const current = shots[active];

  return (
    <div className="showcase">
      <div className="showcase-tabs" role="tablist" aria-label={label}>
        {shots.map((shot, i) => (
          <button
            key={shot.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`shot-tab-${shot.key}`}
            aria-selected={i === active}
            aria-controls="shot-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(event) => onKey(event, i)}
          >
            {shot.label}
          </button>
        ))}
      </div>
      <div className="showcase-window" role="tabpanel" id="shot-panel" aria-labelledby={current === undefined ? undefined : `shot-tab-${current.key}`}>
        <div className="showcase-bar" aria-hidden="true">
          <span className="showcase-path">{current?.label}</span>
        </div>
        <div className="showcase-view">
          {shots.map((shot, i) => (
            <figure key={shot.key} className="showcase-shot" data-active={i === active || undefined}>
              <figcaption className="showcase-caption">{shot.label}</figcaption>
              <img
                src={`${shot.src}-1440.webp`}
                srcSet={`${shot.src}-960.webp 960w, ${shot.src}-1440.webp 1440w`}
                sizes="(min-width: 76rem) 72rem, 100vw"
                alt={shot.alt}
                width={1440}
                height={900}
                loading="lazy"
                decoding="async"
                className="showcase-img"
              />
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
