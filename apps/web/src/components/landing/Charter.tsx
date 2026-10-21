import type { Dictionary } from "@/i18n";

/*
 * Eight commitments, each one backed by an executable check in the codebase (TEAM_MEMORY 2026-09-26). Static and
 * visible from the first paint (STORYBOARD b.8): numbered in the trace face, two columns from 48 rem.
 */
export function Charter({ t }: { readonly t: Dictionary }) {
  return (
    <section className="section charter-section" id="charte" aria-labelledby="charter-title">
      <div className="wrap charter-grid">
        <h2 id="charter-title">{t.charter.title}</h2>
        <ol className="charter">
          {t.charter.items.map((item, i) => (
            <li key={item.title}>
              <span className="charter-n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p className="muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
