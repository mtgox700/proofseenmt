import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";

/*
 * S10, what Proofseen gives to everyone, without an account. A pause: nothing moves, the edge of each card lights
 * under the pointer only (Magic Card, as in the bentos). Illustrations drawn for the brand in a few strokes, no photo.
 */

const ART = {
  barometer: (
    <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">
      <path className="art-axis" d="M10 108h220" />
      {[40, 100, 160, 210].map((x, i) => (
        <g key={x} className="art-box">
          <path d={`M${x} ${30 + i * 6}v${62 - i * 4}`} />
          <rect x={x - 12} y={46 + i * 4} width="24" height={34 - i * 3} rx="3" />
          <path className="art-median" d={`M${x - 12} ${62 + i * 3}h24`} />
        </g>
      ))}
    </svg>
  ),
  simulator: (
    <svg viewBox="0 0 240 80" aria-hidden="true" focusable="false">
      <rect className="art-fill" x="10" y="20" width="132" height="16" rx="3" />
      <rect className="art-line" x="10" y="20" width="220" height="16" rx="3" />
      <rect className="art-fill" x="10" y="48" width="84" height="16" rx="3" />
      <rect className="art-line" x="10" y="48" width="220" height="16" rx="3" />
    </svg>
  ),
  blog: (
    <svg viewBox="0 0 240 80" aria-hidden="true" focusable="false">
      <path className="art-line" d="M10 18h150M10 36h220M10 50h200M10 64h120" />
      <rect className="art-line" x="178" y="8" width="52" height="18" rx="3" />
    </svg>
  ),
} as const;

export function Resources({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["resources"] }) {
  const cards = [
    { key: "barometer", card: copy.barometer, href: `/${lang}/barometre/tjm` },
    { key: "simulator", card: copy.simulator, href: `/${lang}/simulateur` },
    { key: "blog", card: copy.blog, href: `/${lang}/blog` },
  ] as const;
  return (
    <section className="section rs" id="ressources" aria-labelledby="rs-title">
      <div className="wrap">
        <header className="section-head reveal">
          <p className="kicker">{copy.kicker}</p>
          <h2 id="rs-title">{copy.title}</h2>
        </header>
        <div className="rs-grid">
          {cards.map(({ key, card, href }) => (
            <a key={key} className={`rs-card rs-${key}`} href={href} data-spot="">
              <span className="rs-art">{ART[key]}</span>
              <span className="rs-text">
                <strong>{card.title}</strong> {card.text}
              </span>
              <span className="rs-link">{card.link}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
