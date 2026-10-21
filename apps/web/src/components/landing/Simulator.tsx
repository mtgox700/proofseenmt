"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary, Lang } from "@/i18n";
import { count, percent, range } from "@/lib/format";
import { J0_DRAWS_PER_ENGINE, tallyFrames, upperBoundAt } from "@/lib/sim";

interface SimulatorProps {
  readonly lang: Lang;
  readonly t: Dictionary["sim"];
}

/*
 * Replay of the real J0 count for one engine: 0 appearances out of 200 answers.
 *
 * The server renders the FINAL state, complete and true without JavaScript. Motion is explanation (marketing tier):
 * the answer is written, the shortlist resolves, then the counter fills and the interval tightens, which is the one
 * thing that honestly changes as answers accumulate. Every frame writes to the DOM directly: no React render per frame.
 */

const WORD_MS = 45;
const ROW_STAGGER_MS = 70;
const TALLY_STEPS = 30;
const TALLY_FRAME_MS = 66;
const START_DELAY_MS = 900;

const fill = (template: string, hits: string, n: string): string => template.replace("{hits}", hits).replace("{n}", n);

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Simulator({ lang, t }: SimulatorProps) {
  const root = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const [canReplay, setCanReplay] = useState(false);
  const total = J0_DRAWS_PER_ENGINE;
  const words = t.intro.split(" ");

  const clear = (): void => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const at = (ms: number, step: () => void): void => {
    timers.current.push(window.setTimeout(step, ms));
  };

  const writeTally = useCallback(
    (el: HTMLElement, answers: number): void => {
      const high = upperBoundAt(answers);
      const times = el.querySelector<HTMLElement>("[data-times]");
      const bar = el.querySelector<HTMLElement>("[data-range]");
      const label = el.querySelector<HTMLElement>("[data-range-label]");
      if (times) times.textContent = fill(t.times, "0", count(answers, lang));
      if (bar) bar.style.transform = `scaleX(${high})`;
      if (label) label.textContent = range({ p: 0, low: 0, high }, lang);
    },
    [lang, t],
  );

  const play = useCallback((): void => {
    const el = root.current;
    if (el === null) return;
    clear();
    el.dataset.playing = "true";
    el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node) => node.classList.remove("is-in"));
    writeTally(el, 0);

    const wordNodes = [...el.querySelectorAll<HTMLElement>("[data-word]")];
    wordNodes.forEach((node, i) => at(i * WORD_MS, () => node.classList.add("is-in")));
    const afterWords = wordNodes.length * WORD_MS + 120;

    const rows = [...el.querySelectorAll<HTMLElement>("[data-row]")];
    rows.forEach((node, i) => at(afterWords + i * ROW_STAGGER_MS, () => node.classList.add("is-in")));
    const afterRows = afterWords + rows.length * ROW_STAGGER_MS + 180;

    at(afterRows, () => el.querySelector<HTMLElement>("[data-verdict]")?.classList.add("is-in"));

    const frames = tallyFrames(total, TALLY_STEPS);
    frames.forEach((answers, i) => at(afterRows + 300 + i * TALLY_FRAME_MS, () => writeTally(el, answers)));
    at(afterRows + 300 + frames.length * TALLY_FRAME_MS, () => {
      el.querySelector<HTMLElement>("[data-final]")?.classList.add("is-in");
      delete el.dataset.playing;
    });
  }, [total, writeTally]);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    setCanReplay(true);
    const el = root.current;
    if (el === null) return undefined;
    // Starts once the hero is on screen and the page is idle: never during loading (DESIGN_WEB §5).
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = window.setTimeout(play, START_DELAY_MS);
        timers.current.push(start);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clear();
    };
  }, [play]);

  const finalRange = range({ p: 0, low: 0, high: upperBoundAt(total) }, lang);

  return (
    <figure className="sim" ref={root} aria-labelledby="sim-label">
      <div className="sim-head">
        <div>
          <strong id="sim-label">{t.label}</strong>
          <span className="muted small">{t.engine}</span>
        </div>
        {/* Always rendered so the figure keeps its size: it only becomes visible once it can act (no CLS). */}
        <button type="button" className="btn sim-replay" onClick={play} data-ready={canReplay || undefined} tabIndex={canReplay ? undefined : -1} aria-hidden={canReplay ? undefined : true}>
          {t.replay}
        </button>
      </div>

      <p className="sr-only">
        {t.appear} {fill(t.times, "0", count(total, lang))}. {t.interval}{lang === "fr" ? " :" : ":"} {finalRange}. {t.same}
      </p>

      <div className="sim-body" aria-hidden="true">
        <div className="sim-q">
          <span className="sim-who">{t.question}</span>
          <p>{t.prompt}</p>
        </div>

        <div className="sim-a">
          <span className="sim-who">{t.answer}</span>
          <p className="sim-intro">
            {words.map((word, i) => (
              <span key={`${word}-${i}`} className="sim-word is-in" data-word data-reveal>
                {word}{" "}
              </span>
            ))}
          </p>
          <ol className="sim-rows">
            {t.rows.map((domain, i) => (
              <li key={`${domain}-${i}`} className="is-in" data-row data-reveal>
                <span className="sim-rank num">{i + 1}</span>
                <span className="sim-masked">{t.masked}</span>
                <code className="sim-domain">{domain}</code>
              </li>
            ))}
          </ol>
          <p className="sim-verdict is-in" data-verdict data-reveal>{t.verdict}</p>
        </div>

        <div className="sim-measure">
          <div className="sim-count">
            <span className="muted small">{t.appear}</span>
            <b className="num" data-times>{fill(t.times, "0", count(total, lang))}</b>
          </div>
          <div className="sim-ci">
            <span className="muted small">{t.interval}</span>
            <span className="sim-axis">
              <span className="sim-range" data-range style={{ transform: `scaleX(${upperBoundAt(total)})` }} />
              <span className="sim-zero" />
            </span>
            <span className="sim-axis-labels num">
              <span>{percent(0, lang)}</span>
              <span>{percent(1, lang)}</span>
            </span>
            <b className="num sim-range-label" data-range-label>{finalRange}</b>
          </div>
        </div>
      </div>

      <figcaption className="sim-foot">
        <p className="small">
          <strong className="sim-final is-in" data-final data-reveal>{t.same}</strong> <span className="muted">{t.disclosure}</span>
        </p>
      </figcaption>
    </figure>
  );
}
