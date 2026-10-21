import type { Lang } from "../i18n/types";

/*
 * What the home page tells engines about the house, in schema.org: the organisation and the site, nothing else. No
 * rating, no review, no offer: none is real yet. The hub pages carry their own graph (profiles, datasets, articles).
 */
export const homeJsonLd = (lang: Lang, origin: string, description: string): string => {
  const organisation = `${origin}/#organisation`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": organisation, name: "Proofseen", url: origin, logo: `${origin}/brand/icon-512.png` },
      { "@type": "WebSite", "@id": `${origin}/${lang}#site`, name: "Proofseen", url: `${origin}/${lang}`, inLanguage: lang, description, publisher: { "@id": organisation } },
    ],
  };
  // Inside a <script> element "<" must not open a tag: escaped, it stays the same JSON.
  return JSON.stringify(graph).replace(/</g, "\u003c");
};
