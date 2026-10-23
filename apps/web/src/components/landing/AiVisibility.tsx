import type { HomeCopy } from "@/content/home";
import type { AnswersSnapshot } from "@/data/schema";
import type { Dictionary, Lang } from "@/i18n";
import { Registre } from "./Registre";

interface AiVisibilityProps {
  readonly lang: Lang;
  readonly copy: HomeCopy["ai"];
  readonly field: Dictionary["field"];
  readonly answers: AnswersSnapshot | null;
}

/*
 * S9, one moment, not the page: the visibility in AI answers, a function of the product, proven by the only measure
 * we can publish. The register of the 780 real answers is server SVG (Registre); its reading rule runs once when it
 * comes on screen. Violet here, the colour of the measure: no slot is green, the founder is cited in none of them.
 */
export function AiVisibility({ lang, copy, field, answers }: AiVisibilityProps) {
  return (
    <section className="section ai" id="mesure" aria-labelledby="ai-title">
      <div className="wrap ai-grid">
        <div className="ai-copy">
          <p className="kicker">{copy.kicker}</p>
          <h2 id="ai-title">{copy.title}</h2>
          <p className="section-lead pretty">{copy.lead}</p>
          <p className="ai-fact num">{copy.fact}</p>
          <p className="ai-source">{copy.source}</p>
          <p className="ai-condition">{copy.condition}</p>
          <a className="btn" href={`/${lang}/inscription`}>
            {copy.link}
          </a>
        </div>
        {answers === null ? null : <Registre lang={lang} t={field} answers={answers} />}
      </div>
    </section>
  );
}
