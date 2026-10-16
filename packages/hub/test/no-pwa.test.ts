import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";
import { renderSkillPage, type SkillPageView } from "../src/skill-page";

/*
 * L'application installable (C20) vit dans l'espace connecté seulement. Les pages publiques restent du HTML brut, sans
 * JavaScript, identiques pour un robot et pour un navigateur : aucune ne déclare de manifeste ni n'enregistre de
 * service worker, et aucun gabarit de ce paquet n'en parle.
 */

const PWA_TRACES = /serviceWorker|sw\.js|rel=["']?manifest|webmanifest|apple-mobile-web-app|mobile-web-app-capable/i;

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  title: "Développeur TypeScript senior",
  description: "Refonte d'une plateforme de paiement.",
  skills: ["TypeScript"],
  durationMonths: 6,
  dailyRateMinCents: 55_000,
  dailyRateMaxCents: 70_000,
  currency: "EUR",
  city: "Paris",
  workMode: "hybrid",
  publishedAt: new Date("2026-10-19T09:00:00Z"),
};

const SKILL: SkillPageView = {
  key: "rust",
  label: "Rust",
  missions: [{ id: MISSION.id, title: "Firmware Rust", organisationName: "Acme", workMode: "hybrid", city: "Lyon" }],
  profiles: [{ slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Dev Rust", city: "Lyon" }],
  facts: { profileCount: 1, missionCount: 1, dailyRate: null, cities: ["Lyon"] },
  generatedAt: new Date("2026-10-14T09:30:00Z"),
};

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("pages publiques et application installable", () => {
  it("ne déclarent ni manifeste ni service worker dans le HTML servi", () => {
    for (const lang of ["fr", "en"] as const) {
      const pages = [
        renderJobPage(MISSION, { baseUrl: "https://proofseen.com", lang, applyHref: `/${lang}/creer-un-compte` }),
        renderSkillPage(SKILL, { baseUrl: "https://proofseen.com", lang }),
      ];
      for (const html of pages) expect(html).not.toMatch(PWA_TRACES);
    }
  });

  it("n'en parlent dans aucun gabarit du paquet", () => {
    const files = readdirSync(src).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) expect(readFileSync(join(src, file), "utf8"), file).not.toMatch(PWA_TRACES);
  });
});
