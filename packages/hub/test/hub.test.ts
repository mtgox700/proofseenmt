import { withoutHeaderSwitch } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import { HubProfileSchema, type HubProfile } from "../src/schema";
import { buildSite, AI_SEARCH_BOTS } from "../src/build";

/** Fictitious person, used only in tests. */
const base = {
  version: 1,
  baseUrl: "https://alex-martin.example",
  person: {
    name: "Alex Martin",
    headline: { fr: "Développeur Full Stack TypeScript freelance", en: "Freelance full-stack TypeScript developer" },
    city: "Paris",
    workMode: { fr: "Freelance, remote ou hybride", en: "Freelance, remote or hybrid" },
    summary: { fr: "Je construis des applications web.", en: "I build web applications." },
    stack: ["TypeScript", "Next.js"],
    links: [{ label: "GitHub", url: "https://github.com/alex-martin-example" }],
    contactEmail: null,
  },
  availability: { status: "available_from", from: "2026-10-15", updatedAt: "2026-09-18" },
  rate: null,
  missions: [
    {
      slug: "pipeline-temps-reel",
      title: { fr: "Pipeline de données temps réel", en: "Real-time data pipeline" },
      client: { fr: "Projet personnel", en: "Personal project" },
      period: { from: "2026-07", to: "2026-08" },
      role: { fr: "Conception et développement", en: "Design and development" },
      summary: { fr: "Ingestion et rejeu idempotent.", en: "Ingestion and idempotent replay." },
      facts: [{ label: { fr: "Événements traités", en: "Events processed" }, value: "17 526", source: "code du dépôt" }],
      stack: ["Kafka", "Spark"],
      links: [],
    },
  ],
  verificationToken: "tok_0123456789abcdef",
};

const profile: HubProfile = HubProfileSchema.parse(base);
const site = buildSite(profile);
const file = (path: string): string => {
  const f = site.find((s) => s.path === path);
  if (f === undefined) throw new Error(`missing ${path}`);
  return f.content;
};

describe("HubProfileSchema", () => {
  it("requires a date when availability is 'available_from'", () => {
    expect(() => HubProfileSchema.parse({ ...base, availability: { status: "available_from", from: null, updatedAt: "2026-09-18" } })).toThrow();
  });

  it("rejects an inverted rate range and a non-https base URL", () => {
    expect(() => HubProfileSchema.parse({ ...base, rate: { min: 700, max: 500, currency: "EUR", unit: "day" } })).toThrow();
    expect(() => HubProfileSchema.parse({ ...base, baseUrl: "http://alex.example" })).toThrow();
  });
});

