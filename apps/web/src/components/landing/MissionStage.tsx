"use client";

import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { fill } from "@/content/home/fill";
import type { HomeCopy } from "@/content/home/schema";
import { FINAL_STEP, OTHER_WAY_AT, STEPS, stepAtMiddle, type Way } from "./mission-scene";
import { SceneStill } from "./SceneStill";

/*
 * S5, the controller of the sticky scene (Aceternity UI "Sticky Scroll Reveal", rewritten: the page scrolls, not an
 * inner box, and the steps are server HTML beside it). The step whose box crosses the middle of the screen is the
 * active one; scrolling back plays the states in reverse. The server renders the final step (the mission verified),
 * so a reader without JavaScript sees the end of the story; the first measure happens while the section is still
 * off screen. Until the section is 600 px away, the scene is the still one (SceneStill, no motion); then the animated
 * scene (MissionScene, motion) is fetched on its own chunk and takes over at the same step. Nothing of motion is in
 * the first load of the page.
 *
 * The hero's link « Suivre une mission de bout en bout » opens a view transition: the hero's card flies into this
 * scene, which shows the first step (the mission has just been posted). Without View Transitions, or under reduced
 * motion, the link is a plain anchor.
 */

const SEAL_TYPE_MS = 600;
const NEAR = "600px 0px";

interface SceneProps {
  readonly copy: HomeCopy["journey"]["stage"];
  readonly step: number;
  readonly way: Way;
  readonly phase: number;
  readonly typed: number;
  readonly reduced: boolean;
}

const loadScene = (): Promise<ComponentType<SceneProps>> => import("./MissionScene").then((mod) => mod.default);

/** The reader's motion preference, read after hydration (the server knows nothing of it). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

interface StageProps {
  readonly copy: HomeCopy["journey"]["stage"];
  /** The id of the server-rendered list of steps, read to find which step is in the middle of the screen. */
  readonly listId: string;
  readonly sectionId: string;
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** Characters of the seal line written so far: the whole line at once without motion or on the server. */
function useTyped(text: string, active: boolean, reduced: boolean): number {
  const [count, setCount] = useState(text.length);
  useEffect(() => {
    if (!active || reduced) {
      setCount(text.length);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      // The first timestamp of a frame may precede `start`: the elapsed time never goes below zero.
      const elapsed = Math.max(0, now - start - 360);
      const next = Math.min(text.length, Math.round((elapsed / SEAL_TYPE_MS) * text.length));
      setCount(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    };
    setCount(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, active, reduced]);
  return count;
}

export function MissionStage({ copy, listId, sectionId }: StageProps) {
  const reduced = useReducedMotion();
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const [step, setStep] = useState(FINAL_STEP);
  const [way, setWay] = useState<Way>("payment");
  const [phase, setPhase] = useState(OTHER_WAY_AT.length - 1);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const verified = way === "client" ? phase === OTHER_WAY_AT.length - 1 : step === FINAL_STEP;
  const sealText = way === "client" ? copy.confirmed : (copy.states[FINAL_STEP - 1] ?? "");
  const typed = useTyped(sealText, verified && ready, reduced);

  // The active step follows the scroll while the section is on screen; nothing listens once it has left.
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const list = document.getElementById(listId);
    if (section === null || list === null) return undefined;
    const items = Array.from(list.children) as HTMLElement[];
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const next = stepAtMiddle(items.map((item) => item.getBoundingClientRect()), window.innerHeight / 2);
      setStep((current) => (current === next ? current : next));
    };
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    });
    observer.observe(section);
    measure();
    setReady(true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [listId, sectionId]);

  // The animated scene is fetched once the section nears the screen.
  const bringScene = useCallback((): void => {
    loadScene()
      .then((loaded) => setScene(() => loaded))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (section === null) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        bringScene();
      },
      { rootMargin: NEAR },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [sectionId, bringScene]);

  // The page reads the state too: the section's data-step colours the rail, each step says whether it is the active one.
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const list = document.getElementById(listId);
    if (section === null || list === null) return;
    section.dataset.step = String(step);
    Array.from(list.children).forEach((item, i) => item.toggleAttribute("data-active", i + 1 === step));
  }, [step, listId, sectionId]);

  // The hero's link: the card flies from the opening into this scene, at the first step.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const link = (event.target as Element | null)?.closest?.("[data-mission-link]");
      const doc = document as ViewTransitionDocument;
      const heroCard = document.querySelector<HTMLElement>(".hx-card");
      const card = stageRef.current?.querySelector<HTMLElement>(".mp-card");
      if (link == null) return;
      bringScene();
      if (doc.startViewTransition === undefined || reduced || heroCard === null || card == null) return;
      event.preventDefault();
      heroCard.style.viewTransitionName = "mission-card";
      doc.startViewTransition(() => {
        heroCard.style.viewTransitionName = "";
        card.style.viewTransitionName = "mission-card";
        flushSync(() => {
          setWay("payment");
          setStep(1);
        });
        // Land on the scene itself, so the card is seen arriving; the hash still names the section.
        document.getElementById(listId)?.scrollIntoView({ behavior: "instant", block: "start" });
        if (window.location.hash !== `#${sectionId}`) history.pushState(null, "", `#${sectionId}`);
      });
      window.setTimeout(() => {
        card.style.viewTransitionName = "";
        document.getElementById(`${sectionId}-title`)?.focus({ preventScroll: true });
      }, 700);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [reduced, sectionId, listId, bringScene]);

  const clearTimers = (): void => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const playOtherWay = useCallback((): void => {
    clearTimers();
    setWay("client");
    if (reduced) {
      setPhase(OTHER_WAY_AT.length - 1);
      return;
    }
    setPhase(0);
    timers.current = OTHER_WAY_AT.slice(1).map((at, i) => window.setTimeout(() => setPhase(i + 1), at));
  }, [reduced]);

  const backToPayment = (): void => {
    clearTimers();
    setWay("payment");
    setPhase(OTHER_WAY_AT.length - 1);
  };

  // Leaving the last step ends the other way: the scene goes back to the step the reader is on.
  useEffect(() => {
    if (step === FINAL_STEP) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setWay("payment");
    setPhase(OTHER_WAY_AT.length - 1);
  }, [step]);

  const shown = way === "client" ? STEPS : step;
  return (
    <div className="mp-stage" ref={stageRef}>
      <p className="mp-counter">
        {fill(copy.counter, { n: shown })}
      </p>
      {Scene === null ? (
        <SceneStill copy={copy} step={way === "client" ? FINAL_STEP : step} />
      ) : (
        <Scene copy={copy} step={step} way={way} phase={phase} typed={Math.min(typed, sealText.length)} reduced={reduced} />
      )}
      <p className="sr-only" aria-live="polite">
        {way === "client" ? (phase === OTHER_WAY_AT.length - 1 ? copy.confirmed : copy.declared) : ""}
      </p>
      <nav className="mp-rail" aria-label={copy.rail}>
        {Array.from({ length: STEPS }, (_, i) => (
          <a key={i} href={`#${listId}-${i + 1}`} aria-current={i + 1 === step && way === "payment" ? "step" : undefined}>
            <span className="sr-only">{fill(copy.counter, { n: i + 1 })}</span>
          </a>
        ))}
      </nav>
      {ready && step === FINAL_STEP ? (
        <button type="button" className="btn mp-other" onClick={way === "client" ? backToPayment : playOtherWay}>
          {way === "client" ? copy.backButton : copy.otherButton}
        </button>
      ) : null}
    </div>
  );
}
