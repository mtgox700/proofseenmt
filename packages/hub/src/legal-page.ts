import { escapeHtml as e } from "./html";
import { LEGAL_VERSION, LEGAL_VERSION_DATE, PUBLISHER } from "./legal-facts";
import { legalNotice } from "./legal-notice";
import { privacyPolicy } from "./legal-privacy";
import { termsOfUse } from "./legal-terms";
import { LEGAL_LABELS, LEGAL_PAGES, type Lang, type LegalPage } from "./market-shell";
import { renderFrame } from "./page-frame";

/*
 * Les trois pages légales (mentions légales, confidentialité, conditions d'utilisation) : du HTML complet rendu côté
 * serveur, sans JavaScript, identique pour chaque visiteur. Chaque page a son sommaire, sa date de version et des liens
 * vers les deux autres. Le texte vient de fichiers rédigés à partir de ce que le code fait réellement ; ce sont des
 * fragments HTML écrits ici, jamais une saisie d'utilisateur.
 */

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  /** Fragments HTML statiques, rédigés dans ce paquet. */
  readonly body: readonly string[];
}

export interface LegalDocument {
  readonly title: string;
  readonly description: string;
  readonly lead: string;
  readonly sections: readonly LegalSection[];
}

const DOCUMENTS: Readonly<Record<LegalPage, (lang: Lang) => LegalDocument>> = {
  "mentions-legales": legalNotice,
  confidentialite: privacyPolicy,
  conditions: termsOfUse,
};

const COPY = {
  fr: { toc: "Sommaire", related: "Voir aussi" },
  en: { toc: "Contents", related: "See also" },
} as const;

const STYLES =
  ".legal h2{margin-top:3rem}.legal section{scroll-margin-top:1rem}" +
  ".legal .version{margin-top:.8rem;font:500 .85rem/1.3 var(--mono);color:var(--muted)}" +
  ".legal dl{display:grid;grid-template-columns:minmax(9rem,max-content) 1fr;gap:.4rem 1.2rem;margin:0 0 1.1rem}" +
  ".legal dt{color:var(--muted)}.legal dd{margin:0}" +
  "@media (max-width:40rem){.legal dl{grid-template-columns:1fr}.legal dd{margin-bottom:.5rem}}";

export const legalUrl = (baseUrl: string, lang: Lang, page: LegalPage): string => `${baseUrl}/${lang}/${page}`;

export const isLegalPage = (value: string): value is LegalPage => (LEGAL_PAGES as readonly string[]).includes(value);

export const legalDocument = (lang: Lang, page: LegalPage): LegalDocument => DOCUMENTS[page](lang);

export interface LegalPageOptions {
  readonly baseUrl: string;
  readonly lang: Lang;
  readonly page: LegalPage;
}

const toc = (lang: Lang, sections: readonly LegalSection[]): string =>
  `<nav class="toc" aria-labelledby="toc-title"><strong id="toc-title">${COPY[lang].toc}</strong><ol>` +
  sections.map((s) => `<li><a href="#${s.id}">${e(s.title)}</a></li>`).join("") +
  "</ol></nav>";

const related = (lang: Lang, page: LegalPage): string =>
  `<h2>${COPY[lang].related}</h2><ul class="more">` +
  LEGAL_PAGES.filter((p) => p !== page)
    .map((p) => `<li><a href="/${lang}/${p}">${e(LEGAL_LABELS[lang][p])}</a></li>`)
    .join("") +
  "</ul>";

export const renderLegalPage = (o: LegalPageOptions): string => {
  const doc = legalDocument(o.lang, o.page);
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const canonical = legalUrl(o.baseUrl, o.lang, o.page);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: doc.title,
    url: canonical,
    description: doc.description,
    inLanguage: o.lang,
    dateModified: LEGAL_VERSION_DATE,
    publisher: { "@type": "Organization", name: PUBLISHER.name, vatID: PUBLISHER.vat, address: PUBLISHER.address },
  };
  const sections = doc.sections.map((s) => `<section id="${s.id}"><h2>${e(s.title)}</h2>${s.body.join("")}</section>`);
  return renderFrame({
    lang: o.lang,
    title: doc.title,
    description: doc.description,
    canonical,
    alternates: { fr: legalUrl(o.baseUrl, "fr", o.page), en: legalUrl(o.baseUrl, "en", o.page) },
    jsonLd,
    otherHref: `/${other}/${o.page}`,
    styles: STYLES,
    main: [
      '<article class="legal">',
      `<h1 class="title">${e(doc.title)}</h1>`,
      `<p class="version">${LEGAL_VERSION[o.lang]}</p>`,
      `<p class="headline">${e(doc.lead)}</p>`,
      toc(o.lang, doc.sections),
      `<div class="prose">${sections.join("")}${related(o.lang, o.page)}</div>`,
      "</article>",
    ],
  });
};

