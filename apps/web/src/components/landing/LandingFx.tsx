"use client";

import { useEffect } from "react";

/*
 * The one small script of the home page's light, mounted once and rendering nothing. It adds, never reveals:
 *  - the light under the pointer: one delegated listener writes --spot-x / --spot-y on the `[data-spot]` block under
 *    the pointer (Magic UI "Magic Card", Aceternity UI "Hero Highlight" and "Card Spotlight", one rAF per frame at most),
 *    mouse and trackpad only;
 *  - the marquee that slows under the pointer or the focus instead of stopping (playback rate eased in 190 ms steps);
 *  - `data-off` on a `[data-fx]` section that has left the screen, so its loops (aurora, shimmer, marquee) pause;
 *  - `data-play` on a `[data-play-at]` tile once it is 60 % on screen, one tile after another, 220 ms apart.
 * Everything waits for the browser to be idle, and nothing runs under reduced motion but the pause off screen.
 */

const SLOW_RATE = 0.25;
const RATE_TAU_MS = 190;
const PLAY_GAP_MS = 220;

const idle = (run: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
};

function pointerLight(): () => void {
  let frame = 0;
  let last: HTMLElement | null = null;
  let event: PointerEvent | null = null;
  const paint = (): void => {
    frame = 0;
    if (event === null) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-spot]") : null;
    if (last !== null && last !== target) last.removeAttribute("data-spot-on");
    last = target;
    if (target === null) return;
    const box = target.getBoundingClientRect();
    target.style.setProperty("--spot-x", `${Math.round(event.clientX - box.left)}px`);
    target.style.setProperty("--spot-y", `${Math.round(event.clientY - box.top)}px`);
    target.setAttribute("data-spot-on", "");
  };
  const onMove = (next: PointerEvent): void => {
    if (next.pointerType !== "mouse") return;
    event = next;
    if (frame === 0) frame = requestAnimationFrame(paint);
  };
  const onLeave = (): void => {
    last?.removeAttribute("data-spot-on");
    last = null;
  };
  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  return () => {
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    cancelAnimationFrame(frame);
  };
}

function slowMarquees(): () => void {
  const cleanups = Array.from(document.querySelectorAll<HTMLElement>("[data-marquee]")).map((box) => {
    let rate = 1;
    let target = 1;
    let frame = 0;
    let previous = 0;
    const step = (now: number): void => {
      // A frame may be stamped before the previous one was read: the elapsed time is bounded at zero.
      const dt = Math.max(0, now - (previous || now));
      previous = now;
      rate += (target - rate) * (1 - Math.exp(-dt / RATE_TAU_MS));
      if (Math.abs(target - rate) < 0.01) rate = target;
      box.getAnimations({ subtree: true }).forEach((animation) => animation.updatePlaybackRate(rate));
      frame = rate === target ? 0 : requestAnimationFrame(step);
    };
    const go = (to: number) => (): void => {
      target = to;
      previous = 0;
      if (frame === 0) frame = requestAnimationFrame(step);
    };
    const slow = go(SLOW_RATE);
    const resume = go(1);
    box.addEventListener("pointerenter", slow);
    box.addEventListener("pointerleave", resume);
    box.addEventListener("focusin", slow);
    box.addEventListener("focusout", resume);
    return () => {
      box.removeEventListener("pointerenter", slow);
      box.removeEventListener("pointerleave", resume);
      box.removeEventListener("focusin", slow);
      box.removeEventListener("focusout", resume);
      cancelAnimationFrame(frame);
    };
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}

function pauseOffScreen(): () => void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute("data-off", !entry.isIntersecting);
  });
  document.querySelectorAll("[data-fx]").forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

function playOnceInView(): () => void {
  let queue = Promise.resolve();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        queue = queue.then(
          () =>
            new Promise<void>((done) => {
              entry.target.setAttribute("data-play", "");
              window.setTimeout(done, PLAY_GAP_MS);
            }),
        );
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll("[data-play-at]").forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

export function LandingFx() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const cancel = idle(() => {
      cleanups.push(pauseOffScreen());
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cleanups.push(playOnceInView(), slowMarquees());
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) cleanups.push(pointerLight());
    });
    return () => {
      cancel();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);
  return null;
}
