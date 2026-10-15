import { describe, expect, it } from "vitest";
import { renderProfilePage, type PublicProfile } from "../src/profile-page";
import type { PublicSectionsView } from "../src/profile-sections";

/*
 * Sections déclarées de la page publique : du HTML lisible sans JavaScript, tout texte échappé, des données structurées
 * fidèles à ce qui est affiché, et rien d'identifiant pour un profil pseudonyme.
 */

const SECTIONS: PublicSectionsView = {
  experiences: [
    { title: "Lead data engineer", company: "Acme Énergie", startMonth: new Date("2023-03-01T00:00:00Z"), endMonth: null, description: "Plateforme Spark et dbt.", skills: ["Spark", "dbt"] },
    { title: "Data engineer", company: null, startMonth: new Date("2019-01-01T00:00:00Z"), endMonth: new Date("2023-02-01T00:00:00Z"), description: null, skills: [] },
  ],
  educations: [{ school: "INSA Lyon", degree: "Diplôme d'ingénieur", startYear: 2014, endYear: 2019 }],
  certifications: [{ name: "AWS Solutions Architect", issuer: "Amazon Web Services", year: 2024, credentialUrl: "https://aws.example.com/verify/123", skills: ["AWS"] }],
  languages: [
    { code: "en", level: "c1" },
    { code: "fr", level: "native" },
  ],
  portfolio: [{ title: "Tableau de bord énergie", url: "https://demo.example.com", description: "Démonstration publique.", imageFileId: "0d6f5b3e-8f4a-4c55-9a76-2b9c1f0e7a11" }],
};

const BARE: PublicProfile = {
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "named",
  displayName: "Camille Martin",
  headline: "Data engineer",
  summary: "Pipelines de données.",
  city: "Lyon",
  workMode: "hybrid",
  availability: "available",
  availableFrom: null,
  dailyRateCents: 70_000,
  currency: "EUR",
  skills: ["Spark"],
  provenUrls: [],
  provenUrlCount: 0,
  missions: [],
  reviews: [],
  facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null },
  updatedAt: new Date("2026-10-12T00:00:00Z"),
};

const NAMED: PublicProfile = {
  ...BARE,
  photoFileId: "9b2a7c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  availabilityConfirmedAt: new Date("2026-10-10T00:00:00Z"),
  sections: SECTIONS,
};

const OPTIONS = { baseUrl: "https://proofseen.com", lang: "fr" as const, contactHref: "/fr/app/contact/FR-ABCDE" };
const jsonLdOf = (html: string): { mainEntity: Record<string, unknown> } =>
  JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { mainEntity: Record<string, unknown> };

