import type { Lang } from "../i18n/types";

/** Characters that would be markup inside a <script> element, and their JSON escapes (the hub's safeJsonLd does the same). */
const MARKUP: Readonly<Record<string, string>> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" };

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
  return JSON.stringify(graph).replace(/[<>&]/g, (character) => MARKUP[character] ?? character);
};
