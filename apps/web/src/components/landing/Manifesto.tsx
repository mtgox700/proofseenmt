import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";

/*
 * S8, the position, said once and large. Aceternity UI's "Lamp" rewritten in CSS (two conic beams and a bar of light
 * that open above the statement as it rises, violet: the light of attention, never the green of a proof) and a
 * word-by-word reveal: each word passes from the secondary ink to the main ink as it crosses the screen (a CSS view
 * timeline). Never an opacity at zero; without support, without script or under reduced motion, all in main ink.
 */
export function Manifesto({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["manifesto"] }) {
  const words = copy.statement.split(" ");
  return (
    <section className="section mf" id="position" aria-labelledby="mf-title">
      <div className="mf-lamp" aria-hidden="true">
        <span className="mf-cone mf-cone-l" />
        <span className="mf-cone mf-cone-r" />
        <span className="mf-bar" />
      </div>
      <div className="wrap">
        <p className="kicker">{copy.kicker}</p>
        <h2 id="mf-title" className="mf-statement">
          {words.map((word, i) => (
            <span key={`${word}-${i}`} className="mf-word" style={{ "--i": i, "--n": words.length } as React.CSSProperties}>
              {word}
              {i < words.length - 1 ? " " : null}
            </span>
          ))}
        </h2>
        <div className="mf-columns">
          {copy.columns.map((column) => (
            <div key={column.title} className="reveal">
              <h3>{column.title}</h3>
              <p>{column.text}</p>
            </div>
          ))}
        </div>
        <a className="text-link mf-link" href={`/${lang}/freelances`}>
          {copy.link}
        </a>
      </div>
    </section>
  );
}
