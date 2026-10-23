"use client";

import { LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";

/*
 * S7, tile A: « une phrase devient des filtres ». The sentence writes itself over its own ghost (32 ms a character),
 * then each fragment lights its chip, 90 ms apart. The field wears Magic UI's "Shine Border" while it reads (the
 * violet of the machine that measures, never the green of a proof), the chips are motion's `m.span`. No model is
 * called here: it is an example, labelled as such, of a feature that only proposes filters and never sorts people.
 * The server sends the sentence written and the chips lit; nothing is ever hidden, the ghost keeps the text there.
 */

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);
const CHAR_MS = 32;
const CHIP_MS = 90;

interface PhraseProps {
  readonly label: string;
  readonly sentence: string;
  readonly chips: readonly string[];
  readonly sample: string;
}

export function PhraseToFilters({ label, sentence, chips, sample }: PhraseProps) {
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(sentence.length);
  const [lit, setLit] = useState(chips.length);

  useEffect(() => {
    const el = root.current;
    if (el === null || reduced) return undefined;
    let frame = 0;
    let start = 0;
    const total = sentence.length * CHAR_MS;
    const tick = (now: number): void => {
      // A frame's timestamp may come before `start`: the elapsed time is never negative.
      const elapsed = Math.max(0, now - start);
      setTyped(Math.min(sentence.length, Math.floor(elapsed / CHAR_MS)));
      setLit(elapsed <= total ? 0 : Math.min(chips.length, Math.floor((elapsed - total) / CHIP_MS) + 1));
      if (elapsed < total + chips.length * CHIP_MS) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start = performance.now();
        setTyped(0);
        setLit(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reduced, sentence, chips.length]);

  const reading = typed < sentence.length;
  return (
    <LazyMotion features={loadFeatures} strict>
      <div className="phrase" ref={root}>
        <p className="phrase-label">
          {label} <span className="phrase-sample">{sample}</span>
        </p>
        <div className="phrase-field" data-reading={reading ? "" : undefined}>
          <span className="shimmer" aria-hidden="true" />
          <span className="sr-only">{sentence}</span>
          <span className="phrase-text" aria-hidden="true">
            <span className="phrase-typed">{sentence.slice(0, typed)}</span>
            <span className="phrase-caret" />
            <span className="phrase-ghost">{sentence.slice(typed)}</span>
          </span>
        </div>
        <ul className="phrase-chips">
          {chips.map((chip, i) => (
            <m.li
              key={chip}
              initial={false}
              animate={i < lit ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.5, y: 4, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              {chip}
            </m.li>
          ))}
        </ul>
      </div>
    </LazyMotion>
  );
}