describe("buildSite", () => {
  it("produces FR and EN pages, mission pages, robots, sitemap and the verification file", () => {
    expect(site.map((s) => s.path).sort()).toEqual(
      [
        ".well-known/proofseen-verification.txt",
        "en/index.html",
        "en/missions/pipeline-temps-reel/index.html",
        "index.html",
        "missions/pipeline-temps-reel/index.html",
        "robots.txt",
        "sitemap.xml",
      ].sort(),
    );
    expect(file(".well-known/proofseen-verification.txt")).toBe("tok_0123456789abcdef\n");
  });

  it("puts every fact in visible HTML, readable without JavaScript", () => {
    const home = file("index.html");
    expect(home).toContain("Alex Martin");
    expect(home).toContain("Développeur Full Stack TypeScript freelance");
    expect(home).toContain("TypeScript");
    expect(home).toMatch(/Disponible à partir du 15 octobre 2026/);
    expect(home).toMatch(/Mis à jour le 18 septembre 2026/);
    const mission = file("missions/pipeline-temps-reel/index.html");
    expect(mission).toContain("17 526");
    expect(mission).toContain("code du dépôt");
  });

  it("ships no executable JavaScript (only JSON-LD data)", () => {
    site.filter((s) => s.path.endsWith(".html")).forEach(({ content }) => {
      const scripts = [...content.matchAll(/<script\b([^>]*)>/gi)];
      scripts.forEach((m) => expect(m[1]).toContain('type="application/ld+json"'));
      expect(content).not.toMatch(/\son[a-z]+=/i);
    });
  });

  it("never hides text", () => {
    site.forEach(({ content }) => expect(withoutHeaderSwitch(content)).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i));
  });

  it("escapes user content (no HTML or script injection)", () => {
    const evil = HubProfileSchema.parse({
      ...base,
      person: { ...base.person, summary: { fr: '<script>alert(1)</script> "x" & <b>', en: "</script><img src=x>" } },
    });
    const out = buildSite(evil);
    const fr = out.find((s) => s.path === "index.html")!.content;
    expect(fr).not.toContain("<script>alert(1)</script>");
    expect(fr).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    const en = out.find((s) => s.path === "en/index.html")!.content;
    const jsonLd = en.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!;
    expect(jsonLd).not.toContain("</script");
    expect(JSON.parse(jsonLd)["@type"]).toBe("Person");
  });

  it("declares language, canonical and hreflang alternates", () => {
    const home = file("index.html");
    expect(home).toMatch(/<html lang="fr">/);
    expect(home).toContain('<link rel="canonical" href="https://alex-martin.example/">');
    expect(home).toContain('hreflang="en" href="https://alex-martin.example/en/"');
    expect(file("en/index.html")).toMatch(/<html lang="en">/);
  });

  it("opens robots.txt to the AI search bots and lists the sitemap", () => {
    const robots = file("robots.txt");
    AI_SEARCH_BOTS.forEach((bot) => expect(robots).toContain(`User-agent: ${bot}\nAllow: /`));
    expect(robots).toContain("Sitemap: https://alex-martin.example/sitemap.xml");
    expect(AI_SEARCH_BOTS).toEqual(expect.arrayContaining(["Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "Claude-User", "PerplexityBot"]));
  });

  it("lists every page with an absolute URL in the sitemap", () => {
    const sitemap = file("sitemap.xml");
    ["/", "/en/", "/missions/pipeline-temps-reel/", "/en/missions/pipeline-temps-reel/"].forEach((p) =>
      expect(sitemap).toContain(`<loc>https://alex-martin.example${p}</loc>`),
    );
  });

  it("is deterministic and stays within the page weight budget", () => {
    expect(buildSite(profile)).toEqual(site);
    site.filter((s) => s.path.endsWith(".html")).forEach((s) => expect(Buffer.byteLength(s.content)).toBeLessThan(50_000));
  });

  it("renders the optional blocks: rate, contact, ongoing mission, mission links, unavailable status", () => {
    const full = buildSite(
      HubProfileSchema.parse({
        ...base,
        person: { ...base.person, contactEmail: "alex@alex-martin.example" },
        availability: { status: "unavailable", from: null, updatedAt: "2026-09-18" },
        rate: { min: 500, max: 650, currency: "EUR", unit: "day" },
        missions: [{ ...base.missions[0], period: { from: "2026-07", to: null }, links: [{ label: "Dépôt", url: "https://github.com/alex/pipeline" }] }],
      }),
    );
    const fr = full.find((s) => s.path === "index.html")!.content;
    expect(fr).toContain("TJM\u202f: 500 à 650 € HT par jour");
    expect(fr).toContain("mailto:alex@alex-martin.example");
    expect(fr).toContain("Indisponible pour le moment");
    expect(fr).toContain("aujourd&#39;hui");
    const en = full.find((s) => s.path === "en/index.html")!.content;
    expect(en).toContain("Day rate: €500 to €650 excl. VAT");
    expect(en).toContain("Not available at the moment");
    expect(full.find((s) => s.path === "missions/pipeline-temps-reel/index.html")!.content).toContain('href="https://github.com/alex/pipeline"');
  });

  it("shows 'available' and handles a profile without missions or links", () => {
    const minimal = buildSite(
      HubProfileSchema.parse({ ...base, person: { ...base.person, links: [] }, availability: { status: "available", from: null, updatedAt: "2026-09-18" }, missions: [] }),
    );
    const en = minimal.find((s) => s.path === "en/index.html")!.content;
    expect(en).toContain(">Available<");
    expect(en).not.toContain("<h2>Missions</h2>");
    expect(minimal.map((s) => s.path)).not.toContain("missions/pipeline-temps-reel/index.html");
  });

  it("derives the proof counter from the data and shows every fact with its source", () => {
    const facts = base.missions.reduce((n, m) => n + m.facts.length, 0);
    const home = file("index.html");
    expect(home).toContain(`${base.missions.length} mission`);
    expect(home).toContain(`${facts} fait`);
    const mission = file("missions/pipeline-temps-reel/index.html");
    expect(mission).toContain("Source\u202f: code du dépôt");
    expect(file("en/missions/pipeline-temps-reel/index.html")).toMatch(/Source: /);
  });

  it("links a mission page only to the same person's other missions (one person per page)", () => {
    const two = buildSite(
      HubProfileSchema.parse({ ...base, missions: [base.missions[0], { ...base.missions[0], slug: "seconde-mission" }] }),
    );
    const page = two.find((s) => s.path === "missions/pipeline-temps-reel/index.html")!.content;
    expect(page).toContain('href="/missions/seconde-mission/"');
    const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    hrefs.filter((h) => h.startsWith("/")).forEach((h) => expect(h).toMatch(/^\/(en\/)?(missions\/[a-z0-9-]+\/)?$/));
    expect(file("missions/pipeline-temps-reel/index.html")).not.toContain('class="more"');
  });

  it("omits the verification file when there is no token", () => {
    const noToken = buildSite(HubProfileSchema.parse({ ...base, verificationToken: null }));
    expect(noToken.some((s) => s.path.startsWith(".well-known"))).toBe(false);
  });
});
