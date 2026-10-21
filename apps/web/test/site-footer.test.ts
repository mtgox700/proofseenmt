import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { marketFooter } from "@proofseen/hub";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "../src/components/SiteFooter";
import { dictionary } from "../src/i18n";

/*
 * One footer for the whole site (Kensa m1): the React pages render the footer of the HTML hub, same legal links, same
 * trademark sentence, same markup. No sales line, no order page, no price.
 */

// The two serialisers differ only in form: React closes void elements ("/>"), writes the apostrophe as &#x27; and keeps
// the camel case of srcSet (HTML attribute names ignore case).
const normalise = (html: string): string => html.replace(/\s*\/>/g, ">").replace(/&#x27;|&#39;/g, "'").replace(/\bsrcSet=/g, "srcset=");

describe("one footer, in React and in the hub", () => {
  it.each(["fr", "en"] as const)("%s: React renders the hub's footer, element for element", (lang) => {
    const react = renderToStaticMarkup(createElement(SiteFooter, { lang, t: dictionary(lang) }));
    expect(normalise(react)).toBe(normalise(marketFooter(lang)));
  });

  it.each(["fr", "en"] as const)("%s: says no sales line and links no order page", (lang) => {
    const react = renderToStaticMarkup(createElement(SiteFooter, { lang, t: dictionary(lang) }));
    expect(react).not.toMatch(/commande|Commander|Order page|€|visibilit/i);
    expect("line" in dictionary(lang).footer).toBe(false);
    expect("legal" in dictionary(lang).footer).toBe(false);
  });
});
