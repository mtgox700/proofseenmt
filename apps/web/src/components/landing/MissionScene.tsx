"use client";

import { AnimatePresence, m } from "motion/react";
import type { HomeCopy } from "@/content/home";
import { Photo } from "./Photo";
import { otherWayVerified, sceneAt, type Way } from "./mission-scene";

/*
 * The scene of the journey, drawn from its state (mission-scene.ts). Two Magic UI ideas rewritten for the brand: the
 * "Animated Beam" (a dash of light that runs along a fixed path, motion's pathOffset instead of a moving gradient)
 * and the "Shine Border" turned into the ring of the seal. Every conditional part sits in an AnimatePresence with
 * `initial={false}`: what the server renders is the final frame, never an invisible start. Decorative as a whole
 * (aria-hidden): the ordered list of the nine steps, beside it, is the text.
 */

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;
const ARC = "M126 58 C 210 -4, 350 -4, 434 58";
const BEAM_F = "M80 124 C 80 200, 150 214, 206 236";
const BEAM_E = "M480 124 C 480 200, 410 214, 354 236";

interface SceneProps {
  readonly copy: HomeCopy["journey"]["stage"];
  readonly step: number;
  readonly way: Way;
  readonly phase: number;
  /** How many characters of the seal line are written; the full length when nothing is being typed. */
  readonly typed: number;
}

function Pulse({ d, active, reverse = false, slow = false }: { readonly d: string; readonly active: boolean; readonly reverse?: boolean; readonly slow?: boolean }) {
  return (
    <m.path
      className="mp-pulse"
      d={d}
      initial={false}
      animate={active ? { pathLength: 0.18, pathOffset: reverse ? [0.82, 0] : [0, 0.82], opacity: 1 } : { pathLength: 0.18, pathOffset: 0, opacity: 0 }}
      transition={active ? { duration: slow ? 1.6 : 1.1, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0.25 } : { duration: 0.2 }}
    />
  );
}

export function MissionScene({ copy, step, way, phase, typed }: SceneProps) {
  const s = sceneAt(step);
  const other = way === "client";
  const verified = other ? otherWayVerified(phase) : s.verified;
  const sealText = other ? copy.confirmed : (copy.states[8] ?? "");
  const status = other ? (verified ? copy.confirmed : phase >= 1 ? copy.signedLink : copy.declared) : (copy.states[step - 1] ?? "");
  const lit = (on: boolean): string => (verified ? "is-proof" : on ? "is-lit" : "");

  return (
    <div className="mp-scene" data-verified={verified ? "" : undefined} data-way={way} aria-hidden="true">
      <svg className="mp-beams" viewBox="0 0 560 420" focusable="false">
        <path className={`mp-beam ${lit(other ? phase >= 1 : s.talking || s.payout || s.signed)}`} d={ARC} />
        <path className={`mp-beam ${lit(other ? false : s.freelance)}`} d={BEAM_F} />
        <path className={`mp-beam ${lit(other ? phase >= 2 : s.company)}`} d={BEAM_E} />
        <Pulse d={BEAM_F} active={!other && s.applying} />
        <Pulse d={BEAM_E} active={!other && step === 1} />
        <Pulse d={ARC} active={!other && s.talking} slow />
        <Pulse d={ARC} active={!other && s.talking} reverse slow />
        <Pulse d={ARC} active={!other && s.payout} reverse />
        <Pulse d={ARC} active={other && phase === 1} />
        <Pulse d={ARC} active={other && phase === 2} reverse />
        <m.path className="mp-fill" d={ARC} initial={false} animate={{ pathLength: verified ? 1 : 0, opacity: verified ? 1 : 0 }} transition={{ duration: 0.36, ease: "easeInOut" }} />
      </svg>

      <div className={`mp-node mp-node-f ${s.freelance || other ? "is-on" : ""}`}>
        <Photo name="hands-keyboard-terminal" alt="" sizes="96px" className="mp-face" />
        <span className="mp-node-label">{copy.freelance}</span>
        <AnimatePresence initial={false}>
          {s.signed && !other ? <m.span key="sig-f" className="mp-sign" initial={{ scale: 0.6, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} /> : null}
          {s.payout || (s.verified && !other) ? (
            <m.span key="invoice" className="mp-chip mp-invoice" initial={{ y: -8, opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={SPRING}>
              {copy.billing}
            </m.span>
          ) : null}
          {verified ? (
            <m.span key="stack" className="mp-stack" initial={{ x: 120, y: 150, scale: 0.7, opacity: 0.4 }} animate={{ x: 0, y: 0, scale: 1, opacity: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ ...SPRING, delay: 0.96 }}>
              <span className="sq" />
              {copy.stack}
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className={`mp-node mp-node-e ${s.company || other ? "is-on" : ""}`}>
        <Photo name="mission-scoping-whiteboard" alt="" sizes="96px" className="mp-face" />
        <span className="mp-node-label">{copy.company}</span>
        <AnimatePresence initial={false}>
          {(s.signed && !other) || (other && phase >= 2) ? (
            <m.span key="sig-e" className="mp-sign" initial={{ scale: 0.6, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} />
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {s.talking && !other ? (
          <>
            <m.span key="bubble-f" className="mp-bubble mp-bubble-f" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={SPRING} />
            <m.span key="bubble-e" className="mp-bubble mp-bubble-e" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ ...SPRING, delay: 0.4 }} />
          </>
        ) : null}
      </AnimatePresence>

      <m.div
        className={`mp-card ${other && !verified ? "is-declared" : ""} ${s.escrow === "held" && !other ? "is-held" : ""}`}
        initial={false}
        animate={{ y: s.applying || s.talking ? -4 : 0, scale: verified ? 1.02 : 1 }}
        transition={SPRING}
      >
        <AnimatePresence initial={false}>
          {verified ? <m.span key="ring" className="mp-ring" initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.6, delay: 0.36, ease: [0.22, 1, 0.36, 1] }} /> : null}
        </AnimatePresence>
        <span className="mp-card-label">{copy.sample}</span>
        <span className="mp-card-title">{copy.mission}</span>
        <span className="mp-card-skills">
          {copy.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
          <span className="mp-card-meta">{copy.meta}</span>
        </span>
        <span className="mp-card-status">
          {verified ? (
            <span className="seal mp-seal">
              <span className="sq" />
              {sealText.slice(0, typed)}
              <span className="mp-caret" />
            </span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span key={status} className="mp-status" initial={{ y: 10, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={SPRING}>
                {status}
              </m.span>
            </AnimatePresence>
          )}
        </span>
        <AnimatePresence initial={false}>
          {s.quote && !other && !verified ? (
            <m.span key="quote" className="mp-chip mp-quote" initial={{ x: -24, opacity: 0.5 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }} transition={SPRING}>
              {copy.quote}
            </m.span>
          ) : null}
          {s.escrow === "held" && !other ? (
            <m.span key="escrow" className="mp-chip mp-escrow" initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={SPRING}>
              <span className="mp-lock" />
              {copy.escrow}
            </m.span>
          ) : null}
        </AnimatePresence>
      </m.div>
    </div>
  );
}
