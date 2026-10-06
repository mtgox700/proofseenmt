import type { Dictionary } from "@/i18n";

export function Faq({ t }: { readonly t: Dictionary }) {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq">
        <h2 id="faq-title">{t.faq.title}</h2>
        <div>
          {t.faq.items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p className="muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
