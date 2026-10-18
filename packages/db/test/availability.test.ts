import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_FRESH_DAYS,
  AVAILABILITY_REMINDER_DAYS,
  availabilityFreshSince,
  availabilityReminderDue,
  isAvailabilityFresh,
  shownAvailability,
} from "../src/availability";
import { explainProfileForMission, MATCH_FRESH_DAYS, type MatchMission, type MatchProfile } from "../src/matching-criteria";
import { availabilityFreshSince as searchFreshSince, AVAILABILITY_FRESH_DAYS as SEARCH_FRESH_DAYS } from "../src/profile-search";

/*
 * La règle des 30 jours (C23), sur une horloge injectée : une seule source pour la recherche, le rapprochement et
 * l'affichage ; le rappel à 14 jours.
 */

const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-20T09:00:00Z");
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY_MS);

describe("fraîcheur de la disponibilité", () => {
  it("garde un seul seuil de 30 jours, lu par la recherche et par le rapprochement", () => {
    expect(AVAILABILITY_FRESH_DAYS).toBe(30);
    expect(SEARCH_FRESH_DAYS).toBe(AVAILABILITY_FRESH_DAYS);
    expect(MATCH_FRESH_DAYS).toBe(AVAILABILITY_FRESH_DAYS);
    expect(searchFreshSince(NOW)).toEqual(availabilityFreshSince(NOW));
    expect(AVAILABILITY_REMINDER_DAYS).toBe(14);
  });

  it("tient pour vraie une confirmation de 30 jours pile, plus celle d'une milliseconde de plus", () => {
    expect(isAvailabilityFresh(daysAgo(30), NOW)).toBe(true);
    expect(isAvailabilityFresh(new Date(daysAgo(30).getTime() - 1), NOW)).toBe(false);
  });

  it("affiche « non confirmée » au-delà de 30 jours, jamais « disponible », et laisse « indisponible » tel quel", () => {
    expect(shownAvailability("available", daysAgo(29), NOW)).toBe("available");
    expect(shownAvailability("available", daysAgo(31), NOW)).toBe("unconfirmed");
    expect(shownAvailability("available_from", daysAgo(31), NOW)).toBe("unconfirmed");
    expect(shownAvailability("available_from", daysAgo(3), NOW)).toBe("available_from");
    expect(shownAvailability("unavailable", daysAgo(90), NOW)).toBe("unavailable");
  });

  it("demande une reconfirmation à 14 jours, jamais pour une disponibilité déclarée « indisponible »", () => {
    expect(availabilityReminderDue("available", daysAgo(13), NOW)).toBe(false);
    expect(availabilityReminderDue("available", daysAgo(14), NOW)).toBe(true);
    expect(availabilityReminderDue("available_from", daysAgo(40), NOW)).toBe(true);
    expect(availabilityReminderDue("unavailable", daysAgo(40), NOW)).toBe(false);
  });
});

const mission: MatchMission = {
  id: "m",
  skills: [{ key: "go", label: "Go" }],
  families: [],
  city: null,
  cityKey: null,
  workMode: "remote",
  rateMin: null,
  rateMax: null,
  companyRegistryActive: false,
  publishedAt: NOW,
};

const profile = (availabilityAt: Date): MatchProfile => ({
  id: "p",
  skills: [{ key: "go", label: "Go" }],
  families: [],
  city: null,
  cityKey: null,
  workMode: "remote",
  rate: null,
  availability: "available",
  availableFrom: null,
  availabilityAt,
  languages: [],
  provenUrls: 0,
  verifiedMissions: 0,
  registryActive: false,
  vigilanceValid: false,
  updatedAt: NOW,
});

describe("critère « disponibilité » du rapprochement", () => {
  it("compte une disponibilité confirmée depuis 30 jours au plus, la dit manquante au-delà", () => {
    const fresh = explainProfileForMission(mission, profile(daysAgo(30)), NOW);
    expect(fresh.matched.some((r) => r.kind === "availability")).toBe(true);
    const stale = explainProfileForMission(mission, profile(daysAgo(31)), NOW);
    expect(stale.matched.some((r) => r.kind === "availability")).toBe(false);
    expect(stale.missing).toContain("availability");
  });
});
