import { describe, expect, it } from "vitest";
import { renderSkillPage, skillSitemap, type SkillPageView } from "../src/skill-page";

const PAGE: SkillPageView = {
  key: "rust",
  label: "Rust",
  missions: [{ id: "0199a1b2-0000-7000-8000-000000000001", title: "Firmware Rust", organisationName: "Acme", workMode: "hybrid", city: "Lyon" }],
  profiles: [
    { slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Dev Rust", city: "Lyon" },
    { slug: "fr-bcdef", reference: "FR-BCDEF", displayName: "Camille Martin", headline: "Lead Rust", city: "Paris" },
  ],
};

describe("page métier", () => {
  it("liste les missions et les profils réels, sans JavaScript", () => {
    const html = renderSkillPage(PAGE, { baseUrl: "https://proofseen.com", lang: "fr" });
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain("Rust : missions et freelances");
    expect(html).toContain("1 mission ouverte et 2 profils publiés sur Proofseen.");
    expect(html).toContain('href="/fr/missions/0199a1b2-0000-7000-8000-000000000001"');
    expect(html).toContain("Freelance FR-ABCDE");
    expect(html).toContain("Camille Martin");
  });

  it("décrit une collection d'adresses, sans aucune note", () => {
    const html = renderSkillPage(PAGE, { baseUrl: "https://proofseen.com", lang: "en" });
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    expect(JSON.parse(ld)).toMatchObject({ "@type": "CollectionPage", mainEntity: { numberOfItems: 3 } });
    expect(ld).not.toMatch(/rating|score/i);
  });

  it("entre dans le sitemap dans les deux langues", () => {
    expect(skillSitemap("https://proofseen.com", [{ key: "c++" }])).toContain("<loc>https://proofseen.com/en/metiers/c%2B%2B</loc>");
  });
});
