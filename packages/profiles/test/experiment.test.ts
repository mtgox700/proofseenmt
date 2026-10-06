import { describe, expect, it } from "vitest";
import { PublicProfileSchema, type PublicProfile } from "../src/identity";
import { MEASUREMENT_DAYS, planExperiment, THRESHOLDS } from "../src/experiment";
import type { NamedArm } from "../src/site";

const profile = (id: string, skills: string[] = ["TypeScript", "Node.js", "PostgreSQL"]): PublicProfile =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills,
    sectors: ["SaaS B2B"],
    availability: { status: "available", from: null, updatedAt: "2026-09-28" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 4,
    summary: {
      fr: "Construit et exploite des applications TypeScript en production, sur des volumes réels, avec des missions vérifiées par Proofseen une à une.",
      en: "Builds and runs production TypeScript applications at real volume, with missions verified by Proofseen one by one, evidence included.",
    },
  });

const namedArm: NamedArm = {
  profileId: "FR-AAAAA",
  identity: { displayName: "Ayoub H.", slug: "ayoub-h", sameAs: ["https://github.com/example", "https://www.linkedin.com/in/example/"] },
};

const input = {
  profiles: [profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")],
  namedArm,
  entrySlug: "typescript-paris",
  publishedAt: "2026-09-28",
  baseUrl: "https://proofseen.example",
};

const fileNamed = (files: readonly { path: string; content: string }[], path: string): string =>
  files.find((f) => f.path === path)?.content ?? "";

describe("three-arm test", () => {
  it("publishes the three arms on the same domain, the same day", () => {
    const { files, manifest, blockers } = planExperiment(input);
    expect(blockers).toEqual([]);
    expect(manifest.arms.map((a) => a.arm)).toEqual(["A", "B", "C"]);
    for (const arm of manifest.arms) {
      for (const url of arm.urls) expect(files.some((f) => `${url.replace("https://proofseen.example/", "")}index.html` === f.path)).toBe(true);
    }
  });

  it("gives the two person arms the same facts and only changes the identity", () => {
    const { files } = planExperiment(input);
    const named = fileNamed(files, "n/ayoub-h/index.html");
    const pseudo = fileNamed(files, "p/FR-AAAAA/index.html");
    for (const fact of ["7+ ans", "Paris / Île-de-France", "550", "PostgreSQL", "SaaS B2B"]) {
      expect(named).toContain(fact);
      expect(pseudo).toContain(fact);
    }
    expect(named).toContain("Ayoub H.");
    expect(named).toContain("github.com/example");
    expect(pseudo).not.toContain("Ayoub H.");
    expect(pseudo).not.toContain("github.com");
  });

  it("carries sameAs on the named arm and none on the pseudonymous one", () => {
    const { files } = planExperiment(input);
    expect(fileNamed(files, "n/ayoub-h/index.html")).toContain('"sameAs"');
    expect(fileNamed(files, "p/FR-AAAAA/index.html")).not.toContain('"sameAs"');
  });

  it("never claims anonymity on the named page and never prints the public identifier there", () => {
    const named = fileNamed(planExperiment(input).files, "n/ayoub-h/index.html");
    expect(named).not.toContain("FR-AAAAA");
    expect(named).not.toContain("jamais publiée");
    expect(named).toContain("identité réelle");
  });

  it("links both person arms from the home page, so neither is an orphan", () => {
    const home = fileNamed(planExperiment(input).files, "index.html");
    expect(home).toContain('href="/p/FR-AAAAA/"');
    expect(home).toContain('href="/n/ayoub-h/"');
  });

  it("lists the three arms in the sitemap", () => {
    const sitemap = fileNamed(planExperiment(input).files, "sitemap.xml");
    for (const path of ["/p/FR-AAAAA/", "/n/ayoub-h/", "/freelances/typescript-paris/"]) {
      expect(sitemap).toContain(`https://proofseen.example${path}`);
    }
  });

  it("keeps the named arm out of the pseudonymous catalogue read by agents", () => {
    const api = JSON.parse(fileNamed(planExperiment(input).files, "api/profiles.json")) as { profiles: { url: string }[] };
    expect(JSON.stringify(api)).not.toContain("Ayoub");
    expect(api.profiles.every((p) => !p.url.includes("/n/"))).toBe(true);
  });

  it("dates the measurements from the publication and pre-registers the thresholds", () => {
    const { manifest } = planExperiment(input);
    expect(manifest.measurements).toEqual([
      { day: 30, date: "2026-10-28" },
      { day: 60, date: "2026-11-27" },
    ]);
    expect(MEASUREMENT_DAYS).toEqual([30, 60]);
    expect(manifest.thresholds).toBe(THRESHOLDS);
  });

  it("states that the pseudonymous arm is not anonymous during the test", () => {
    expect(planExperiment(input).manifest.limitation).toMatch(/n'est pas anonyme/);
  });

  it("blocks when the entry page cannot exist for lack of profiles", () => {
    const { blockers } = planExperiment({ ...input, profiles: [profile("FR-AAAAA"), profile("FR-BBBBB")] });
    expect(blockers.join(" ")).toMatch(/bras C.*typescript-paris/);
  });

  it("blocks when the named arm has no corroborating link", () => {
    const { blockers } = planExperiment({ ...input, namedArm: { ...namedArm, identity: { ...namedArm.identity, sameAs: [] } } });
    expect(blockers.join(" ")).toMatch(/bras A.*sameAs/);
  });

  it("blocks when the twin profile is missing instead of publishing an unreadable test", () => {
    const { blockers, manifest } = planExperiment({ ...input, namedArm: { ...namedArm, profileId: "FR-ZZZZZ" } });
    expect(blockers.join(" ")).toMatch(/bras B.*mêmes faits/);
    expect(manifest.arms).toEqual([]);
  });

  it("refuses an invalid publication date rather than inventing measurement dates", () => {
    expect(() => planExperiment({ ...input, publishedAt: "28/09/2026" })).toThrow(/date de publication invalide/);
  });
});
