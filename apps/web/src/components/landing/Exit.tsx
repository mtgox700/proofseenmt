import Link from "next/link";
import type { Dictionary, Lang } from "@/i18n";

interface ExitProps {
  readonly lang: Lang;
  readonly t: Dictionary;
}

/* The way out of the page (STORYBOARD b.10): two doors side by side, stacked on a phone. Nothing moves. */
export function Exit({ lang, t }: ExitProps) {
  const doors = [
    { key: "freelance", door: t.exit.freelance, href: `/${lang}/inscription`, primary: true },
    { key: "company", door: t.exit.company, href: `/${lang}/freelances`, primary: false },
  ];
  return (
    <section className="exit" aria-labelledby="exit-title">
      <div className="wrap">
        <h2 id="exit-title" className="exit-label">
          {t.exit.label}
        </h2>
        <div className="exit-doors">
          {doors.map(({ key, door, href, primary }) => (
            <div key={key} className="exit-door">
              <h3>{door.title}</h3>
              <p className="muted pretty">{door.text}</p>
              {primary ? (
                <Link className="btn btn-primary" href={href}>
                  {door.cta}
                </Link>
              ) : (
                <a className="btn" href={href}>
                  {door.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
