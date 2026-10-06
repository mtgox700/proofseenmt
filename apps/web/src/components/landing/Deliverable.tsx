import type { Dictionary, Lang } from "@/i18n";
import { Showcase, type Shot } from "./Showcase";

/** What the client receives, shown as it is: real screenshots of the workspaces, then the contents in plain words. */
export function Deliverable({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const shots: Shot[] = t.deliverable.shots.map((shot) => ({
    key: shot.key,
    label: shot.label,
    path: `/${lang}${shot.path}`,
    src: `/shots/${shot.key}-${lang}`,
    alt: shot.alt,
  }));
  return (
    <section className="section deliverable" id="livrable" aria-labelledby="deliverable-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="deliverable-title">{t.deliverable.title}</h2>
          <p className="muted measure pretty">{t.deliverable.lead}</p>
        </div>
        <Showcase shots={shots} label={t.deliverable.shotsLabel} />
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
