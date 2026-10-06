"use client";

import { useEffect, useRef } from "react";

interface CountUpProps {
  /** The final figure, exactly as the page must show it once counted (and without JavaScript). */
  readonly display: string;
  readonly to: number;
  readonly decimals?: number;
  readonly locale: string;
  readonly suffix?: string;
}

const DURATION_MS = 1100;

/*
 * A figure that counts up the first time it is seen. The server renders the final figure; the count only runs when the
 * element starts off screen, so nobody sees the true value replaced by a zero. Reduced motion: the final figure, still.
 */
export function CountUp({ display, to, decimals = 0, locale, suffix = "" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight) return undefined;
    const format = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    el.textContent = `${format.format(0)}${suffix}`;
    let raf = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      let start = 0;
      const step = (now: number): void => {
        if (start === 0) start = now;
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - (1 - t) ** 4;
        el.textContent = t === 1 ? display : `${format.format(to * eased)}${suffix}`;
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [display, to, decimals, locale, suffix]);

  return (
    <span ref={ref} className="num">
      {display}
    </span>
  );
}
