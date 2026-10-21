import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hubNotFound, hubUnavailable } from "../src/lib/hub-status";

/*
 * Kensa review, B2: eight routes of the hub answered a bare 404 of 147 bytes, white, without a viewport, in French
 * even under /en. They now answer the brand's page, in the address's language, with the route's status.
 */

const app = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "[lang]");
const ROUTES = ["profils/[slug]", "missions/[id]", "entreprises/[slug]", "blog/[slug]", "metiers/[key]", "postes/[key]", "missions/ville/[city]", "publications/[id]"];

describe("the hub's 404 and incident pages", () => {
  it("keeps the 404 status and speaks the language of the address", async () => {
    const en = hubNotFound(new Request("https://proofseen.com/en/missions/zzz"), "en", "public, max-age=60");
    expect(en.status).toBe(404);
    expect(en.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(en.headers.get("cache-control")).toBe("public, max-age=60");
    const body = await en.text();
    expect(body).toContain('<html lang="en">');
    expect(body).toContain("This page does not exist.");
    expect(body).toContain('<meta name="viewport"');
    expect(body).toContain('<meta name="robots" content="noindex">');
    expect(body).not.toMatch(/<script\b/i);
    expect(body.length).toBeGreaterThan(5_000);
  });

  it("answers an unknown language segment in French, the site's default", async () => {
    const body = await hubNotFound(new Request("https://proofseen.com/de/profils/x"), "de", "no-store").text();
    expect(body).toContain('<html lang="fr">');
  });

  it("answers an incident with its status, never cached, offering the same address again", async () => {
    const res = hubUnavailable(new Request("https://proofseen.com/fr/profils/fr-abcde?x=1"), "fr", 503);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain('href="/fr/profils/fr-abcde"');
  });

  it.each(ROUTES)("%s no longer carries a bare HTML document of its own", (route) => {
    const source = readFileSync(join(app, route, "route.ts"), "utf8");
    expect(source).not.toContain("<!doctype html>");
    expect(source).toContain("hubNotFound(request, lang,");
  });
});
