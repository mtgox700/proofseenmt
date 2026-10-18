import { describe, expect, it } from "vitest";
import { jobSitemap, renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";
import { nearbyMissionsSection, nearbyProfilesSection, nearbyReasonText, type NearbyMission, type NearbyProfile } from "../src/nearby";
import { profileSitemap, renderProfilePage, type PublicProfile } from "../src/profile-page";

/*
 * « Missions proches » et « Profils proches » sur les pages publiques (C22) : des liens HTML, sans script, avec la raison
 * de chaque proposition et la règle d'ordre ; jamais un pourcentage ; un pseudonyme désigné par sa référence.
 */

const BASE = "https://proofseen.com";

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

const NEAR_MISSIONS: readonly NearbyMission[] = [
  {
    id: "0199a1b2-0000-7000-8000-000000000002",
    title: "Lead <script>alert(1)</script> TypeScript",
    organisationName: "Beta & Co",
    city: "Paris",
    workMode: "onsite",
    reasons: [
      { kind: "skills", shared: ["PostgreSQL", "TypeScript"] },
      { kind: "city", city: "Paris" },
      { kind: "rate" },
    ],
  },
];

const PROFILE: PublicProfile = {
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "pseudonymous",
  displayName: null,
  headline: "Développeuse Rust",
  summary: "Systèmes embarqués.",
  city: "Lyon",
  workMode: "remote",
  availability: "available",
  availableFrom: null,
  dailyRateCents: 65_000,
  currency: "EUR",
  skills: ["Rust", "WebAssembly"],
  provenUrls: [],
  provenUrlCount: 0,
  missions: [],
  reviews: [],
  facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null },
  updatedAt: new Date("2026-10-06T00:00:00Z"),
};

const NEAR_PROFILES: readonly NearbyProfile[] = [
  { slug: "fr-fghjk", reference: "FR-FGHJK", headline: "Dev Rust", city: "Lyon", workMode: "remote", reasons: [{ kind: "skills", shared: ["Rust"] }, { kind: "languages", codes: ["de"] }] },
  { slug: "fr-named", reference: "FR-NAMED", displayName: "Jeanne Martin", headline: "Ingénieure Rust", city: "Nantes", workMode: "hybrid", reasons: [{ kind: "job_title", labels: ["Développeur embarqué"] }, { kind: "work_mode", mode: "hybrid" }] },
];

describe("sections de rapprochement", () => {
  it("rien du tout quand il n'y a aucune proposition", () => {
    expect(nearbyMissionsSection([], "fr")).toBe("");
    expect(nearbyProfilesSection([], "en")).toBe("");
  });

  it("des liens HTML échappés, la raison de chaque proposition et la règle d'ordre", () => {
    const html = nearbyMissionsSection(NEAR_MISSIONS, "fr");
    expect(html).toContain('<a href="/fr/missions/0199a1b2-0000-7000-8000-000000000002">');
    expect(html).toContain("Lead &lt;script&gt;alert(1)&lt;/script&gt; TypeScript");
    expect(html).not.toContain("<script");
    expect(html).toContain("Beta &amp; Co · Paris · Sur site");
    expect(html).toContain("2 compétences en commun (PostgreSQL, TypeScript) · même ville (Paris) · fourchettes de TJM qui se recouvrent");
    expect(html).toContain("Ordre : nombre de critères en commun");
    expect(html).not.toMatch(/%|score|compatib/i);
  });

  it("un pseudonyme par sa référence, un profil nominatif par son nom ; en anglais aussi", () => {
    const fr = nearbyProfilesSection(NEAR_PROFILES, "fr");
    expect(fr).toContain('<a href="/fr/profils/fr-fghjk">FR-FGHJK</a>');
    expect(fr).toContain('<a href="/fr/profils/fr-named">Jeanne Martin</a>');
    expect(fr).toContain("même métier (Développeur embarqué)");
    expect(fr).toMatch(/langue en commun \(allemand\)/i);
    const en = nearbyProfilesSection(NEAR_PROFILES, "en");
    expect(en).toContain("Similar profiles");
    expect(en).toContain("1 skill in common (Rust)");
    expect(`${fr}${en}`).not.toMatch(/%|score|compatib/i);
  });

  it("cite au plus quatre compétences et compte les autres", () => {
    expect(nearbyReasonText({ kind: "skills", shared: ["A", "B", "C", "D", "E", "F"] }, "fr", "mission")).toBe("6 compétences en commun (A, B, C, D et 2 autres)");
    expect(nearbyReasonText({ kind: "rate" }, "en", "profile")).toBe("close day rate (less than a fifth apart)");
  });
});

describe("pages publiques avec rapprochement", () => {
  const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
  const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });

  it("restent sans JavaScript et passent marketplace-verify", async () => {
    const missionUrl = `${BASE}/fr/missions/${MISSION.id}`;
    const profileUrl = `${BASE}/fr/profils/${PROFILE.slug}`;
    const served: Record<string, string> = {
      [missionUrl]: renderJobPage(MISSION, { baseUrl: BASE, lang: "fr", applyHref: "/fr/creer-un-compte", nearby: NEAR_MISSIONS }),
      [profileUrl]: renderProfilePage(PROFILE, { baseUrl: BASE, lang: "fr", contactHref: "/fr/app/contact/FR-ABCDE", nearby: NEAR_PROFILES }),
      [`${BASE}/robots.txt`]: marketplaceRobots(BASE),
      [`${BASE}/sitemap-missions.xml`]: jobSitemap(BASE, [{ id: MISSION.id, publishedAt: MISSION.publishedAt }]),
      [`${BASE}/sitemap-profiles.xml`]: profileSitemap(BASE, [{ slug: PROFILE.slug, updatedAt: PROFILE.updatedAt }]),
    };
    for (const page of [served[missionUrl] ?? "", served[profileUrl] ?? ""]) {
      expect(page.match(/<script/g)).toHaveLength(1);
      expect(page).toContain('<script type="application/ld+json">');
    }
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body === undefined) return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
      return url.endsWith(".txt") || url.endsWith(".xml") ? text(body) : html(body);
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: missionUrl, texts: ["Missions proches", "2 compétences en commun (PostgreSQL, TypeScript)"], sitemap: `${BASE}/sitemap-missions.xml` },
        { url: profileUrl, texts: ["Profils proches", "FR-FGHJK"], sitemap: `${BASE}/sitemap-profiles.xml` },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
