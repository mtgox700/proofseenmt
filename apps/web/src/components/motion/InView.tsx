"use client";

import { useEffect, useRef } from "react";

interface InViewProps {
  readonly as?: "div" | "ol" | "ul" | "figure";
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
  /** Share of the element that must be visible before it counts as seen. */
  readonly threshold?: number;
}

/*
 * Sets `data-in` on its element the first time it is seen, once. CSS does the rest: without JavaScript, or with reduced
 * motion, the attribute is set immediately and the final state shows, so nothing is ever hidden for good.
 */
export function InView({ as: Tag = "div", className, children, threshold = 0.35 }: InViewProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    el.dataset.armed = "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.in = "";
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.dataset.in = "";
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag ref={ref as React.Ref<never>} className={className}>
      {children}
    </Tag>
  );
}
