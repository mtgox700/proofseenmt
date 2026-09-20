import { describe, expect, it } from "vitest";
import { buildSite, HubProfileSchema, verifyHub, type Fetched } from "../src";

const profile = HubProfileSchema.parse({
  version: 1,
  baseUrl: "https://alex-martin.example",
  person: {
    name: "Alex Martin",
    headline: { fr: "Développeur Full Stack TypeScript freelance", en: "Freelance full stack TypeScript developer" },
    city: "Paris",
    workMode: { fr: "Freelance — Paris ou télétravail", en: "Freelance — Paris or remote" },
    summary: { fr: "Résumé court et vrai.", en: "Short, true summary." },
    stack: ["TypeScript", "Node.js"],
    links: [{ label: "GitHub", url: "https://github.com/alex" }],
    contactEmail: null,
  },
  availability: { status: "available_from", from: "2026-10-15", updatedAt: "2026-09-18" },
  rate: null,
  missions: [
    {
      slug: "pipeline-temps-reel",
      title: { fr: "Pipeline temps réel", en: "Real-time pipeline" },
      client: { fr: "Scale-up SaaS", en: "SaaS scale-up" },
      period: { from: "2026-01", to: "2026-06" },
      role: { fr: "Data engineer", en: "Data engineer" },
      summary: { fr: "Ingestion et rejeu prouvé.", en: "Ingestion with proven replay." },
      facts: [{ label: { fr: "Séismes ingérés", en: "Quakes ingested" }, value: "17 526", source: "code du dépôt" }],
      stack: ["Kafka"],
      links: [],
    },
  ],
  verificationToken: "tok_0123456789abcdef",
});

/** A deployment that serves exactly what the generator produced. */
const served = (overrides: Readonly<Record<string, Partial<Fetched>>> = {}): Map<string, Fetched> => {
  const map = new Map<string, Fetched>();
  for (const file of buildSite(profile)) {
    const url = `${profile.baseUrl}/${file.path.replace(/index\.html$/, "")}`;
    map.set(url, { status: 200, body: file.content, contentType: file.path.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" });
  }
  for (const [url, patch] of Object.entries(overrides)) map.set(url, { ...map.get(url)!, ...patch });
  return map;
};

const run = (pages: Map<string, Fetched>) => verifyHub(profile, (url) => pages.get(url) ?? { status: 404, body: "", contentType: "text/plain" });
const find = (r: ReturnType<typeof verifyHub>, name: string) => r.checks.find((c) => c.name === name)!;

describe("verifyHub (is the deployed site really readable by an AI crawler?)", () => {
  it("passes on a deployment that serves the generated files", () => {
    const report = run(served());
    expect(report.ok).toBe(true);
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });

  it("fails when a page is missing or answers an error", () => {
    const report = run(served({ "https://alex-martin.example/en/": { status: 404, body: "not found" } }));
    expect(find(report, "pages").status).toBe("fail");
    expect(find(report, "pages").detail).toContain("/en/ (HTTP 404)");
    expect(report.ok).toBe(false);
  });

  it("never reports ok on checks it could not run: an offline site fails everything", () => {
    // status 0 is what the CLI records when the request gets no answer at all (DNS, TLS, timeout).
    const report = verifyHub(profile, () => ({ status: 0, body: "", contentType: "" }));
    expect(report.ok).toBe(false);
    expect(report.checks.filter((c) => c.status === "ok")).toEqual([]);
    ["text in the HTML", "no JavaScript", "canonical and hreflang", "content type"].forEach((name) =>
      expect(find(report, name).detail).toMatch(/no page/i),
    );
    expect(find(report, "pages").detail).toMatch(/no page answered at all/);
  });

  it("fails when the served HTML no longer carries the visible text (client-side rendering)", () => {
    const empty = '<!doctype html><html lang="fr"><head><title>Alex Martin</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>';
    const report = run(served({ "https://alex-martin.example/": { body: empty } }));
    expect(find(report, "text in the HTML").status).toBe("fail");
    expect(find(report, "no JavaScript").status).toBe("fail");
  });

  it("fails when an AI crawler is blocked or the sitemap is missing from robots.txt", () => {
    const blocked = "User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
    const report = run(served({ "https://alex-martin.example/robots.txt": { body: blocked } }));
    const check = find(report, "robots.txt");
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("OAI-SearchBot");
  });

  it("fails when the sitemap does not list every page", () => {
    const short = '<?xml version="1.0"?><urlset><url><loc>https://alex-martin.example/</loc></url></urlset>';
    const report = run(served({ "https://alex-martin.example/sitemap.xml": { body: short } }));
    expect(find(report, "sitemap").status).toBe("fail");
    expect(find(report, "sitemap").detail).toContain("/en/");
  });

  it("checks the possession token file when the profile declares one", () => {
    expect(find(run(served()), "possession token").status).toBe("ok");
    const report = run(served({ "https://alex-martin.example/.well-known/proofseen-verification.txt": { status: 404, body: "" } }));
    expect(find(report, "possession token").status).toBe("fail");
  });

  it("warns when canonical or hreflang drifted from the profile's baseUrl", () => {
    const wrong = buildSite(profile)[0]!.content.replace("https://alex-martin.example/", "https://staging.example/");
    const report = run(served({ "https://alex-martin.example/": { body: wrong } }));
    expect(find(report, "canonical and hreflang").status).toBe("fail");
  });
});
