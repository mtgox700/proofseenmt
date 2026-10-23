import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";
import { Photo } from "./Photo";

/*
 * S12, the two doors: the loop opened by the hero closes, the two sides meet on one thread. Each half is one large
 * link over a darkened photo; the light follows the pointer inside the half under it (Aceternity UI "Card Spotlight",
 * fed by LandingFx) and the thread in the middle leans 4 degrees towards it (CSS :has(), no script). Fixed without
 * a pointer, without JavaScript or under reduced motion.
 */
export function Doors({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["doors"] }) {
  const doors = [
    { key: "freelance", door: copy.freelance, href: `/${lang}/creer-un-compte`, photo: "remote-freelance-coffee" },
    { key: "company", door: copy.company, href: `/${lang}/app/missions/nouvelle`, photo: "handshake-deal-dark" },
  ] as const;
  return (
    <section className="dr" aria-labelledby="exit-title">
      <h2 id="exit-title" className="sr-only">
        {copy.label}
      </h2>
      <div className="dr-doors">
        {doors.map(({ key, door, href, photo }) => (
          <a key={key} className={`dr-door dr-${key}`} href={href} data-spot="">
            <Photo name={photo} alt={door.alt} sizes="(min-width: 48rem) 50vw, 100vw" className="dr-photo" />
            <span className="dr-copy">
              <span className="dr-title">{door.title}</span>
              <span className="dr-text">{door.text}</span>
              <span className={key === "freelance" ? "btn btn-primary dr-cta" : "btn dr-cta"}>{door.cta}</span>
            </span>
          </a>
        ))}
        <span className="dr-thread" aria-hidden="true">
          <img src="/brand/ps-monogram-dark.svg" width="40" height="40" alt="" />
        </span>
      </div>
    </section>
  );
}
