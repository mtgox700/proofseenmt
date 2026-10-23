import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toDirectoryCard, type ProfileCard } from "@proofseen/db";
import { profileCardBody, profileCardFields } from "@proofseen/hub";
import { describe, expect, it } from "vitest";
import { profileCardView } from "../src/lib/profile-card-view";

/*
 * Lot c of the redesign: the marketplace has one profile card. The public directory (hub HTML) and the company search
 * (React) render the same body from the same function, on the same CSS. These tests hold that: the same search result
 * gives the same fields and the same markup on both surfaces, and the React card writes no card markup of its own.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts: string[]): string => readFileSync(join(web, ...parts), "utf8");
const NOW = new Date("2026-10-21T12:00:00Z");

const BASE: ProfileCard = {
  id: "7d0e5b8a-1f2c-4c3d-9e4f-5a6b7c8d9e0f",
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "pseudonymous",
  headline: "Développeuse Rust embarqué",
  summary: "Résumé.",
  city: "Lyon",
  workMode: "hybrid",
  dailyRateCents: 65_000,
  currency: "EUR",
  availability: "available",
  availableFrom: null,
  skills: ["Rust", "C", "Linux", "Yocto", "Zephyr", "CAN", "RTOS", "Git"],
  verifiedUrls: 1,
  verifiedMissions: 2,
  photoFileId: null,
  registryActive: true,
  vigilanceValid: true,
  identityVerified: true,
  payingClients: 1,
  hasPortfolio: true,
  availabilityAt: new Date("2026-10-10T08:00:00Z"),
  updatedAt: new Date("2026-10-12T08:00:00Z"),
  languages: [
    { code: "en", level: "c1" },
    { code: "fr", level: "native" },
  ],
};

const CASES: Readonly<Record<string, ProfileCard>> = {
  "pseudonymous, every verified fact": BASE,
  "named, with a photo, nothing verified yet": {
    ...BASE,
    reference: "FR-BCDEF",
    slug: "fr-bcdef",
    visibility: "named",
    displayName: "Camille Martin",
    photoFileId: "0b5a6f8e-2c1d-4e3f-9a7b-1c2d3e4f5a6b",
    dailyRateCents: null,
    availability: "available_from",
    availableFrom: new Date("2026-12-01T00:00:00Z"),
    skills: [],
    languages: [],
    hasPortfolio: false,
    verifiedUrls: 0,
    verifiedMissions: 0,
    registryActive: false,
    vigilanceValid: false,
    identityVerified: false,
    payingClients: 0,
  },
  // Confirmed more than 30 days ago: both surfaces read the same database rule (C23).
  "availability past the 30 days": { ...BASE, availabilityAt: new Date("2026-09-01T08:00:00Z") },
};

describe("one profile card for the directory and the company search", () => {
  for (const [name, card] of Object.entries(CASES)) {
    it.each(["fr", "en"] as const)(`${name} (%s): same fields, same markup`, (lang) => {
      const [directoryCard] = toDirectoryCard(card, NOW);
      if (directoryCard === undefined) throw new Error("the directory dropped a published card");
      const search = profileCardView(card, NOW);
      expect(profileCardFields(search, lang)).toEqual(profileCardFields(directoryCard, lang));
      expect(profileCardBody(search, lang, "h")).toBe(profileCardBody(directoryCard, lang, "h"));
    });
  }

  it("keeps a pseudonymous card nameless and faceless on the search side too", () => {
    const fields = profileCardFields(profileCardView({ ...BASE, photoFileId: "aaaaaaaa-0000-4000-8000-000000000000" }, NOW), "fr");
    expect(fields.name).toBe("Freelance FR-ABCDE");
    expect(fields.photo).toBeNull();
  });

  it("says a stale availability is not confirmed, never available", () => {
    const fields = profileCardFields(profileCardView(CASES["availability past the 30 days"]!, NOW), "fr");
    expect(fields.availability).toMatchObject({ state: "Disponibilité non confirmée", tone: "stale" });
  });

  it("renders the shared body on the shared CSS, with no card markup of its own", () => {
    const component = read("src", "components", "search", "ProfileResultCard.tsx");
    expect(component).toContain("profileCardBody(profileCardView(card, now), lang, headingId)");
    expect(component).toContain('className="fiche-card"');
    expect(component).not.toMatch(/className="pc-|className="badge|className="avatar/);
    const page = read("src", "app", "[lang]", "app", "recherche", "page.tsx");
    expect(page).toContain('import "@proofseen/brand/profile-card.css";');
    // The key of the cards: green only when a card on screen carries a verified fact (Kensa M5).
    expect(page).toContain("profileCardKey(page.items, lang, now)");
    // The old copy of the card's CSS is gone from the React styles: one definition, in @proofseen/brand.
    expect(read("src", "styles", "discovery.css")).not.toMatch(/\.pc-count|\.pc-proof|\.pc-headline|\.fiche-card|\.fc-/);
  });

  it("is the only freelancer card of the application: lists, close profiles and applications use it too (lot 5)", () => {
    expect(existsSync(join(web, "src", "components", "market", "FreelancerCard.tsx"))).toBe(false);
    const screens = [
      ["src", "app", "[lang]", "app", "listes", "[id]", "page.tsx"],
      ["src", "app", "[lang]", "app", "missions", "[id]", "candidatures", "[applicationId]", "page.tsx"],
      ["src", "components", "market", "ProfilesForMission.tsx"],
    ];
    for (const parts of screens) {
      const source = read(...parts);
      expect(source, parts.join("/")).toContain("<ProfileResultCard ");
      expect(source, parts.join("/")).toContain('import "@proofseen/brand/profile-card.css";');
      expect(source, parts.join("/")).not.toMatch(/FreelancerCard|className="profile-row|className="profile-facts/);
    }
  });
});
