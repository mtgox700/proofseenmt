"use client";

import { useRef, useState } from "react";

export interface Shot {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly src: string;
  readonly alt: string;
}

interface ShowcaseProps {
  readonly shots: readonly Shot[];
  readonly label: string;
}

/*
 * The product, shown as it is: real screenshots of the workspaces, captured from the running app and pre-encoded to
 * WebP (scripts/optimize-shots.ts), in a plain window.
 * Tabs switch the view (crossfade, 220 ms); on a fine pointer the window leans a little towards the cursor. Keyboard:
 * arrow keys move between tabs, as in any tablist. Reduced motion: no lean, instant switch.
 */
export function Showcase({ shots, label }: ShowcaseProps) {
  const [active, setActive] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
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

  const lean = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = frame.current;
    if (el === null || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1400px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg)`;
  };

  const rest = (): void => {
    if (frame.current !== null) frame.current.style.transform = "";
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
      <div className="showcase-stage" onPointerMove={lean} onPointerLeave={rest}>
        <div className="showcase-window" ref={frame} role="tabpanel" id="shot-panel" aria-labelledby={current === undefined ? undefined : `shot-tab-${current.key}`}>
          <div className="showcase-bar" aria-hidden="true">
            <span className="showcase-path">{current?.path}</span>
          </div>
          <div className="showcase-view">
            {shots.map((shot, i) => (
              <img
                key={shot.key}
                src={`${shot.src}-1440.webp`}
                srcSet={`${shot.src}-960.webp 960w, ${shot.src}-1440.webp 1440w`}
                sizes="(min-width: 76rem) 72rem, 100vw"
                alt={i === active ? shot.alt : ""}
                aria-hidden={i === active ? undefined : true}
                width={1440}
                height={900}
                loading="lazy"
                decoding="async"
                className="showcase-img"
                data-active={i === active || undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
