import { describe, expect, it } from "vitest";
import { safeJsonLd } from "../src/html";
import { jobPosting, type PublicMission } from "../src/job-posting";

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  title: "Développeur TypeScript senior",
  description: "Refonte d'une plateforme de paiement.",
  skills: ["TypeScript", "PostgreSQL"],
  durationMonths: 6,
  dailyRateMinCents: 55_000,
  dailyRateMaxCents: 70_000,
  currency: "EUR",
  city: "Paris",
  workMode: "hybrid",
  publishedAt: new Date("2026-10-19T09:00:00Z"),
};

const OPTIONS = { baseUrl: "https://proofseen.com/", lang: "fr" as const };

describe("JobPosting", () => {
  it("décrit la mission avec les propriétés que les moteurs exigent", () => {
    const data = jobPosting(MISSION, OPTIONS);
    expect(data).toMatchObject({
      "@type": "JobPosting",
      title: MISSION.title,
      datePosted: "2026-10-19",
      validThrough: "2026-12-18T09:00:00.000Z",
      employmentType: "CONTRACTOR",
      hiringOrganization: { name: "Acme" },
      url: "https://proofseen.com/fr/missions/0199a1b2-0000-7000-8000-000000000001",
      baseSalary: { currency: "EUR", value: { minValue: 550, maxValue: 700, unitText: "DAY" } },
      jobLocation: { address: { addressLocality: "Paris", addressCountry: "FR" } },
    });
  });

  it("marque le télétravail comme tel, sans adresse inventée", () => {
    const data = jobPosting({ ...MISSION, workMode: "remote", city: null }, OPTIONS);
    expect(data).toMatchObject({ jobLocationType: "TELECOMMUTE" });
    expect(data).not.toHaveProperty("jobLocation");
  });

  it("n'annonce aucun TJM quand l'entreprise n'en a pas donné", () => {
    expect(jobPosting({ ...MISSION, dailyRateMinCents: null, dailyRateMaxCents: null }, OPTIONS)).not.toHaveProperty("baseSalary");
    expect(jobPosting({ ...MISSION, dailyRateMinCents: null }, OPTIONS)).toMatchObject({ baseSalary: { value: { minValue: 700, maxValue: 700 } } });
  });

  it("ne laisse pas un titre piégé sortir du bloc de données", () => {
    const html = safeJsonLd(jobPosting({ ...MISSION, title: "</script><script>alert(1)</script>" }, OPTIONS));
    expect(html).not.toContain("</script>");
    expect(JSON.parse(html)).toMatchObject({ title: "</script><script>alert(1)</script>" });
  });
});
