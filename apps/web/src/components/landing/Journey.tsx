import type { Dictionary, Lang } from "@/i18n";
import { Simulator } from "./Simulator";

/** One question, followed from the recruiter's prompt to the count: the replay of the real J0 tally. */
export function Journey({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  return (
    <section className="section journey" id="trajet" aria-labelledby="journey-title">
      <div className="wrap journey-grid">
        <div className="journey-copy">
          <h2 id="journey-title">{t.journey.title}</h2>
          <p className="muted measure pretty">{t.journey.lead}</p>
        </div>
        <Simulator lang={lang} t={t.sim} />
      </div>
    </section>
  );
}
