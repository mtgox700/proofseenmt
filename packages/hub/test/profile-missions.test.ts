import { describe, expect, it } from "vitest";
import { renderProfilePage, type PublicProfile } from "../src/profile-page";

const BASE: PublicProfile = {
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
  dailyRateCents: null,
  currency: "EUR",
  skills: [],
  provenUrls: [],
  provenUrlCount: 0,
  missions: [],
  reviews: [],
  facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null },
  updatedAt: new Date("2026-10-06T00:00:00Z"),
};

const OPTIONS = { baseUrl: "https://proofseen.com", lang: "fr" as const, contactHref: "/fr/app/contact/FR-ABCDE" };

const confirmed = { role: "Lead Rust", clientKind: "pme", durationMonths: 6, summary: "Firmware.", evidenceKind: "client_confirmation", verifiedAt: new Date("2026-10-14T09:00:00Z") };
const paid = { role: "Audit Rust", clientKind: "eti", durationMonths: 1, summary: "", evidenceKind: "paid_on_platform", verifiedAt: new Date("2026-10-02T09:00:00Z") };

describe("missions vérifiées sur la page publique", () => {
  it("montre chaque mission comme un fait daté, avec la façon dont elle a été vérifiée", () => {
    const html = renderProfilePage({ ...BASE, missions: [confirmed, paid] }, OPTIONS);
    expect(html).toContain("Confirmée par le client le 14 octobre 2026");
    expect(html).toContain("Payée sur Proofseen, vérifiée le 2 octobre 2026");
    const byContact = renderProfilePage({ ...BASE, missions: [{ ...confirmed, confirmedBy: "contact" }] }, OPTIONS);
    expect(byContact).toContain("Confirmée par un contact chez le client le 14 octobre 2026");
    // Aucun résumé inventé pour une mission payée : pas de paragraphe vide.
    expect(html).not.toContain("<p></p>");
  });

  it("ne nomme le client que s'il l'a autorisé, sinon son type seulement", () => {
    const anonymous = renderProfilePage({ ...BASE, missions: [{ ...confirmed, clientName: null }] }, OPTIONS);
    expect(anonymous).toContain("PME · 6 mois");
    const named = renderProfilePage({ ...BASE, missions: [{ ...confirmed, clientName: "Acme & Cie" }] }, OPTIONS);
    expect(named).toContain("Acme &amp; Cie · 6 mois");
  });

  it("existe en anglais", () => {
    const html = renderProfilePage({ ...BASE, missions: [confirmed, paid] }, { ...OPTIONS, lang: "en" });
    expect(html).toContain("Confirmed by the client on 14 October 2026");
    expect(html).toContain("Paid on Proofseen, verified on 2 October 2026");
  });
});
