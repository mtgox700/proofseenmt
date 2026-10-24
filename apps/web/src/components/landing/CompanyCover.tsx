import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";
import { Photo } from "./Photo";
import { postMissionHref } from "./routes";

/*
 * S6, the turn to the company side. Aceternity UI's "Container Scroll Animation" rewritten as a CSS view timeline
 * (home-sections.css): the photo rises from a slight tilt, its frame opens (clip-path) and its zoom settles while it
 * crosses the screen. No script, no scroll listener; without support or under reduced motion it is simply open.
 * On a phone the text sits under the photo, never on it, so it keeps its contrast.
 */
export function CompanyCover({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["cover"] }) {
  return (
    <section className="cv" id="entreprises" aria-labelledby="cv-title">
      <div className="cv-stage">
        <figure className="cv-photo">
          <Photo name="mission-scoping-whiteboard" alt={copy.photo.alt} sizes="(min-width: 64rem) 1216px, 100vw" />
        </figure>
      </div>
      <div className="wrap cv-copy">
        <p className="kicker">{copy.kicker}</p>
        <h2 id="cv-title">{copy.title}</h2>
        <p className="section-lead pretty">{copy.lead}</p>
        <div className="cv-actions">
          <a className="btn btn-primary" href={postMissionHref(lang)}>
            {copy.primary}
          </a>
          <a className="text-link" href={`/${lang}/freelances`}>
            {copy.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
