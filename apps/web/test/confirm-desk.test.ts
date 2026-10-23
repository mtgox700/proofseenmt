import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CompanyDesk } from "@proofseen/db";
import { PROOF_LABELS } from "../../../packages/hub/src/profile-proofs";
import { CompanyToDo } from "../src/components/insights/CompanyToDo";
import { ConfirmationAck } from "../src/components/market/ConfirmationAck";
import { confirmDeskEn } from "../src/i18n/market/confirm-desk-en";
import { confirmDeskFr } from "../src/i18n/market/confirm-desk-fr";
import { strikesNow, STRIKE_WINDOW_MS } from "../src/lib/strike";

/*
 * Lot 3 of the connected redesign, « confirmer » : the strike is real. The acknowledgement of a decision carries the
 * mark the mission now has on the profile, word for word, and strikes it once, only right after the decision; a refusal
 * carries no green; « À traiter » shows counts read from the database, a link only where there is work.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(web, "src");
const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const html = (element: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(element).replace(/&#x27;/g, "'");

const NOW = new Date("2026-10-22T14:00:00Z");
const ID = "0199f0a0-0000-7000-8000-000000000001";
const ack = (over: { decision?: "confirmed" | "refused"; decidedAt?: Date; by?: "company" | "contact" } = {}): string =>
  html(
    createElement(
      ConfirmationAck,
      {
        lang: "fr",
        d: confirmDeskFr.ack,
        id: ID,
        recorded: { decision: over.decision ?? "confirmed", decidedAt: over.decidedAt ?? new Date(NOW.getTime() - 5_000) },
        by: over.by ?? "company",
        reference: "FR-ABCDE",
        title: "Mission",
        headingLevel: 2,
        now: NOW,
      },
      createElement("p", { className: "ack-claim" }, "Camille (FR-ABCDE)"),
    ),
  );

describe("the acknowledgement carries the mark of the profile, word for word", () => {
  it.each([
    ["fr", confirmDeskFr],
    ["en", confirmDeskEn],
  ] as const)("%s: the cartouche and its trace are those of the hub's register", (lang, d) => {
    const l = PROOF_LABELS[lang];
    expect(d.ack.seal.company("D")).toBe(l.verifiedOn("client_confirmation", "D", false));
    expect(d.ack.seal.contact("D")).toBe(l.verifiedOn("client_confirmation", "D", true));
    expect(d.ack.source).toBe(l.source);
    expect(d.ack.by).toBe(l.by);
    expect(d.ack.sourceValue).toBe(l.missionSource("client_confirmation", ""));
    expect(d.ack.byValue.company).toBe(l.missionBy("client_confirmation", false));
    expect(d.ack.byValue.contact).toBe(l.missionBy("client_confirmation", true));
  });

  it("dates the seal like the hub, on the UTC day, even late in the evening in Paris", () => {
    const late = new Date("2026-10-22T22:30:00Z");
    const out = ack({ decidedAt: late, by: "contact" });
    expect(out).toContain('<p class="seal"><time dateTime="2026-10-22">Confirmée par un contact chez le client le 22 octobre 2026</time></p>');
    expect(out).toContain("<dt>Vérifié par</dt><dd>Un contact chez le client, par lien signé</dd>");
  });
});

describe("the strike is played once, for a decision just read in the database", () => {
  it("strikes a decision taken within the window, through the island, never by the server's own attribute", () => {
    const out = ack();
    expect(out).toContain('<div class="ack-seal" data-strike-once="">');
    // The server sends the seal set: the island strikes it after hydration, once per device, if motion is allowed.
    expect(out).not.toMatch(/<p class="seal" data-strike/);
  });

  it("shows an older decision set and still, with no script to strike it", () => {
    const out = ack({ decidedAt: new Date(NOW.getTime() - STRIKE_WINDOW_MS - 1_000) });
    expect(out).toContain('<div class="ack-seal"><div class="sealed"><p class="seal">');
    expect(out).not.toContain("data-strike");
  });

  it("keeps the window around the decision, both ways, for clocks that differ a little", () => {
    expect(strikesNow(NOW, NOW)).toBe(true);
    expect(strikesNow(new Date(NOW.getTime() - STRIKE_WINDOW_MS), NOW)).toBe(true);
    expect(strikesNow(new Date(NOW.getTime() + 30_000), NOW)).toBe(true);
    expect(strikesNow(new Date(NOW.getTime() - STRIKE_WINDOW_MS - 1), NOW)).toBe(false);
    expect(strikesNow(new Date("2026-09-01T00:00:00Z"), NOW)).toBe(false);
  });

  it("writes a refusal in ink, dated, with no seal, no green and nothing to strike", () => {
    const out = ack({ decision: "refused" });
    expect(out).toContain('<p class="ack-refused"><time dateTime="2026-10-22T13:59:55.000Z">Refusée le 22 octobre 2026\u202f: rien n\'est publié.</time></p>');
    expect(out).not.toContain("seal");
    expect(out).not.toContain("strike");
  });

  it("keeps the island small, local and silent: no network, no personal data, only the opaque id it was given", () => {
    const island = read(src, "components", "proof", "StrikeOnce.tsx");
    expect(island.startsWith('"use client";')).toBe(true);
    expect([...island.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1])).toEqual(["react"]);
    expect(island).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|document\.cookie|sessionStorage/);
    expect(island).toContain("prefers-reduced-motion: reduce");
    expect(island).toMatch(/setAttribute\("data-strike", ""\)/);
  });
});

const desk = (over: Partial<CompanyDesk> = {}): CompanyDesk => ({
  admin: true,
  confirmations: { count: 2, soonest: new Date("2026-11-21T09:00:00Z") },
  toSign: 1,
  toPay: 0,
  unreadApplications: 12,
  ...over,
});
const todo = (d: CompanyDesk): string => html(createElement(CompanyToDo, { lang: "fr", t: confirmDeskFr.todo, organisation: "Acme Industries", desk: d }));

describe("« À traiter » on the company home", () => {
  it("links every row with work to the screen where it is done, its deadline written out", () => {
    const out = todo(desk());
    expect(out).toContain('<a class="todo-row" href="/fr/app/confirmations"><span class="todo-n">2</span> <span class="todo-what">confirmations de mission en attente</span> <time class="todo-when" dateTime="2026-11-21T09:00:00.000Z">La première expire le 21 novembre 2026</time></a>');
    expect(out).toContain('<a class="todo-row" href="/fr/app/contrats"><span class="todo-n">1</span> <span class="todo-what">contrat qui attend votre signature</span>');
    expect(out).toContain('<a class="todo-row" href="/fr/app/missions"><span class="todo-n">12</span> <span class="todo-what">candidatures que personne n\'a encore ouvertes</span>');
  });

  it("says a zero instead of hiding the row, and does not make it a link", () => {
    const out = todo(desk({ confirmations: { count: 0, soonest: null }, toSign: 0, toPay: 0, unreadApplications: 0 }));
    expect(out.match(/<p class="todo-row is-clear">/g)).toHaveLength(4);
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("<time");
    expect(out).toContain("0</span> <span class=\"todo-what\">contrat à payer sous séquestre</span>");
  });

  it("shows a member only what a member can do, and says who handles the rest", () => {
    const out = todo(desk({ admin: false, confirmations: null, toSign: null, toPay: null, unreadApplications: 1 }));
    expect(out.match(/class="todo-row/g)).toHaveLength(1);
    expect(out).toContain("candidature que personne n'a encore ouverte");
    expect(out).toContain(confirmDeskFr.todo.adminsOnly("Acme Industries"));
    expect([...out.matchAll(/class="todo-what">([^<]*)</g)].map((m) => m[1])).toEqual(["candidature que personne n'a encore ouverte"]);
  });

  it("counts, never ranks: no percentage, no score, no person named", () => {
    const out = todo(desk());
    expect(out).not.toMatch(/%|score|rang|classement/i);
  });
});

describe("the sheet of lot 3", () => {
  const sheet = read(src, "styles", "app-confirmer.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("is loaded by the screens of the lot only", () => {
    const importers = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && read(f).includes('import "@/styles/app-confirmer.css";'))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    expect(importers).toEqual(["app/[lang]/app/confirmations/page.tsx", "components/insights/CompanyToDo.tsx", "components/market/ConfirmationAck.tsx"]);
  });

  it("has no green of its own and hides nothing: the only gesture is the seal's, from @proofseen/brand", () => {
    expect(sheet).not.toMatch(/--ps-proof|#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(sheet).not.toMatch(/opacity:\s*0(?![.\d])|scale[XY]?\(\s*0\s*[,)]|stroke-dashoffset|content-visibility|@keyframes|animation/);
  });

  it("gives every row that is a link a target of at least 44 px, and a focus ring in the focus colour", () => {
    expect(sheet).toMatch(/\.todo-row \{[^}]*min-height: 3rem/);
    expect(sheet).toMatch(/a\.todo-row:focus-visible \{[^}]*outline: 2px solid var\(--ps-focus\)/);
    expect(sheet).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*a\.todo-row:hover/);
  });
});

/** Every text of a dictionary, its functions called with a stand-in. */
const texts = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return texts((value as (arg: string) => unknown)("X"));
  return value !== null && typeof value === "object" ? Object.values(value).flatMap(texts) : [];
};

describe("the words of lot 3", () => {
  it("has no em dash in either language, and in French a narrow no-break space before : ; ? !", () => {
    for (const text of [...texts(confirmDeskFr), ...texts(confirmDeskEn)]) expect(text, text).not.toContain("\u2014");
    const french = texts(confirmDeskFr);
    expect(french.length).toBeGreaterThan(20);
    for (const text of french) expect(text, text).not.toMatch(/[^\u202f][:;?!]/);
  });
});
