import type { HomeCopy } from "@/content/home";

/*
 * S2, the band of capabilities: everything a mission needs passes on the same thread. Magic UI's "Marquee" rewritten
 * without Tailwind: the list twice on one track that slides in CSS (transform only), the copy aria-hidden. LandingFx
 * slows it under the pointer or the keyboard focus instead of stopping it dead; it pauses off screen. Without
 * JavaScript it still slides; under reduced motion it is a static list that wraps.
 */

/** One stroke icon per capability, in the order of the copy (16 x 16, drawn for Proofseen). */
const ICONS: readonly string[] = [
  "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6c.6-2.6 2.6-4 5-4s4.4 1.4 5 4",
  "M4 2h5l3 3v9H4zM9 2v3h3M8 7v5m-2-2 2 2 2-2",
  "M4 11V7a4 4 0 0 1 8 0v4l1 1H3zm2.5 3h3",
  "M3 4h10M3 8h10M3 12h6",
  "M2 3h12v8H7l-3 3v-3H2z",
  "M4 2h8v12H4zm2 4h4M6 9h4m-4 3h2",
  "m3 13 1-3 7-7 2 2-7 7zm6-8 2 2",
  "M4 7h8v7H4zm2 0V5a2 2 0 0 1 4 0v2",
  "M4 2h8v12l-2-1-2 1-2-1-2 1zm2 4h4M6 9h4",
  "M1 8.5 4 11.5l5-6m-1.5 6 6-6",
  "M5.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.5 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM1.5 13c.4-2 2-3 4-3s3.6 1 4 3m.5-3c1.8 0 3.2 1 3.6 3",
  "M6 3C4 3 4.5 7 3 8c1.5 1 1 5 3 5m4-10c2 0 1.5 4 3 5-1.5 1-1 5-3 5",
  "M5 1.5h6v13H5zm2.5 11h1",
  "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
];

function Items({ items }: { readonly items: readonly string[] }) {
  return items.map((item, i) => (
    <li key={item}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d={ICONS[i % ICONS.length]} />
      </svg>
      {item}
    </li>
  ));
}

export function Capabilities({ copy }: { readonly copy: HomeCopy["capabilities"] }) {
  return (
    <section className="cap" aria-labelledby="cap-title" data-fx="">
      <div className="cap-inner">
        <h2 id="cap-title" className="cap-label">
          {copy.label}
        </h2>
        <div className="mq" data-marquee="" tabIndex={0} role="region" aria-labelledby="cap-title">
          <div className="mq-track">
            <ul className="mq-list">
              <Items items={copy.items} />
            </ul>
            <ul className="mq-list mq-copy" aria-hidden="true">
              <Items items={copy.items} />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
