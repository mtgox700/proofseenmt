import type { HomeCopy } from "@/content/home";
import { Photo } from "./Photo";

/*
 * The composition of the opening: the freelancer and the company, two beams, one mission that is proven at the end.
 * The beams are Magic UI's "Animated Beam" rewritten in CSS: a quiet path, and a pulse (a dash of light) that runs
 * along it once per beat. No measure in JavaScript, no hydration: the geometry is fixed in the viewBox, so the scene
 * plays even without a script, and its last frame (green beams, the seal struck) is what the server sends.
 * Chronology (home.css): 600 to 1 300 ms freelancer pulse, fact 1; 1 500 to 2 200 company pulse, fact 2 in amber;
 * 2 600 to 3 100 both; 3 100 the seal; 3 700 rest. Nothing loops.
 */

/** Wide scene, 560 x 560: beams fall from the inner edge of each photo into the two ports on top of the card. */
const WIDE = {
  freelance: "M220 214 C 262 214, 238 262, 244 300",
  company: "M340 236 C 300 236, 322 272, 316 300",
  ports: [
    [244, 300],
    [316, 300],
  ],
} as const;

/** Phone scene, 335 x 64: from under each round photo down to the card. */
const NARROW = {
  freelance: "M32 0 C 32 40, 140 30, 150 64",
  company: "M303 0 C 303 40, 195 30, 185 64",
  ports: [
    [150, 64],
    [185, 64],
  ],
} as const;

function Beams({ geometry, className, viewBox }: { readonly geometry: typeof WIDE | typeof NARROW; readonly className: string; readonly viewBox: string }) {
  return (
    <svg className={`hx-beams ${className}`} viewBox={viewBox} preserveAspectRatio={className === "hx-beams-narrow" ? "none" : undefined} aria-hidden="true" focusable="false">
      <path className="beam beam-f" d={geometry.freelance} pathLength={1} />
      <path className="beam beam-e" d={geometry.company} pathLength={1} />
      <path className="beam-glow pulse-f1" d={geometry.freelance} pathLength={1} />
      <path className="beam-pulse pulse-f1" d={geometry.freelance} pathLength={1} />
      <path className="beam-glow pulse-e1" d={geometry.company} pathLength={1} />
      <path className="beam-pulse pulse-e1" d={geometry.company} pathLength={1} />
      <path className="beam-pulse pulse-f2" d={geometry.freelance} pathLength={1} />
      <path className="beam-pulse pulse-e2" d={geometry.company} pathLength={1} />
      {geometry.ports.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className="beam-port" cx={cx} cy={cy} r={3.5} />
      ))}
    </svg>
  );
}

function Check() {
  return (
    <svg className="hx-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" />
      <path d="M4.6 8.3 7 10.6l4.4-5" />
    </svg>
  );
}

export function HeroScene({ copy }: { readonly copy: HomeCopy["hero"] }) {
  const [signed, escrow, verified] = copy.card.facts;
  return (
    <div className="hx-scene">
      <figure className="hx-photo hx-photo-f">
        <Photo name="freelance-code-night" alt={copy.freelance.alt} sizes="(min-width: 64rem) 220px, 64px" eager />
        <figcaption>{copy.freelance.label}</figcaption>
      </figure>
      <figure className="hx-photo hx-photo-e">
        <Photo name="client-freelance-brief" alt={copy.company.alt} sizes="(min-width: 64rem) 220px, 64px" eager />
        <figcaption>{copy.company.label}</figcaption>
      </figure>
      <Beams geometry={WIDE} className="hx-beams-wide" viewBox="0 0 560 560" />
      <Beams geometry={NARROW} className="hx-beams-narrow" viewBox="0 0 335 64" />
      <article className="hx-card" aria-label={copy.card.label}>
        <span className="hx-card-glow" aria-hidden="true" />
        <span className="hx-card-ring" aria-hidden="true" />
        <p className="hx-card-label">{copy.card.label}</p>
        <p className="hx-card-title">{copy.card.title}</p>
        <p className="hx-card-meta">{copy.card.meta}</p>
        <ul className="hx-facts">
          <li className="hx-fact hx-fact-1">
            <Check />
            {signed}
          </li>
          <li className="hx-fact hx-fact-2">
            <Check />
            {escrow}
          </li>
          <li className="hx-fact hx-fact-3">
            <span className="seal">
              <span className="sq" aria-hidden="true" />
              {verified}
            </span>
          </li>
        </ul>
        <p className="hx-card-foot">{copy.card.foot}</p>
      </article>
    </div>
  );
}
