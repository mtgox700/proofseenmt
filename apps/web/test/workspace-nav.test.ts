import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../src/components/app/AppShell";
import { sectionsFor } from "../src/components/app/workspace-sections";
import { dictionary } from "../src/i18n";
import type { Role } from "../src/lib/roles";
import type { Person } from "../src/lib/session";
import { locate } from "../src/lib/workspace-nav";

/*
 * Lot 1 of the connected redesign: the menu in base sections (CONNECTED_PLAN §2.5), the pages of a section as tabs,
 * and the safety rule of the shell: a role sees exactly what the server lets it open, nothing more.
 */

const route = vi.hoisted(() => ({ path: "/fr/app" }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => route.path }));
// Clerk's account button needs its provider; the shell only places it.
vi.mock("@clerk/nextjs", () => ({ UserButton: () => createElement("span", { className: "user-button" }) }));

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(web, "src", "app", "[lang]");
const ROLES: readonly Role[] = ["freelance", "company", "operator"];

const person = (role: Role | null): Person => ({ id: "u-1", name: "Camille Martin", firstName: "Camille", email: "camille@example.org", emailVerified: true, role });
const labels = (role: Role): string[] => sectionsFor("fr", role, null).map((s) => s.label);
const hrefs = (role: Role): string[] => sectionsFor("fr", role, null).flatMap((s) => [s.href, ...s.tabs.map((t) => t.href)]);

const shell = (role: Role | null, path: string): string => {
  route.path = path;
  return renderToStaticMarkup(createElement(AppShell, { lang: "fr", t: dictionary("fr"), person: person(role), counts: { messages: 2, notifications: 0 } }, createElement("p", null, "Contenu")));
};

