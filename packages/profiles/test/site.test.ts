import { withoutHeaderSwitch } from "@proofseen/hub";
import { describe, expect, it } from "vitest";
import { AI_SEARCH_BOTS } from "@proofseen/hub";
import { MIN_PROFILES_PER_INTENT, PrivateIdentitySchema, PublicProfileSchema, assertNoLeaks, buildProfilesSite, findLeaks, type PublicProfile } from "../src";

const BASE = "https://proofseen.example";

const profile = (id: string, overrides: Record<string, unknown> = {}): PublicProfile =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "React"],
    sectors: ["SaaS B2B"],
    availability: { status: "available", updatedAt: "2026-09-20" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 4,
    summary: {
      fr: "Construit des applications TypeScript en production : APIs Node.js, interfaces React, mise en production et suivi. Missions vérifiées par Proofseen.",
      en: "Builds production TypeScript applications: Node.js APIs, React interfaces, deployment and monitoring. Missions verified by Proofseen.",
    },
    ...overrides,
  });

const three = [profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")];
const site = (profiles: readonly PublicProfile[] = three) => buildProfilesSite(profiles, { baseUrl: BASE });
const file = (files: ReturnType<typeof site>, path: string): string => files.find((f) => f.path === path)!.content;
const htmlFiles = (files: ReturnType<typeof site>) => files.filter((f) => f.path.endsWith(".html"));

describe("public site: what a crawler reads", () => {
  it("renders one page per profile and per locale, with the handle and never a real name", () => {
    const files = site();
    expect(file(files, "p/FR-AAAAA/index.html")).toContain("Profil.A");
    expect(file(files, "en/p/FR-AAAAA/index.html")).toContain("Full stack TypeScript engineer");
    const identity = PrivateIdentitySchema.parse({
      profileId: "FR-AAAAA",
      realName: "Ayoub Hammoudi",
      email: "ayoub@example.com",
      phone: null,
      links: ["https://www.linkedin.com/in/ayoub-hammoudi"],
      legalId: null,
      consent: { givenAt: "2026-09-20", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true },
    });
    htmlFiles(files).forEach((f) => expect(findLeaks(identity, f.content)).toEqual([]));
  });

  it("puts every published fact in the visible HTML, with no JavaScript at all", () => {
    const page = file(site(), "p/FR-AAAAA/index.html");
    ["Profil.A", "FR-AAAAA", "TypeScript", "Node.js", "7+ ans", "Paris / Île-de-France", "550", "650", "4"].forEach((fact) =>
      expect(page).toContain(fact),
    );
    htmlFiles(site()).forEach(({ content }) => {
      [...content.matchAll(/<script\b([^>]*)>/gi)].forEach((m) => expect(m[1]).toContain('type="application/ld+json"'));
      expect(content).not.toMatch(/\son[a-z]+=/i);
      expect(withoutHeaderSwitch(content)).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    });
  });

  it("describes the person with the pseudonym and never links to a real identity", () => {
    const page = file(site(), "p/FR-AAAAA/index.html");
    const blocks = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!) as { "@type": string }[];
    // The page now declares two blocks: the profile and its breadcrumb.
    const jsonLd = blocks.find((block) => block["@type"] === "ProfilePage") as unknown as {
      "@type": string;
      mainEntity: { "@type": string; name: string; identifier: string; sameAs?: unknown; knowsAbout: string[] };
    };
    expect(jsonLd["@type"]).toBe("ProfilePage");
    expect(jsonLd.mainEntity["@type"]).toBe("Person");
    expect(jsonLd.mainEntity.name).toBe("Profil.A");
    expect(jsonLd.mainEntity.identifier).toBe("FR-AAAAA");
    expect(jsonLd.mainEntity.sameAs).toBeUndefined();
    // Structured data must mirror what the visitor sees (Google, sd-policies).
    [jsonLd.mainEntity.name, jsonLd.mainEntity.identifier, ...jsonLd.mainEntity.knowsAbout].forEach((value: string) =>
      expect(page).toContain(value),
    );
  });

  it("sends the visitor to Proofseen to make contact, never to the freelancer", () => {
    const page = file(site(), "p/FR-AAAAA/index.html");
    expect(page).toMatch(/href="\/contact\/[^"]*"/);
    expect(page).not.toMatch(/mailto:|tel:/);
    expect(site().map((f) => f.path)).toContain("contact/index.html");
  });
});

