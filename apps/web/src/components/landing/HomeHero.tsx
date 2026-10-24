import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";
import { HeroScene } from "./HeroScene";
import { Photo } from "./Photo";
import { postMissionHref } from "./routes";

interface HomeHeroProps {
  readonly lang: Lang;
  readonly copy: HomeCopy["hero"];
}

/*
 * S1, « Deux côtés, une preuve » (STORYBOARD_V2 §4 S1). The headline is the LCP: never animated, never at opacity 0,
 * the only gradient text of the site (BRAND_BOOK_V2 §5). Behind it, four decorative layers, all aria-hidden and all CSS:
 * the aurora (Aceternity UI "Aurora Background", rewritten as two radial layers that drift in transform only), the
 * spotlight that lands once on the scene (Aceternity UI "Spotlight", without its SVG blur), the dot grid (Magic UI
 * "Dot Pattern") and the same grid lit under the pointer (Aceternity UI "Hero Highlight", the only part that needs
 * the pointer, fed by LandingFx). Plain links, no next/link: nothing of the sign-up page is prefetched from here.
 */
export function HomeHero({ lang, copy }: HomeHeroProps) {
  return (
    <section className="hx" aria-labelledby="hero-title" data-spot="" data-fx="">
      <div className="hx-bg" aria-hidden="true">
        <span className="hx-aurora" />
        <span className="hx-spotlight" />
        <span className="hx-dots" />
        <span className="hx-dots hx-dots-lit" />
      </div>
      <div className="wrap hx-grid">
        <div className="hx-copy">
          {/* The phone's first screen opens on a photo (Kensa M9): a 640 w cut, lazy so a wide screen never fetches it. */}
          <Photo name="freelance-code-night" alt="" sizes="213px" className="hx-banner" />
          <p className="kicker hx-kicker">{copy.kicker}</p>
          <h1 id="hero-title" className="hx-title">
            {copy.title}
          </h1>
          <p className="hx-lead pretty">{copy.lead}</p>
          <div className="hx-ctas">
            <a className="btn btn-primary shimmer-btn" href={`/${lang}/creer-un-compte`}>
              <span className="shimmer" aria-hidden="true" />
              {copy.primary}
            </a>
            <a className="btn hx-secondary" href={postMissionHref(lang)}>
              {copy.secondary}
            </a>
          </div>
          <a className="hx-follow" href="#parcours" data-mission-link="">
            {copy.follow}
            <span className="hx-arrow" aria-hidden="true" />
          </a>
          <ul className="hx-points">
            {copy.points.map((point, i) => (
              <li key={point} className={i === copy.points.length - 1 ? "hx-point-proof" : undefined}>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <HeroScene copy={copy} />
      </div>
    </section>
  );
}
