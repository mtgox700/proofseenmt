import { describe, expect, it } from "vitest";
import { profileSitemap, renderProfilePage, type PublicProfile } from "../src/profile-page";

const PROFILE: PublicProfile = {
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "pseudonymous",
  displayName: null,
  headline: "Développeuse Rust",
  summary: "Systèmes embarqués et WebAssembly.",
  city: "Lyon",
  workMode: "remote",
  availability: "available",
  availableFrom: null,
  dailyRateCents: 65_000,
  currency: "EUR",
  skills: ["Rust", "WebAssembly"],
  provenUrls: [],
  provenUrlCount: 2,
  missions: [{ role: "Lead Rust", clientKind: "pme", durationMonths: 8, summary: "Firmware d'objets connectés.", evidenceKind: "facture", verifiedAt: new Date("2026-09-01T00:00:00Z") }],
  reviews: [{ rating: 5, body: "Livré dans les temps.", createdAt: new Date("2026-10-01T00:00:00Z") }],
  facts: { registryActiveCheckedAt: new Date("2026-10-05T00:00:00Z"), identityVerified: true, payingClients: 3, vigilanceValidUntil: new Date("2027-03-01T00:00:00Z") },
  updatedAt: new Date("2026-10-06T00:00:00Z"),
};

const OPTIONS = { baseUrl: "https://proofseen.com", lang: "fr" as const, contactHref: "/fr/entreprise/FR-ABCDE" };
const jsonLdOf = (html: string): Record<string, unknown> => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as Record<string, unknown>;

describe("page publique d'un profil", () => {
  it("affiche des faits vérifiés et datés, sans SIRET, sans niveau ni score", () => {
    const html = renderProfilePage(PROFILE, OPTIONS);
    expect(html).toContain("Faits vérifiés");
    expect(html).toContain("Entreprise active au répertoire officiel des entreprises (vérifié le 5 octobre 2026)");
    expect(html).toContain("Identité vérifiée par le prestataire de paiement");
    expect(html).toContain("Payé sur Proofseen par 3 entreprises différentes");
    // L'apostrophe sort échappée dans le HTML, comme tout texte.
    expect(html).toContain("Attestation de vigilance URSSAF vérifiée, valable jusqu&#39;au 1 mars 2027");
    expect(html).not.toMatch(/\b\d{14}\b|niveau|score|super/i);
    const none = renderProfilePage({ ...PROFILE, facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null } }, OPTIONS);
    expect(none).not.toContain("Faits vérifiés");
  });


  it("se lit sans JavaScript et porte des faits vérifiés", () => {
    const html = renderProfilePage(PROFILE, OPTIONS);
    expect(html.match(/<script/g)).toHaveLength(1);
    for (const fact of ["Développeuse Rust", "Lyon · Télétravail", "Lead Rust", "PME · 8 mois", "Facture", "2 adresses prouvées.", "Livré dans les temps.", "Contacter ce freelance sur Proofseen"]) {
      expect(html).toContain(fact);
    }
  });

  it("ne dévoile ni nom ni adresse d'un profil pseudonyme", () => {
    const html = renderProfilePage({ ...PROFILE, displayName: "Camille Martin" }, OPTIONS);
    expect(html).not.toContain("Camille Martin");
    expect(html).toContain("Freelance FR-ABCDE");
    expect(jsonLdOf(html)).toMatchObject({ mainEntity: { name: "Freelance FR-ABCDE", identifier: "FR-ABCDE" } });
    expect(jsonLdOf(html).mainEntity).not.toHaveProperty("sameAs");
  });

  it("montre le nom et les adresses prouvées d'un profil nominatif", () => {
    const html = renderProfilePage({ ...PROFILE, visibility: "named", displayName: "Camille Martin", provenUrls: ["https://camille.dev"], provenUrlCount: 1 }, OPTIONS);
    expect(html).toContain("<h1 class=\"title\">Camille Martin</h1>");
    expect(html).toContain('href="https://camille.dev" rel="me noopener"');
    expect(jsonLdOf(html)).toMatchObject({ mainEntity: { name: "Camille Martin", sameAs: ["https://camille.dev"] } });
  });

  it("ne publie aucune note agrégée ni aucun score de la personne", () => {
    const ld = JSON.stringify(jsonLdOf(renderProfilePage(PROFILE, OPTIONS)));
    expect(ld).not.toMatch(/aggregateRating|ratingValue|reviewCount|score/i);
  });

  it("échappe tout texte venu du profil", () => {
    const html = renderProfilePage({ ...PROFILE, summary: "<script>alert(1)</script>", headline: "</script><b>x</b>" }, OPTIONS);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<b>x</b>");
  });

  it("liste chaque profil publié dans le sitemap, dans les deux langues", () => {
    const xml = profileSitemap("https://proofseen.com", [{ slug: "fr-abcde", updatedAt: new Date("2026-10-06T00:00:00Z") }]);
    expect(xml).toContain("<loc>https://proofseen.com/en/profils/fr-abcde</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });
});
