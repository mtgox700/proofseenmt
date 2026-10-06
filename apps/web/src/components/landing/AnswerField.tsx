"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { layoutAnswers, SOURCE_CATEGORIES, type SourceCategory } from "@/lib/answers";
import { cellKey, centreOf, computeLayout, DOTS_PER_ROW, easeOut, hitTest, ROWS, seeded, type FieldLayout } from "@/lib/field-geometry";

export interface FieldPoint {
  readonly engine: number;
  readonly category: SourceCategory;
  readonly offer: string;
  readonly control: boolean;
  readonly domains: readonly string[];
  readonly other: number;
}

interface AnswerFieldProps {
  readonly t: Dictionary["field"];
  /** Overrides the landing title, e.g. « Vos 780 réponses » inside a client space. */
  readonly title?: string | undefined;
  readonly engines: readonly string[];
  readonly offers: Readonly<Record<string, string>>;
  readonly points: readonly FieldPoint[];
}

/*
 * The hero image: the 780 real answers of the founder's measure, one dot each, coloured by the source they cite.
 *
 * Motion is explanation and runs once: the answers arrive and settle into one column per engine, then a lens (the
 * brand's interval) sweeps each column looking for the measured profile, and finds nothing. After that the canvas is
 * static and redraws only on hover or filter. Reduced motion draws the final state at once. Colours come from the CSS
 * tokens, never from this file.
 */

const GAP = 28;
const ARRIVE_MS = 1400;
const SPREAD_MS = 700;
const SWEEP_MS = 1300;
const INTRO_MS = ARRIVE_MS + SPREAD_MS;

interface Tooltip {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** Near the right edge the card opens to the left, so it never leaves the figure. */
  readonly flip: boolean;
}

type Palette = Record<SourceCategory, string> & { readonly lens: string; readonly ink: string };

const readPalette = (el: Element): Palette => {
  const styles = getComputedStyle(el);
  const token = (name: string): string => styles.getPropertyValue(name).trim();
  return {
    you: token("--proof"),
    malt: token("--src-malt"),
    linkedin: token("--src-linkedin"),
    code: token("--src-code"),
    platform: token("--src-platform"),
    other: token("--src-other"),
    none: token("--src-none"),
    lens: token("--proof"),
    ink: token("--ink"),
  };
};

