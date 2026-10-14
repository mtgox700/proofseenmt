import { describe, expect, it } from "vitest";
import { legacyRoute, legacyTarget } from "../src/lib/legacy-pages";

describe("legacy pages of the static site", () => {
  it("serves each indexed address as it is, from the saved page", () => {
    expect(legacyRoute("/n/ayoub-hammoudi/")).toEqual({ kind: "serve", file: "/legacy/n/ayoub-hammoudi/index.html" });
    expect(legacyRoute("/en/p/FR-7H2XK/")).toEqual({ kind: "serve", file: "/legacy/en/p/FR-7H2XK/index.html" });
    expect(legacyRoute("/methode/")).toEqual({ kind: "serve", file: "/legacy/methode/index.html" });
    expect(legacyRoute("/api/profiles.json")).toEqual({ kind: "serve", file: "/legacy/api/profiles.json" });
  });

  it("sends the bare address of a legacy page to its indexed address", () => {
    expect(legacyRoute("/contact")).toEqual({ kind: "redirect", to: "/contact/" });
  });

  it("keeps the application's rule elsewhere: no trailing slash", () => {
    expect(legacyRoute("/fr/missions/")).toEqual({ kind: "redirect", to: "/fr/missions" });
    expect(legacyRoute("/en/")).toEqual({ kind: "redirect", to: "/en" });
    expect(legacyRoute("/fr/missions")).toEqual({ kind: "none" });
    expect(legacyRoute("/")).toEqual({ kind: "none" });
  });

  it("sends the retired demonstration spaces to the connected space and to the public directory", () => {
    expect(legacyRoute("/fr/freelance")).toEqual({ kind: "redirect", to: "/fr/app" });
    expect(legacyRoute("/en/freelance/rapport")).toEqual({ kind: "redirect", to: "/en/app" });
    expect(legacyRoute("/fr/freelance/preuves/")).toEqual({ kind: "redirect", to: "/fr/app" });
    expect(legacyRoute("/fr/entreprise")).toEqual({ kind: "redirect", to: "/fr/freelances" });
    expect(legacyRoute("/en/entreprise/FR-7H2XK")).toEqual({ kind: "redirect", to: "/en/freelances" });
  });

  it("leaves the public directory and look-alike addresses alone", () => {
    expect(legacyRoute("/fr/freelances")).toEqual({ kind: "none" });
    expect(legacyRoute("/en/freelances")).toEqual({ kind: "none" });
    expect(legacyRoute("/fr/freelancer")).toEqual({ kind: "none" });
    expect(legacyRoute("/fr/entreprises")).toEqual({ kind: "none" });
    expect(legacyRoute("/de/freelance")).toEqual({ kind: "none" });
  });

  it("never serves a path it does not list", () => {
    expect(legacyRoute("/n/someone-else/")).toEqual({ kind: "redirect", to: "/n/someone-else" });
    expect(legacyRoute("/n/../../etc/passwd/")).toEqual({ kind: "redirect", to: "/n/../../etc/passwd" });
  });
});

describe("redirect targets never leave the site", () => {
  it("builds no redirect from a path that a URL parser would read as another host", () => {
    for (const path of ["//evil.example/", "//evil.example", "///evil.example/", "/\\evil.example/", "/a\\b/", "/fr/freelance\\..\\x"]) {
      expect(legacyRoute(path), path).toEqual({ kind: "none" });
    }
  });

  it("keeps the request's origin whatever the route says, and carries the query", () => {
    const base = "https://proofseen.com/contact?ref=mail";
    for (const route of [{ kind: "redirect", to: "//evil.example/x" }, { kind: "redirect", to: "/contact/" }, { kind: "serve", file: "/legacy/contact/index.html" }] as const) {
      const target = legacyTarget(route, base);
      expect(target.origin, JSON.stringify(route)).toBe("https://proofseen.com");
      expect(target.search).toBe("?ref=mail");
    }
    expect(legacyTarget({ kind: "redirect", to: "/contact/" }, base).pathname).toBe("/contact/");
  });
});
