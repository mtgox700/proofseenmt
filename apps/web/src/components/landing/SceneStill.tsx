import type { HomeCopy } from "@/content/home/schema";
import { Photo } from "./Photo";
import { ARC, BEAM_E, BEAM_F } from "./mission-geometry";
import { sceneAt } from "./mission-scene";

/*
 * The scene of the journey at one step, without any motion: what the server sends (the last step, the mission
 * verified) and what the page shows until the animated scene (MissionScene, with motion) has loaded near the
 * section. Same classes as the animated scene, so the swap moves nothing.
 */
export function SceneStill({ copy, step }: { readonly copy: HomeCopy["journey"]["stage"]; readonly step: number }) {
  const s = sceneAt(step);
  const lit = (on: boolean): string => (s.verified ? "is-proof" : on ? "is-lit" : "");
  return (
    <div className="mp-scene" data-verified={s.verified ? "" : undefined} data-way="payment" aria-hidden="true">
      <svg className="mp-beams" viewBox="0 0 560 420" focusable="false">
        <path className={`mp-beam ${lit(s.talking || s.payout || s.signed)}`} d={ARC} />
        <path className={`mp-beam ${lit(s.freelance)}`} d={BEAM_F} />
        <path className={`mp-beam ${lit(s.company)}`} d={BEAM_E} />
        {s.verified ? <path className="mp-fill" d={ARC} /> : null}
      </svg>
      <div className={`mp-node mp-node-f ${s.freelance ? "is-on" : ""}`}>
        <Photo name="hands-keyboard-terminal" alt="" sizes="(min-width: 64rem) 128px, 64px" className="mp-face" />
        <span className="mp-node-label">{copy.freelance}</span>
        {s.signed ? <span className="mp-sign" /> : null}
        {s.payout || s.verified ? <span className="mp-chip mp-invoice">{copy.billing}</span> : null}
        {s.verified ? (
          <span className="mp-stack">
            <span className="sq" />
            {copy.stack}
          </span>
        ) : null}
      </div>
      <div className={`mp-node mp-node-e ${s.company ? "is-on" : ""}`}>
        <Photo name="client-freelance-brief" alt="" sizes="(min-width: 64rem) 128px, 64px" className="mp-face" />
        <span className="mp-node-label">{copy.company}</span>
        {s.signed ? <span className="mp-sign" /> : null}
      </div>
      <div className={`mp-card ${s.escrow === "held" ? "is-held" : ""}`}>
        <span className="mp-card-label">{copy.sample}</span>
        <span className="mp-card-title">{copy.mission}</span>
        <span className="mp-card-skills">
          {copy.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
          <span className="mp-card-meta">{copy.meta}</span>
        </span>
        <span className="mp-card-status">
          {s.verified ? (
            <span className="seal mp-seal">
              <span className="sq" />
              {copy.states[8]}
            </span>
          ) : (
            <span className="mp-status">{copy.states[step - 1]}</span>
          )}
        </span>
        {s.quote && !s.verified ? <span className="mp-chip mp-quote">{copy.quote}</span> : null}
        {s.escrow === "held" ? (
          <span className="mp-chip mp-escrow">
            <span className="mp-lock" />
            {copy.escrow}
          </span>
        ) : null}
      </div>
    </div>
  );
}
