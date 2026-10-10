import { describe, expect, it } from "vitest";
import { legacyRoute } from "../src/lib/legacy-pages";

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

  it("never serves a path it does not list", () => {
    expect(legacyRoute("/n/someone-else/")).toEqual({ kind: "redirect", to: "/n/someone-else" });
    expect(legacyRoute("/n/../../etc/passwd/")).toEqual({ kind: "redirect", to: "/n/../../etc/passwd" });
  });
});
