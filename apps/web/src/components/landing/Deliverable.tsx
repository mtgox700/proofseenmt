import type { Dictionary } from "@/i18n";

/**
 * What the client receives, in plain words. No screenshot: the demo spaces they came from are retired, and a picture of
 * an interface that no longer exists would show something we do not deliver.
 */
export function Deliverable({ t }: { readonly t: Dictionary }) {
  return (
    <section className="section deliverable" id="livrable" aria-labelledby="deliverable-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="deliverable-title">{t.deliverable.title}</h2>
          <p className="muted measure pretty">{t.deliverable.lead}</p>
        </div>
        <ul className="bullets deliverable-list">
          {t.deliverable.contents.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="small muted">{t.deliverable.sampleCaption}</p>
      </div>
    </section>
  );
}
