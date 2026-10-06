import { describe, expect, it } from "vitest";
import { PublicProfileSchema, type PublicProfile } from "../src/identity";
import { buildProfilesSite } from "../src/site";

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
    verifiedMissions: 3,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
    ...overrides,
  });

const BASE = "https://proofseen.example";
const trio = [profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")];
const page = (files: readonly { path: string; content: string }[], path: string): string => files.find((f) => f.path === path)?.content ?? "";
const decode = (html: string): string => html.replace(/&amp;/g, "&");
const mailto = (html: string): URL => new URL(decode(html.match(/<a class="cta" href="(mailto:[^"]+)"/)![1]!));

describe("request this profile", () => {
  it("opens a pre-filled e-mail to Proofseen, never to the freelancer", () => {
    const html = page(buildProfilesSite(trio, { baseUrl: BASE, contactEmail: "demandes@proofseen.example" }), "p/FR-AAAAA/index.html");
    const link = mailto(html);
    expect(link.pathname).toBe("demandes@proofseen.example");
    expect(link.searchParams.get("subject")).toBe("Demande de profil FR-AAAAA");
    const body = link.searchParams.get("body")!;
    expect(body).toContain(`${BASE}/p/FR-AAAAA/`);
    expect(body).toMatch(/Mission :[\s\S]*Budget ou TJM :/);
  });

  it("writes the English template on English pages", () => {
    const html = page(buildProfilesSite(trio, { baseUrl: BASE, contactEmail: "demandes@proofseen.example" }), "en/p/FR-AAAAA/index.html");
    expect(mailto(html).searchParams.get("subject")).toBe("Profile request FR-AAAAA");
  });

  it("keeps the contact page as the target when no address is configured", () => {
    const html = page(buildProfilesSite(trio, { baseUrl: BASE }), "p/FR-AAAAA/index.html");
    expect(html).toContain('<a class="cta" href="/contact/?p=FR-AAAAA">');
  });

  it("says plainly on the contact page that the channel is not open yet, rather than pretending", () => {
    const contact = page(buildProfilesSite(trio, { baseUrl: BASE }), "contact/index.html");
    expect(contact).toMatch(/ouvrira au lancement/);
    expect(contact).not.toContain("mailto:");
  });

  it("explains the three steps and offers to write once the channel is open", () => {
    const contact = page(buildProfilesSite(trio, { baseUrl: BASE, contactEmail: "demandes@proofseen.example" }), "contact/index.html");
    expect(contact.match(/<ol class="steps">(.*?)<\/ol>/s)![1]!.match(/<li>/g)).toHaveLength(3);
    expect(contact).toContain("mailto:demandes@proofseen.example");
    expect(contact).not.toMatch(/ouvrira au lancement/);
  });

  it("never lets the named arm's request carry the public identifier", () => {
    const files = buildProfilesSite(trio, {
      baseUrl: BASE,
      contactEmail: "demandes@proofseen.example",
      namedArm: { profileId: "FR-AAAAA", identity: { displayName: "Ayoub H.", slug: "ayoub-h", sameAs: ["https://github.com/exemple"] } },
    });
    const named = page(files, "n/ayoub-h/index.html");
    expect(mailto(named).searchParams.get("subject")).toBe("Demande de profil ayoub-h");
    expect(decode(named)).not.toContain("FR-AAAAA");
  });
});

describe("profile layout", () => {
  const html = page(buildProfilesSite(trio, { baseUrl: BASE }), "p/FR-AAAAA/index.html");

  it("keeps the decision on one panel: availability, facts, the request, and what verified means", () => {
    const panel = html.match(/<aside[^>]*><div class="panel">(.*?)<\/div><\/aside>/s)![1]!;
    expect(panel).toContain("Disponible");
    expect(panel).toContain("550–650 €");
    expect(panel).toContain('class="cta"');
    expect(panel).toContain("3 missions vérifiées sur pièce");
    expect(panel).toContain('href="/methode/"');
    expect(panel).toMatch(/Identité révélée après accord/);
  });

  it("puts the panel right after the header in the document, so it comes before the details on a phone", () => {
    expect(html.indexOf('<div class="panel">')).toBeLessThan(html.indexOf('<div class="content">'));
    expect(html.indexOf("<h1>")).toBeLessThan(html.indexOf('<div class="panel">'));
  });

  it("makes every card a single link whose text is the handle", () => {
    const home = page(buildProfilesSite(trio, { baseUrl: BASE }), "index.html");
    const cards = home.match(/<li class="card">.*?<\/li><\/ul><\/li>/gs)!;
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card.match(/<a /g)).toHaveLength(1);
  });
});

describe("head of every page", () => {
  it("declares an inline icon, so no visitor triggers a /favicon.ico 404", () => {
    for (const file of buildProfilesSite(trio, { baseUrl: BASE }).filter((f) => f.path.endsWith(".html"))) {
      expect(file.content).toContain("<link rel=\"icon\" href=\"data:image/svg+xml,");
      expect(file.content).toContain("<meta name=\"theme-color\" content=\"#070b14\">");
    }
  });
});
