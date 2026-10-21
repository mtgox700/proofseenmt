import type { Dictionary, Lang } from "@/i18n";
import { PlayOnView } from "./PlayOnView";

interface PieceProps {
  readonly lang: Lang;
  readonly t: Dictionary;
}

/*
 * The pivot of the page (STORYBOARD b.3): from the measure to the proof. On the left, what really counts as evidence,
 * who can confirm, and the verified facts a profile can carry (the labels of packages/hub/src/profile-page.ts). On the
 * right, a specimen mission drawn like a mission on a profile, labelled as fictitious, never a person.
 *
 * Signature moment M2, "l'essai et la frappe" (CONCEPT §3), in CSS (home.css) started by PlayOnView: the thread is
 * traced from the claim down to its evidence (640 ms), then the stamp, already visible, is struck (140 ms + 120 ms)
 * and its ink ring spreads (240 ms). Without JavaScript and under reduced motion, the thread is drawn and the stamp
 * rests: the final state is the server render.
 */
export function Piece({ lang, t }: PieceProps) {
  const p = t.piece;
  const s = p.specimen;
  const lists = [
    { title: p.evidenceTitle, items: p.evidence },
    { title: p.confirmTitle, items: p.confirm },
    { title: p.factsTitle, items: p.facts },
  ];
  return (
    <section className="section piece" id="preuve" aria-labelledby="piece-title">
      <div className="wrap piece-grid">
        <div className="piece-copy">
          <div className="section-head">
            <p className="kicker">{p.kicker}</p>
            <h2 id="piece-title">{p.title}</h2>
            <p className="piece-lead pretty">{p.lead}</p>
          </div>
          <div className="piece-lists">
            {lists.map((list) => (
              <div key={list.title}>
                <h3>{list.title}</h3>
                <ul>
                  {list.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="piece-rule">{p.rule}</p>
        </div>

        <PlayOnView
          className="piece-play"
          threshold={0.5}
          replayLabel={p.replay}
          aside={
            <a className="piece-link" href={`/${lang}/freelances`}>
              {p.link}
            </a>
          }
        >
          <article className="specimen" aria-labelledby="specimen-role">
            <p className="specimen-label">{s.label}</p>
            <div className="specimen-body">
              <span className="specimen-thread" aria-hidden="true" />
              <span className="specimen-dot" aria-hidden="true" />
              <h3 id="specimen-role">{s.role}</h3>
              <p className="specimen-context">{s.context}</p>
              <p className="specimen-summary">{s.summary}</p>
              <p className="specimen-proof">
                <span className="specimen-evidence">{s.evidence}</span>
                <span className="specimen-link" aria-hidden="true" />
                <span className="specimen-stamp">{s.stamp}</span>
              </p>
            </div>
          </article>
        </PlayOnView>
      </div>
    </section>
  );
}
