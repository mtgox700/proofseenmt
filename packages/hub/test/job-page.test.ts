import { describe, expect, it } from "vitest";
import { jobSitemap, rateText, renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  title: "Développeur TypeScript senior",
  description: "Refonte d'une plateforme de paiement.\n\nÉquipe de six, livraison continue.",
  skills: ["TypeScript", "PostgreSQL"],
  durationMonths: 6,
  dailyRateMinCents: 55_000,
  dailyRateMaxCents: 70_000,
  currency: "EUR",
  city: "Paris",
  workMode: "hybrid",
  publishedAt: new Date("2026-10-19T09:00:00Z"),
};

const OPTIONS = { baseUrl: "https://proofseen.com", lang: "fr" as const, applyHref: "/fr/creer-un-compte" };

const jsonLdOf = (html: string): unknown => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "null");

describe("page publique d'une mission", () => {
  it("se lit sans JavaScript : un seul script, et c'est le bloc de données", () => {
    const html = renderJobPage(MISSION, OPTIONS);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toMatch(/<h1 class="title">Développeur TypeScript senior<\/h1>/);
    expect(html).toContain("Paris · Hybride");
    expect(html).toContain("6 mois");
    expect(html).toContain("<li>PostgreSQL</li>");
    // Les deux paragraphes de la description restent deux paragraphes.
    expect(html.match(/<p class="lede">/g)).toHaveLength(2);
  });

  it("porte ses données structurées et ses liens de langue", () => {
    const html = renderJobPage(MISSION, OPTIONS);
    expect(jsonLdOf(html)).toMatchObject({ "@type": "JobPosting", title: MISSION.title, hiringOrganization: { name: "Acme" } });
    expect(html).toContain('<link rel="canonical" href="https://proofseen.com/fr/missions/0199a1b2-0000-7000-8000-000000000001">');
    expect(html).toContain('hreflang="en" href="https://proofseen.com/en/missions/0199a1b2-0000-7000-8000-000000000001"');
    expect(renderJobPage(MISSION, { ...OPTIONS, lang: "en" })).toContain("Paris · Hybrid");
  });

  it("dit l'entreprise active au répertoire seulement quand c'est vérifié, et date le fait", () => {
    // Sans contrôle établi : ni l'affirmation, ni le vert ; une ligne neutre dit que l'activité n'est pas confirmée.
    const unchecked = renderJobPage(MISSION, OPTIONS);
    expect(unchecked).not.toContain("Entreprise active au répertoire officiel");
    expect(unchecked).toContain('<p class="vline open"><span class="pin open" aria-hidden="true"></span><span>Activité au répertoire officiel des entreprises non confirmée</span></p>');
    expect(unchecked).not.toContain('<span class="pin" aria-hidden="true">');
    const html = renderJobPage({ ...MISSION, organisationRegistryActiveCheckedAt: new Date("2026-10-07T00:00:00Z") }, OPTIONS);
    expect(html).toContain('<span class="pin" aria-hidden="true"></span><span>Entreprise active au répertoire officiel des entreprises (vérifié le 7 octobre 2026)</span>');
  });

  it("donne le délai de réponse de l'entreprise comme un fait, avec sa base de calcul", () => {
    expect(renderJobPage(MISSION, OPTIONS)).not.toContain("Répond aux candidatures");
    const html = renderJobPage({ ...MISSION, organisationResponse: { medianDays: 3, decided: 12 } }, OPTIONS);
    expect(html).toContain("Répond aux candidatures en 3 jours (médiane sur 12 candidatures, six derniers mois)");
  });

  it("échappe tout texte venu de l'entreprise", () => {
    const html = renderJobPage({ ...MISSION, title: '<img src=x onerror="alert(1)">', organisationName: "A&B", description: "<script>alert(1)</script>" }, OPTIONS);
    // The header carries the brand lockup as an <img>: what must never appear is the image injected by the company.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("A&amp;B");
    expect(jsonLdOf(html)).toMatchObject({ title: '<img src=x onerror="alert(1)">' });
  });

  it("écrit le TJM tel que l'entreprise l'a donné, sans en inventer", () => {
    expect(rateText(MISSION, "fr")).toMatch(/550\s€ – 700\s€ \/ jour/);
    expect(rateText({ ...MISSION, dailyRateMinCents: null }, "fr")).toMatch(/^700\s€ \/ jour$/);
    expect(rateText({ ...MISSION, dailyRateMinCents: null, dailyRateMaxCents: null }, "fr")).toBe("Non précisé");
  });
});

describe("sitemap des missions", () => {
  it("liste chaque mission ouverte dans les deux langues", () => {
    const xml = jobSitemap("https://proofseen.com", [{ id: MISSION.id, publishedAt: MISSION.publishedAt }]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://proofseen.com/en/missions/0199a1b2-0000-7000-8000-000000000001</loc>");
    expect(xml).toContain("<lastmod>2026-10-19</lastmod>");
  });
});
