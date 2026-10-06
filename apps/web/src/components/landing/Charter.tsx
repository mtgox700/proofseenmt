import { InView } from "@/components/motion/InView";
import type { Dictionary } from "@/i18n";

/** Eight commitments, each one backed by an executable check in the codebase (TEAM_MEMORY 2026-09-26). */
export function Charter({ t }: { readonly t: Dictionary }) {
  return (
    <section className="section charter-section" id="charte" aria-labelledby="charter-title">
      <div className="wrap charter-grid">
        <div className="charter-head">
          <h2 id="charter-title">{t.charter.title}</h2>
        </div>
        <InView as="ol" className="charter" threshold={0.15}>
          {t.charter.items.map((item, i) => (
            <li key={item.title} style={{ "--i": i } as React.CSSProperties}>
              <span className="charter-n num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p className="muted">{item.text}</p>
              </div>
            </li>
          ))}
        </InView>
      </div>
    </section>
  );
}
