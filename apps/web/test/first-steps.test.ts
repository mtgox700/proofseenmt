import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { nextStepsEn } from "../src/i18n/market/next-steps-en";
import { nextStepsFr } from "../src/i18n/market/next-steps-fr";
import { availabilityDisplay } from "../src/lib/availability-display";
import { greetingName } from "../src/lib/greeting";
import { HOME_NOTICES, homeNoticeHref, readHomeNotice, returnsHome } from "../src/lib/home-notice";
import { NEXT_STEP_KEYS, nextSteps, type EmptyScreen } from "../src/lib/next-steps";

/* C23 : accueil par le nom, retour à l'accueil après un clic, états vides utiles, disponibilité des cartes. */

describe("dashboard greeting", () => {
  it("greets by the first name, then the display name, and never by the e-mail address", () => {
    expect(greetingName({ firstName: "Camille", displayName: "Camille Martin" })).toBe("Camille");
    expect(greetingName({ firstName: null, displayName: "Camille Martin" })).toBe("Camille Martin");
    expect(greetingName({ firstName: "  ", displayName: "camille@exemple.fr" })).toBeNull();
    expect(greetingName({ firstName: null, displayName: "camille@exemple.fr" })).toBeNull();
    expect(greetingName({ firstName: "x".repeat(61), displayName: null })).toBeNull();
  });

  it("says a neutral hello without a name, in both languages and on both sides", () => {
    expect(fr.app.freelance.title(null)).toBe("Bonjour.");
    expect(fr.app.company.title(null)).toBe("Bonjour.");
    expect(en.app.freelance.title(null)).toBe("Hello.");
    expect(en.app.company.title("Camille")).toBe("Hello, Camille.");
    const address = "camille@exemple.fr";
    expect(fr.app.freelance.title(greetingName({ firstName: null, displayName: address }))).not.toContain("@");
  });
});

describe("one-click actions of the home", () => {
  const form = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  };

  it("lands back home only when the form says so, with a known notice only", () => {
    expect(returnsHome(form({ retour: "accueil" }))).toBe(true);
    expect(returnsHome(form({ retour: "https://ailleurs.example" }))).toBe(false);
    expect(returnsHome(form({}))).toBe(false);
    expect(homeNoticeHref("fr", "publie")).toBe("/fr/app?avis=publie");
    for (const notice of HOME_NOTICES) expect(readHomeNotice(notice)).toBe(notice);
    expect(readHomeNotice("<script>")).toBeNull();
    expect(readHomeNotice(undefined)).toBeNull();
  });
});

describe("empty screens say what to do next", () => {
  const screens: readonly EmptyScreen[] = ["feed_following", "feed_discover", "missions_for_you", "companies_none", "companies_filtered"];

  it("gives every empty screen at least one link, inside the site", () => {
    for (const screen of screens) {
      for (const role of ["freelance", "company"] as const) {
        const steps = nextSteps("fr", screen, role);
        expect(steps.length, `${screen} ${role}`).toBeGreaterThan(0);
        for (const step of steps) expect(step.href.startsWith("/fr/")).toBe(true);
      }
    }
  });

  it("puts publishing first for a freelancer without a published profile", () => {
    expect(nextSteps("fr", "missions_for_you", "freelance", false)[0]).toEqual({ key: "publish_profile", href: "/fr/app" });
    expect(nextSteps("fr", "missions_for_you", "freelance", true).map((s) => s.key)).not.toContain("publish_profile");
  });

  it("invites from the connected screens: clients for a freelancer, freelancers for a company", () => {
    expect(nextSteps("en", "feed_following", "freelance").map((s) => s.key)).toContain("invite_clients");
    expect(nextSteps("en", "feed_following", "company").map((s) => s.key)).toEqual(["find_freelancers", "post_mission", "invite_freelancers"]);
    expect(nextSteps("en", "companies_none", "freelance")[0]).toEqual({ key: "invite_clients", href: "/en/app/invitations" });
  });

  it("names every step in both languages", () => {
    for (const key of NEXT_STEP_KEYS) {
      expect(nextStepsFr.steps[key].length, key).toBeGreaterThan(5);
      expect(nextStepsEn.steps[key].length, key).toBeGreaterThan(5);
    }
  });
});

describe("availability on the cards of the connected space", () => {
  const NOW = new Date("2026-11-20T09:00:00Z");
  const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

  it("reads not confirmed past 30 days, in the muted tone, never available", () => {
    expect(availabilityDisplay("available", daysAgo(10), NOW)).toEqual({ shown: "available", tone: "now" });
    expect(availabilityDisplay("available", daysAgo(31), NOW)).toEqual({ shown: "unconfirmed", tone: "off" });
    expect(availabilityDisplay("available_from", daysAgo(31), NOW)).toEqual({ shown: "unconfirmed", tone: "off" });
    expect(availabilityDisplay("available_from", daysAgo(2), NOW)).toEqual({ shown: "available_from", tone: "later" });
    expect(availabilityDisplay("unavailable", daysAgo(60), NOW)).toEqual({ shown: "unavailable", tone: "off" });
  });
});
