import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";

/* S11, the questions: native <details>, opened in CSS (interpolate-size where it exists), no script. */
export function Faq({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["faq"] }) {
  const contact = lang === "fr" ? "/contact/" : "/en/contact/";
  return (
    <section className="section fq" id="faq" aria-labelledby="faq-title">
      <div className="wrap fq-grid">
        <div className="fq-head">
          <h2 id="faq-title">{copy.title}</h2>
          <a className="text-link" href={contact}>
            {copy.write}
          </a>
        </div>
        <div className="fq-list">
          {copy.items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
