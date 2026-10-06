import { describe, expect, it } from "vitest";
import { EVIDENCE_KINDS, PublicProfileSchema, type PublicProfile } from "../src/identity";
import { ORDERING_NOTE } from "../src/order";
import { publicApi } from "../src/query";
import { buildProfilesSite } from "../src/site";

const mission = (evidence: string[]) => ({
  clientKind: "scaleup",
  role: { fr: "Développeur back-end", en: "Back-end developer" },
  durationMonths: 14,
  achievements: [{ fr: "Migration sans interruption de service", en: "Migration with no downtime" }],
  stack: ["TypeScript"],
  verifiedAt: "2026-09-15",
  evidence,
});

const profile = (id: string, overrides: Record<string, unknown> = {}): PublicProfile =>
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
    verifiedMissions: 2,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
    ...overrides,
  });

const BASE = "https://proofseen.example";
const page = (files: readonly { path: string; content: string }[], path: string): string => files.find((f) => f.path === path)?.content ?? "";
const ldBlocks = (html: string): { "@type": string; [key: string]: unknown }[] => {
  const raw = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!) as unknown;
  return (Array.isArray(raw) ? raw : [raw]) as { "@type": string }[];
};

describe("how a mission was verified", () => {
  it("refuses a mission that does not say how it was verified", () => {
    expect(() => profile("FR-AAAAA", { missions: [mission([])] })).toThrow();
    expect(() => profile("FR-AAAAA", { missions: [mission(["capture d'écran"])] })).toThrow();
  });

  it("states the method next to each mission and links to the public method page", () => {
    const files = buildProfilesSite([profile("FR-AAAAA", { missions: [mission(["facture", "contrat"])] })], { baseUrl: BASE });
    const html = page(files, "p/FR-AAAAA/index.html");
    expect(html).toContain("facture + contrat");
    expect(html).toContain('href="/methode/"');
    expect(page(files, "en/p/FR-AAAAA/index.html")).toContain("invoice + contract");
  });

  it("publishes a method page that explains every kind of evidence and what verification does not guarantee", () => {
    const files = buildProfilesSite([profile("FR-AAAAA")], { baseUrl: BASE });
    const method = page(files, "methode/index.html");
    expect(method).toContain("Comment nous vérifions");
    expect(method).toContain("Pièces contrôlées");
    expect(method).toMatch(/ne juge ni la qualité du travail/);
    expect(method.match(/<li class="mission">/g)).toHaveLength(EVIDENCE_KINDS.length);
    expect(page(files, "en/method/index.html")).toContain("How we verify");
    expect(page(files, "sitemap.xml")).toContain(`${BASE}/methode/`);
  });

  it("links the method page from every page footer", () => {
    const files = buildProfilesSite([profile("FR-AAAAA")], { baseUrl: BASE });
    for (const file of files.filter((f) => f.path.endsWith(".html"))) expect(file.content).toMatch(/<footer[^]*href="\/(en\/method|methode)\/"/);
  });

  it("hands the method to agents too, through the public API", () => {
    const api = JSON.parse(publicApi([profile("FR-AAAAA", { missions: [mission(["acces_depot"])] })], BASE).content) as { profiles: { missions: { evidence: string[] }[] }[] };
    expect(api.profiles[0]!.missions[0]!.evidence).toEqual(["acces_depot"]);
  });
});

describe("entry page", () => {
  const trio = [
    profile("FR-BBBBB", { availability: { status: "unavailable", updatedAt: "2026-09-19" }, rate: { min: 480, max: 560, currency: "EUR", unit: "day" } }),
    profile("FR-AAAAA", { verifiedMissions: 5 }),
    profile("FR-CCCCC", { rate: null, availability: { status: "available", updatedAt: "2026-09-21" } }),
  ];
  const files = buildProfilesSite(trio, { baseUrl: BASE });
  const entry = page(files, "freelances/typescript-paris/index.html");

  it("states figures computed from the cards it shows, and nothing else", () => {
    expect(entry).toContain("<dt>Profils</dt><dd>3</dd>");
    expect(entry).toContain("<dt>Disponibles maintenant</dt><dd>2</dd>");
    expect(entry).toContain("<dt>TJM affichés</dt><dd>480–650 €</dd>");
    expect(entry).toContain("<dt>Missions vérifiées</dt><dd>9</dd>");
  });

  it("orders the cards by the published rule and says so", () => {
    const cards = [...entry.matchAll(/<li class="card"><h3><a href="\/p\/([A-Z]{2}-[A-Z0-9]{5})\//g)].map((m) => m[1]);
    expect(cards).toEqual(["FR-AAAAA", "FR-CCCCC", "FR-BBBBB"]);
    expect(entry).toContain(ORDERING_NOTE.fr);
  });

  it("declares an ItemList in exactly the order of the visible cards, without claiming a ranking", () => {
    const list = ldBlocks(entry).find((block) => block["@type"] === "ItemList") as unknown as { itemListOrder: string; itemListElement: { position: number; url: string }[] };
    expect(list.itemListOrder).toBe("https://schema.org/ItemListUnordered");
    expect(list.itemListElement.map((i) => i.url)).toEqual([`${BASE}/p/FR-AAAAA/`, `${BASE}/p/FR-CCCCC/`, `${BASE}/p/FR-BBBBB/`]);
    expect(ldBlocks(entry).map((b) => b["@type"])).toContain("BreadcrumbList");
  });

  it("never lists a noindex profile, so an entry page cannot exist on thin profiles alone", () => {
    const thin = (id: string) => profile(id, { summary: { fr: "Trop court.", en: "Too short." } });
    const withThin = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), thin("FR-CCCCC")], { baseUrl: BASE });
    expect(page(withThin, "freelances/typescript-paris/index.html")).toBe("");
    expect(page(withThin, "index.html")).not.toContain('href="/p/FR-CCCCC/"');
  });
});