describe("sections déclarées de la page publique", () => {
  it("montre chaque section en HTML simple, sans script hors données structurées", () => {
    const html = renderProfilePage(NAMED, OPTIONS);
    expect(html.match(/<script/g)).toHaveLength(1);
    for (const fact of [
      "Expériences déclarées",
      "Lead data engineer",
      "Acme Énergie · mars 2023 – aujourd&#39;hui",
      "janvier 2019 – février 2023",
      "INSA Lyon",
      "Diplôme d&#39;ingénieur · 2014 – 2019",
      "AWS Solutions Architect",
      "Amazon Web Services · 2024",
      "anglais · C1",
      "français · langue maternelle",
      "Tableau de bord énergie",
      "Disponibilité confirmée le",
      "10 octobre 2026",
    ]) {
      expect(html).toContain(fact);
    }
    expect(html).toContain('<img class="avatar" src="https://proofseen.com/fichiers/9b2a7c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d"');
    expect(html).toContain('href="https://demo.example.com" rel="nofollow noopener ugc"');
    expect(html).toContain('href="https://aws.example.com/verify/123" rel="nofollow noopener ugc"');
    expect(html).toContain('src="https://proofseen.com/fichiers/0d6f5b3e-8f4a-4c55-9a76-2b9c1f0e7a11"');
    expect(html).not.toMatch(/display\s*:\s*none|opacity\s*:\s*0[;}]|font-size\s*:\s*0[;}]/);
  });

  it("porte langues, formation, certifications, entreprise actuelle et photo dans les données structurées", () => {
    const person = jsonLdOf(renderProfilePage(NAMED, OPTIONS)).mainEntity;
    expect(person.image).toBe("https://proofseen.com/fichiers/9b2a7c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d");
    expect(person.knowsLanguage).toEqual([
      { "@type": "Language", name: "anglais", alternateName: "en" },
      { "@type": "Language", name: "français", alternateName: "fr" },
    ]);
    expect(person.alumniOf).toEqual([{ "@type": "EducationalOrganization", name: "INSA Lyon" }]);
    expect(person.hasCredential).toEqual([
      {
        "@type": "EducationalOccupationalCredential",
        name: "AWS Solutions Architect",
        credentialCategory: "certification",
        recognizedBy: { "@type": "Organization", name: "Amazon Web Services" },
        url: "https://aws.example.com/verify/123",
      },
    ]);
    // Seule l'expérience en cours, et seulement si l'entreprise est affichée.
    expect(person.worksFor).toEqual([{ "@type": "Organization", name: "Acme Énergie" }]);
    expect(JSON.stringify(person)).not.toMatch(/score|rating|seniority|experienceYears/i);
  });

  it("ne montre jamais de photo sur un profil pseudonyme, même si elle arrivait jusqu'ici", () => {
    const html = renderProfilePage({ ...NAMED, visibility: "pseudonymous", displayName: null }, OPTIONS);
    expect(html).not.toContain('class="avatar"');
    expect(jsonLdOf(html).mainEntity).not.toHaveProperty("image");
  });

  it("profil pseudonyme : ni entreprise, ni école, ni image, ni adresse, même si elles arrivaient jusqu'ici", () => {
    const html = renderProfilePage({ ...NAMED, visibility: "pseudonymous", displayName: null }, OPTIONS);
    for (const identifying of ["Acme Énergie", "INSA Lyon", "0d6f5b3e-8f4a-4c55-9a76-2b9c1f0e7a11", "https://demo.example.com", "https://aws.example.com/verify/123", 'class="shot"']) {
      expect(html).not.toContain(identifying);
    }
    // Restent le rôle, les dates, le diplôme, les compétences, l'organisme de certification.
    for (const fact of ["Lead data engineer", "mars 2023 – aujourd&#39;hui", "<h3>Diplôme d&#39;ingénieur</h3><p class=\"when\">2014 – 2019</p>", "Spark", "Amazon Web Services · 2024", "Tableau de bord énergie"]) {
      expect(html).toContain(fact);
    }
    const person = jsonLdOf(html).mainEntity;
    expect(person).not.toHaveProperty("alumniOf");
    expect(person).not.toHaveProperty("worksFor");
    expect(JSON.stringify(person.hasCredential)).not.toContain("https://");
  });

  it("n'affiche pas d'entreprise masquée et n'en fait pas un employeur", () => {
    const hidden: PublicSectionsView = { ...SECTIONS, experiences: [{ ...SECTIONS.experiences[0]!, company: null }] };
    const html = renderProfilePage({ ...NAMED, sections: hidden }, OPTIONS);
    expect(html).not.toContain("Acme Énergie");
    expect(jsonLdOf(html).mainEntity).not.toHaveProperty("worksFor");
  });

  it("échappe tout texte et toute adresse déclarés", () => {
    const hostile: PublicSectionsView = {
      experiences: [{ title: "<script>alert(1)</script>", company: "\"><img src=x onerror=alert(1)>", startMonth: new Date("2024-01-01T00:00:00Z"), endMonth: null, description: "</p><b>x</b>", skills: ["<i>"] }],
      educations: [{ school: "<u>École</u>", degree: null, startYear: null, endYear: null }],
      certifications: [{ name: "Cert </script>", issuer: null, year: null, credentialUrl: "https://x.example.com/?a=\"><script>", skills: [] }],
      languages: [{ code: "en", level: "b2" }],
      portfolio: [{ title: "<svg onload=alert(1)>", url: "https://x.example.com/\"onmouseover=\"alert(1)", description: null, imageFileId: null }],
    };
    const html = renderProfilePage({ ...NAMED, sections: hostile }, OPTIONS);
    expect(html).not.toMatch(/<script>alert|<img src=x|<b>x<\/b>|<u>École|<svg onload|"onmouseover=/);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toContain("</script><");
  });

  it("une page sans sections reste celle d'avant", () => {
    const html = renderProfilePage(BARE, OPTIONS);
    expect(html).not.toContain("Expériences déclarées");
    expect(html).not.toContain("Disponibilité confirmée");
    expect(jsonLdOf(html).mainEntity).not.toHaveProperty("knowsLanguage");
  });
});
