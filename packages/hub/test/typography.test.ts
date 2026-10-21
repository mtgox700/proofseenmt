import { describe, expect, it } from "vitest";
import { frenchSpacing, NARROW_NBSP, typeset } from "../src/typography";

const N = NARROW_NBSP;

describe("French typography of the hub", () => {
  it("puts a narrow no-break space before double punctuation and inside guillemets", () => {
    expect(frenchSpacing("Méthode : une seule entreprise ; puis ? enfin !")).toBe(`Méthode${N}: une seule entreprise${N}; puis${N}? enfin${N}!`);
    expect(frenchSpacing("« vérifiée »")).toBe(`«${N}vérifiée${N}»`);
    expect(frenchSpacing("Déjà\u00a0: fait")).toBe(`Déjà${N}: fait`);
  });

  it("leaves tags, attributes, scripts, styles and code alone", () => {
    const html =
      '<p title="a : b">Note : ici</p><script type="application/ld+json">{"a":"x : y"}</script>' +
      "<style>a :hover{}</style><pre><code>a ? b : c</code></pre><code>x : y</code><p>Fin !</p>";
    expect(typeset("fr", html)).toBe(
      `<p title="a : b">Note${N}: ici</p><script type="application/ld+json">{"a":"x : y"}</script>` +
        `<style>a :hover{}</style><pre><code>a ? b : c</code></pre><code>x : y</code><p>Fin${N}!</p>`,
    );
  });

  it("does not touch an English page", () => {
    expect(typeset("en", "<p>Note : here</p>")).toBe("<p>Note : here</p>");
  });
});