describe("intent pages and internal linking", () => {
  it("builds an intent page only when enough profiles share the skill and the area", () => {
    const paths = site().map((f) => f.path);
    expect(MIN_PROFILES_PER_INTENT).toBeGreaterThanOrEqual(3);
    expect(paths).toContain("freelances/typescript-paris/index.html");
    const alone = site([profile("FR-AAAAA", { skills: ["Fortran"] }), ...three.slice(1)]).map((f) => f.path);
    expect(alone).not.toContain("freelances/fortran-paris/index.html");
  });

  it("links both ways: the intent page lists its profiles, each profile points back", () => {
    const files = site();
    const intent = file(files, "freelances/typescript-paris/index.html");
    three.forEach((p) => expect(intent).toContain(`/p/${p.id}/`));
    expect(file(files, "p/FR-AAAAA/index.html")).toContain("/freelances/typescript-paris/");
  });

  it("keeps every profile reachable from the home page in two clicks", () => {
    const files = site();
    const home = file(files, "index.html");
    const intents = [...home.matchAll(/href="(\/freelances\/[^"]+)"/g)].map((m) => m[1]!);
    expect(intents.length).toBeGreaterThan(0);
    const reachable = new Set(
      intents.flatMap((path) => [...file(files, `${path.slice(1)}index.html`).matchAll(/href="\/p\/([A-Z]{2}-[A-Z0-9]{5})\//g)].map((m) => m[1]!)),
    );
    three.forEach((p) => expect(reachable).toContain(p.id));
  });
});

describe("thin content, sitemap and robots", () => {
  it("marks a thin profile noindex and keeps it out of the sitemap", () => {
    const thin = profile("FR-DDDDD", { summary: { fr: "Dev.", en: "Dev." }, skills: ["TypeScript"] });
    const files = buildProfilesSite([...three, thin], { baseUrl: BASE });
    expect(file(files, "p/FR-DDDDD/index.html")).toContain('<meta name="robots" content="noindex">');
    expect(file(files, "sitemap.xml")).not.toContain(`${BASE}/p/FR-DDDDD/`);
    expect(file(files, "p/FR-AAAAA/index.html")).not.toContain("noindex");
    expect(file(files, "sitemap.xml")).toContain(`<loc>${BASE}/p/FR-AAAAA/</loc>`);
  });

  it("opens robots.txt to the AI crawlers and declares the sitemap", () => {
    const robots = file(site(), "robots.txt");
    AI_SEARCH_BOTS.forEach((bot) => expect(robots).toContain(`User-agent: ${bot}\nAllow: /`));
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });

  it("is deterministic and stays inside the page weight budget", () => {
    expect(buildProfilesSite(three, { baseUrl: BASE })).toEqual(site());
    htmlFiles(site()).forEach((f) => expect(Buffer.byteLength(f.content)).toBeLessThan(50_000));
  });

  it("refuses to build a profile whose re-identification risk is blocking", () => {
    const risky = profile("FR-EEEEE", {
      area: "Saint-Junien",
      skills: ["COBOL", "OpenVMS", "Zig", "Erlang"],
      sectors: ["Nucléaire civil", "Assurance maritime"],
      summary: { fr: "Ex-Google, promotion 2009 de l'X, seul expert Zig du secteur.", en: "Ex-Google, X 2009, only Zig expert in the field." },
    });
    expect(() => buildProfilesSite([...three, risky], { baseUrl: BASE })).toThrow(/ré-identification|reidentification/i);
  });
});

describe("final sweep before writing anything", () => {
  const identity = PrivateIdentitySchema.parse({
    profileId: "FR-AAAAA",
    realName: "Ayoub Hammoudi",
    email: "ayoub@example.com",
    phone: null,
    links: [],
    legalId: null,
    consent: { givenAt: "2026-09-20", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true },
  });

  it("passes on the generated site and names the file when a leak is planted", () => {
    const files = site();
    expect(() => assertNoLeaks([identity], files)).not.toThrow();
    const poisoned = [...files, { path: "p/FR-AAAAA/index.html", content: "<p>Ayoub Hammoudi</p>" }];
    expect(() => assertNoLeaks([identity], poisoned)).toThrow(/p\/FR-AAAAA\/index\.html → FR-AAAAA\.realName/);
  });
});
