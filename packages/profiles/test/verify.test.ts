import { describe, expect, it } from "vitest";
import { PublicProfileSchema, type PublicProfile } from "../src/identity";
import { INDEXNOW_MAX_URLS, indexNowKeyFile, indexNowOutcome, indexNowPayload, sitemapUrls } from "../src/indexnow";
import { buildProfilesSite, type SiteFile } from "../src/site";
import { crawlerUserAgent, verifyDeployedSite, type Served } from "../src/verify";

const profile = (id: string): PublicProfile =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    sectors: ["SaaS B2B"],
    availability: { status: "available", updatedAt: "2026-09-21" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 0,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
  });

const BASE = "https://proofseen.example";
const KEY = "a1b2c3d4e5f6a7b8";
const published = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")], { baseUrl: BASE, indexNowKey: KEY });

/** A faithful host: serves exactly the published folder. `tweak` simulates what a CDN or host may do on the way. */
const host =
  (files: readonly SiteFile[], tweak: (url: string, ua: string | undefined, served: Served) => Served = (_u, _a, s) => s) =>
  (url: string, ua: string | undefined): Served => {
    const path = url.slice(BASE.length + 1);
    const file = files.find((f) => f.path === path || f.path === `${path}index.html`);
    const served: Served = file === undefined ? { status: 404, body: "", contentType: "", robotsTag: "" } : { status: 200, body: file.content, contentType: "text/html", robotsTag: "" };
    return tweak(url, ua, served);
  };

const statusOf = (name: string, fetchAs: ReturnType<typeof host>) => verifyDeployedSite(BASE, published, fetchAs).checks.find((c) => c.name === name)!;

describe("deployed site versus published folder", () => {
  it("passes on a faithful host, and still refuses to call crawler access proven", () => {
    const report = verifyDeployedSite(BASE, published, host(published));
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.name === "AI crawlers")).toMatchObject({ status: "warn", detail: expect.stringMatching(/journaux|logs/) });
  });

  it("catches a CDN that turns an AI crawler away with a user-agent rule", () => {
    const blocking = host(published, (_u, ua, s) => (ua?.includes("OAI-SearchBot") ? { ...s, status: 403 } : s));
    expect(statusOf("AI crawlers", blocking)).toMatchObject({ status: "fail", detail: expect.stringContaining("OAI-SearchBot") });
  });

  it("catches a challenge page served with HTTP 200", () => {
    const challenging = host(published, (_u, ua, s) => (ua?.includes("PerplexityBot") ? { ...s, body: "<title>Just a moment...</title>" } : s));
    expect(statusOf("AI crawlers", challenging).status).toBe("fail");
  });

  it("catches a host that adds a noindex header, as preview deployments do", () => {
    const preview = host(published, (_u, _a, s) => ({ ...s, robotsTag: "noindex" }));
    expect(statusOf("noindex", preview).status).toBe("fail");
  });

  it("catches a script injected on the way", () => {
    const injecting = host(published, (_u, _a, s) => ({ ...s, body: s.body.replace("</body>", '<script src="/cdn-cgi/scripts/email-decode.min.js"></script></body>') }));
    expect(statusOf("no injected script", injecting).status).toBe("fail");
  });

  it("catches a stale page served instead of the published one", () => {
    const stale = host(published, (url, _a, s) => (url.endsWith("/p/FR-AAAAA/") ? { ...s, body: s.body.replace(/<title>[^<]*<\/title>/, "<title>ancienne version</title>") } : s));
    expect(statusOf("served content", stale).status).toBe("fail");
  });

  it("fails when nothing is deployed, instead of reporting a false green", () => {
    const report = verifyDeployedSite(BASE, published, () => ({ status: 0, body: "", contentType: "", robotsTag: "" }));
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ name: "pages", status: "fail" });
  });

  it("checks that the IndexNow key is served", () => {
    const noKey = host(published, (url, _a, s) => (url.endsWith(`${KEY}.txt`) ? { ...s, status: 404 } : s));
    expect(statusOf("IndexNow key", noKey).status).toBe("fail");
    expect(statusOf("IndexNow key", host(published)).status).toBe("ok");
  });

  it("announces the crawler token that CDN rules match on", () => {
    expect(crawlerUserAgent("OAI-SearchBot")).toContain("OAI-SearchBot/1.0");
  });
});

describe("IndexNow", () => {
  it("serves the key at the root of the site", () => {
    expect(published.find((f) => f.path === `${KEY}.txt`)?.content.trim()).toBe(KEY);
  });

  it("builds the payload from the published sitemap, on our own host only", () => {
    const urls = sitemapUrls(published.find((f) => f.path === "sitemap.xml")!.content);
    const payload = indexNowPayload(BASE, KEY, urls);
    expect(payload).toMatchObject({ host: "proofseen.example", key: KEY, keyLocation: `${BASE}/${KEY}.txt` });
    expect(payload.urlList).toContain(`${BASE}/p/FR-AAAAA/`);
    expect(() => indexNowPayload(BASE, KEY, ["https://www.malt.fr/profile/x"])).toThrow(/hors du domaine/);
  });

  it("refuses an invalid key, an empty list and more URLs than the protocol allows", () => {
    expect(() => indexNowKeyFile("court")).toThrow(/invalide/);
    expect(() => indexNowPayload(BASE, KEY, [])).toThrow(/aucune URL/);
    const tooMany = Array.from({ length: INDEXNOW_MAX_URLS + 1 }, (_, i) => `${BASE}/p/${i}/`);
    expect(() => indexNowPayload(BASE, KEY, tooMany)).toThrow(/par requête/);
  });

  it("reads every answer of the endpoint in plain words", () => {
    expect(indexNowOutcome(202)).toEqual({ ok: true, meaning: expect.stringMatching(/vérifiée plus tard/) });
    expect(indexNowOutcome(403).ok).toBe(false);
    expect(indexNowOutcome(422).meaning).toMatch(/domaine/);
    expect(indexNowOutcome(500).meaning).toMatch(/HTTP 500/);
  });
});

describe("aucun contenu différent selon qui regarde", () => {
  it("passe quand robots et navigateurs reçoivent le même texte visible", () => {
    expect(statusOf("no cloaking", host(published)).status).toBe("ok");
  });

  it("refuse quand un robot reçoit un autre texte, là où un contrôle de statut ne verrait rien", () => {
    // La page répond bien 200 au robot : le contrôle « AI crawlers » est satisfait. C'est le contenu qui diffère.
    const cloaking = host(published, (_u, ua, served) =>
      ua === undefined ? served : { ...served, body: served.body.replace("</body>", "<p>Le meilleur profil du catalogue.</p></body>") },
    );
    const check = statusOf("no cloaking", cloaking);
    expect(check.status).toBe("fail");
    expect(check.detail).toMatch(/different content served to crawlers/);
    // Et le contrôle précédent, lui, ne voit rien d'anormal : c'est bien un angle mort qu'on vient de couvrir.
    expect(statusOf("AI crawlers", cloaking).status).not.toBe("fail");
  });
});