export function AnswerField({ t, title, engines, offers, points }: AnswerFieldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [focus, setFocus] = useState<SourceCategory | null>(null);
  const [found, setFound] = useState(false);

  // Mutable drawing state lives in refs: pointer moves and animation frames never re-render React.
  const layoutRef = useRef<FieldLayout | null>(null);
  const progressRef = useRef({ intro: 1, sweep: 1 });
  const focusRef = useRef<SourceCategory | null>(null);
  const hoverRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => undefined);

  const placed = useMemo(() => layoutAnswers(points, engines.length, DOTS_PER_ROW), [points, engines.length]);
  const byCell = useMemo(() => new Map(placed.map((p) => [cellKey(p.column, p.row, p.col), p.index])), [placed]);
  const scatter = useMemo(() => {
    const rand = seeded(20260924);
    return placed.map(() => ({ x: rand(), y: rand(), delay: rand() }));
  }, [placed]);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    const ctx = el?.getContext("2d") ?? null;
    if (el === null || box === null || ctx === null) return undefined;
    const palette = readPalette(el);
    let size = { width: 0, height: 0 };
    let raf = 0;

    const resize = (): void => {
      const rect = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(rect.width * dpr);
      el.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = { width: rect.width, height: rect.height };
      layoutRef.current = computeLayout({ ...size, gap: GAP, columns: engines.length });
    };

    const draw = (): void => {
      const layout = layoutRef.current;
      if (layout === null) return;
      const { intro, sweep } = progressRef.current;
      const elapsed = intro * INTRO_MS;
      const sweepY = layout.top + sweep * layout.pitch * ROWS;
      ctx.clearRect(0, 0, size.width, size.height);

      placed.forEach((cell, i) => {
        const point = points[cell.index];
        const from = scatter[i];
        if (point === undefined || from === undefined) return;
        const target = centreOf(cell, layout);
        const local = easeOut((elapsed - (cell.row / ROWS) * SPREAD_MS * 0.6 - from.delay * SPREAD_MS * 0.4) / ARRIVE_MS);
        const x = from.x * size.width + (target.x - from.x * size.width) * local;
        const y = from.y * size.height + (target.y - from.y * size.height) * local;
        const dimmed = focusRef.current !== null && focusRef.current !== point.category;
        const lit = sweep > 0 && sweep < 1 && Math.abs(target.y - sweepY) < layout.pitch * 1.2;
        const grow = (lit ? 1.4 : 1) * (hoverRef.current === cell.index ? 1.7 : 1);
        ctx.globalAlpha = (dimmed ? 0.12 : 1) * (0.2 + 0.8 * local);
        ctx.beginPath();
        ctx.arc(x, y, layout.radius * grow, 0, Math.PI * 2);
        if (point.category === "none") {
          ctx.strokeStyle = palette.none;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = palette[point.category];
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      if (sweep > 0 && sweep < 1) {
        ctx.strokeStyle = palette.lens;
        ctx.lineWidth = 1.5;
        for (const left of layout.columnLeft) {
          const right = left + layout.columnWidth;
          ctx.beginPath();
          ctx.moveTo(left - 5, sweepY);
          ctx.lineTo(right + 5, sweepY);
          ctx.moveTo(left - 5, sweepY - 6);
          ctx.lineTo(left - 5, sweepY + 6);
          ctx.moveTo(right + 5, sweepY - 6);
          ctx.lineTo(right + 5, sweepY + 6);
          ctx.stroke();
        }
      }

      const hovered = hoverRef.current === null ? undefined : placed.find((p) => p.index === hoverRef.current);
      if (hovered !== undefined) {
        const c = centreOf(hovered, layout);
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, layout.radius * 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    drawRef.current = draw;
    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(box);

    let intersection: IntersectionObserver | null = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progressRef.current = { intro: 1, sweep: 1 };
      draw();
      setFound(true);
    } else {
      progressRef.current = { intro: 0, sweep: 0 };
      draw();
      let start = 0;
      const step = (now: number): void => {
        if (start === 0) start = now;
        const t0 = now - start;
        progressRef.current = {
          intro: Math.min(1, t0 / INTRO_MS),
          sweep: t0 < INTRO_MS ? 0 : Math.min(1, (t0 - INTRO_MS) / SWEEP_MS),
        };
        draw();
        if (progressRef.current.sweep < 1) raf = requestAnimationFrame(step);
        else setFound(true);
      };
      // Starts once the figure is on screen: never competes with the first paint of the headline (the LCP).
      intersection = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        intersection?.disconnect();
        raf = requestAnimationFrame(step);
      });
      intersection.observe(box);
    }

    return () => {
      cancelAnimationFrame(raf);
      intersection?.disconnect();
      resizeObserver.disconnect();
    };
  }, [placed, points, scatter, engines.length]);

  const onPointer = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const layout = layoutRef.current;
    if (layout === null || progressRef.current.intro < 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const index = hitTest(x, y, layout, byCell);
    if (index === hoverRef.current) return;
    hoverRef.current = index;
    setTooltip(index === null ? null : { index, x, y, flip: x > rect.width * 0.6 });
    drawRef.current();
  };

  const onLeave = (): void => {
    hoverRef.current = null;
    setTooltip(null);
    drawRef.current();
  };

  const pick = (category: SourceCategory | null): void => {
    focusRef.current = category;
    setFocus(category);
    drawRef.current();
  };

  const shown = tooltip === null ? undefined : points[tooltip.index];
  const present = SOURCE_CATEGORIES.filter((category) => points.some((point) => point.category === category));
  const sources = (point: FieldPoint): string => {
    if (point.domains.length === 0 && point.other === 0) return t.noSource;
    const others = point.other > 0 ? t.otherDomains.replace("{n}", String(point.other)) : "";
    return [point.domains.slice(0, 3).join(", "), others].filter((part) => part !== "").join(" · ");
  };

  return (
    <figure className="field" aria-labelledby="field-title">
      <figcaption className="field-head">
        <strong id="field-title">{title ?? t.title}</strong>
        <span className="muted small">{t.caption}</span>
      </figcaption>
      <p className="sr-only">{t.summary}</p>

      <div className="field-engines" aria-hidden="true">
        {engines.map((engine, i) => (
          <span key={engine}>
            {engine}
            {i === 1 ? <em className="field-note">{t.silent}</em> : null}
          </span>
        ))}
      </div>

      <div className="field-canvas" ref={wrap}>
        <canvas ref={canvas} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={onLeave} aria-hidden="true" />
        {shown === undefined || tooltip === null ? null : (
          <div className="field-tip" data-flip={tooltip.flip || undefined} style={{ transform: `translate(${Math.round(tooltip.x)}px, ${Math.round(tooltip.y)}px)` }} aria-hidden="true">
            <strong>{engines[shown.engine]}</strong>
            <span lang="fr">{offers[shown.offer] ?? shown.offer}</span>
            <span className="muted">{shown.control ? t.control : t.target}</span>
            <span>{sources(shown)}</span>
          </div>
        )}
      </div>

      <div className="field-foot">
        <p className="field-you" data-found={found || undefined}>
          <span className="field-you-mark" aria-hidden="true" />
          {t.you} : <b className="num">{t.youCount}</b>
        </p>
        <div className="field-legend" role="group" aria-label={t.filter}>
          <button type="button" aria-pressed={focus === null} onClick={() => pick(null)}>
            {t.all}
          </button>
          {present.map((category) => (
            <button key={category} type="button" aria-pressed={focus === category} onClick={() => pick(focus === category ? null : category)}>
              <span className={`swatch swatch-${category}`} aria-hidden="true" />
              {t.categories[category]}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}
