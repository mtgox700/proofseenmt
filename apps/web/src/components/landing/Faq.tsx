import type { HomeCopy } from "@/content/home";
import { CONTACT_HREF } from "./routes";

/* S11, the questions: native <details>, opened in CSS (interpolate-size where it exists), no script. */
export function Faq({ copy }: { readonly copy: HomeCopy["faq"] }) {
  return (
    <section className="section fq" id="faq" aria-labelledby="faq-title">
      <div className="wrap fq-grid">
        <div className="fq-head">
          <h2 id="faq-title">{copy.title}</h2>
          <a className="text-link" href={CONTACT_HREF}>
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