/** The roles a page lets in, read from its guard (`pageMarket`, `requirePerson`, the back-office layout). */
const allowedBy = (href: string): readonly Role[] | "public" => {
  const rest = href.replace(/^\/fr/, "");
  if (!rest.startsWith("/app")) {
    expect(existsSync(join(app, ...rest.split("/").filter(Boolean), "route.ts")), `${href} is a public route`).toBe(true);
    return "public";
  }
  const parts = rest.split("/").filter(Boolean);
  const page = join(app, ...parts, "page.tsx");
  expect(existsSync(page), page).toBe(true);
  const layouts = parts.map((_, i) => join(app, ...parts.slice(0, i + 1), "layout.tsx")).filter(existsSync);
  if ([page, ...layouts].some((file) => /operatorOnly\(|operatorPage\(/.test(readFileSync(file, "utf8")))) return ["operator"];
  // The guard of the page itself: the first one of its default export (the home holds one per role below it).
  const source = readFileSync(page, "utf8");
  const guard = /(?:pageMarket|requirePerson)\(lang(?:, \[([^\]]*)\])?\)/.exec(source.slice(source.indexOf("export default")));
  expect(guard, `${href} has a guard`).not.toBeNull();
  const list = guard?.[1];
  return list === undefined ? ROLES : (list.match(/"(\w+)"/g) ?? []).map((r) => r.slice(1, -1) as Role);
};

describe("the menu of the connected space, in base sections", () => {
  it("gives each role its sections, in the order of a file", () => {
    expect(labels("freelance")).toEqual(["Accueil", "Profil", "Preuves", "Visibilité IA", "Missions", "Messages", "Contrats", "Argent", "Réseau", "Compte"]);
    expect(labels("company")).toEqual(["Accueil", "Recherche", "Missions", "Confirmations", "Messages", "Contrats", "Argent", "Équipe", "Réseau", "Compte"]);
    expect(labels("operator")).toEqual(["Accueil", "Back-office", "Messages", "Articles", "Annuaire"]);
  });

  it("puts the pages of a section in its tabs", () => {
    const tabs = (role: Role, section: string): string[] => sectionsFor("fr", role, null).find((s) => s.label === section)?.tabs.map((t) => t.label) ?? [];
    expect(tabs("freelance", "Missions")).toEqual(["Candidatures", "Pour vous", "Enregistrées", "Toutes les missions"]);
    expect(tabs("freelance", "Argent")).toEqual(["Factures", "Facturation et versement"]);
    expect(tabs("freelance", "Réseau")).toEqual(["Fil", "Entreprises", "Invitations", "Abonnements"]);
    expect(tabs("freelance", "Compte")).toEqual(["Alertes", "Réglages"]);
    expect(tabs("company", "Recherche")).toEqual(["Recherche", "Listes"]);
    expect(tabs("company", "Argent")).toEqual(["Factures", "Facturation"]);
    expect(tabs("company", "Messages")).toEqual([]);
  });

  it.each(ROLES)("shows the %s role only pages its guard lets it open", (role) => {
    for (const href of hrefs(role)) {
      const allowed = allowedBy(href);
      if (allowed !== "public") expect(allowed, `${role} -> ${href}`).toContain(role);
    }
  });

  it("shows no menu before a role is chosen: such a person can open nothing else yet", () => {
    expect(sectionsFor("fr", null, null)).toEqual([]);
    expect(shell(null, "/fr/app/bienvenue")).not.toContain("ws-nav");
  });

  it("writes no name of a person, a company or a mission in the menu", () => {
    for (const role of ROLES) {
      const html = shell(role, "/fr/app");
      const menu = html.slice(html.indexOf('<nav class="ws-nav"'), html.indexOf("<main"));
      expect(menu).not.toContain("Camille");
    }
  });
});

describe("where a page sits in the menu", () => {
  const freelance = sectionsFor("fr", "freelance", null);
  const at = (path: string): [string | null, string | null] => {
    const place = locate(freelance, path);
    return [place.section?.label ?? null, place.tab?.label ?? null];
  };

  it("marks the home of the space on its own address only", () => {
    expect(at("/fr/app")).toEqual(["Accueil", null]);
    expect(at("/fr/app/notifications")).toEqual([null, null]);
    expect(at("/fr/app/bienvenue")).toEqual([null, null]);
  });

  it("finds the section and the tab by the deepest address", () => {
    expect(at("/fr/app/missions")).toEqual(["Missions", "Candidatures"]);
    expect(at("/fr/app/missions/pour-vous")).toEqual(["Missions", "Pour vous"]);
    expect(at("/fr/app/missions/m-1/postuler")).toEqual(["Missions", "Candidatures"]);
    expect(at("/fr/app/facturation")).toEqual(["Argent", "Facturation et versement"]);
    expect(at("/fr/app/messages/c-1")).toEqual(["Messages", null]);
    expect(at("/fr/app/entreprises-suivies")).toEqual([null, null]);
    expect(locate(freelance, null)).toEqual({ section: null, tab: null });
  });
});

describe("the frame, rendered by the server", () => {
  it("marks the section and its tab, and names the row of tabs", () => {
    const html = shell("freelance", "/fr/app/facturation");
    expect(html).toContain('<nav class="ws-nav" aria-label="Navigation de l&#x27;espace">');
    expect(html).toContain('<a aria-current="true" href="/fr/app/factures">Argent</a>');
    expect(html).toContain('<nav class="ws-tabs" aria-label="Argent, pages de la section">');
    expect(html).toContain('<a aria-current="page" href="/fr/app/facturation">Facturation et versement</a>');
    expect(html).not.toContain("/fr/app/recherche");
    expect(html).not.toContain("Adresses prouvées");
  });

  it("keeps the unread count on Messages, and the bell in the bar", () => {
    const html = shell("company", "/fr/app/messages");
    expect(html).toMatch(/<a aria-current="page" href="\/fr\/app\/messages">Messages<span class="live-count"> \(2<span class="sr-only"> [^<]+<\/span>\)<\/span><\/a>/);
    expect(html).toContain('<a class="app-bell" href="/fr/app/notifications">');
    expect(html).not.toContain('class="ws-tabs"');
    for (const freelanceOnly of ["/fr/app/profil", "/fr/app/preuves", "/fr/app/visibilite", "/fr/app/missions/pour-vous"]) expect(html).not.toContain(freelanceOnly);
  });

  it("reads the bar in the order of its markup: lockup, role, then notifications, language and account", () => {
    const html = shell("freelance", "/fr/app");
    const order = ['class="brand"', 'class="tag tag-quiet app-role"', 'class="app-tools"', 'class="app-bell"', 'class="app-lang"', 'class="user-button"', 'class="ws-nav"', '<main id="contenu"'].map((needle) => html.indexOf(needle));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
