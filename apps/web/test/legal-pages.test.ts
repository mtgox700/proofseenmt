import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HOSTS, PROCESSORS, PUBLISHER, renderLegalPage } from "@proofseen/hub";
import { describe, expect, it } from "vitest";
import { GET as conditions } from "../src/app/[lang]/conditions/route";
import { GET as privacy } from "../src/app/[lang]/confidentialite/route";
import { GET as notice } from "../src/app/[lang]/mentions-legales/route";
import { GET as sitemapPages } from "../src/app/sitemap-pages.xml/route";

/*
 * The three legal pages, served as raw HTML (C24), and the guard that keeps the privacy policy honest: every external
 * service the production code talks to must be named on the page. A new API host or SDK in the code fails this test
 * until the policy says who receives what.
 */

const ROUTES = { "mentions-legales": notice, confidentialite: privacy, conditions } as const;
const ROOT = join(__dirname, "..", "..", "..");

const call = (handler: (request: Request, context: { params: Promise<{ lang: string }> }) => Promise<Response>, lang: string, path: string) =>
  handler(new Request(`https://proofseen.com/${lang}/${path}`), { params: Promise.resolve({ lang }) });

describe("legal pages", () => {
  for (const [path, handler] of Object.entries(ROUTES)) {
    for (const lang of ["fr", "en"]) {
      it(`/${lang}/${path} answers 200 with the publisher's SIREN and the hosts`, async () => {
        const response = await call(handler, lang, path);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
        const body = await response.text();
        expect(body).toContain(PUBLISHER.siren);
        expect(body).toContain("IONOS");
        for (const host of HOSTS) expect(body).toContain(host.name);
        expect(body).toContain(`<link rel="canonical" href="https://proofseen.com/${lang}/${path}">`);
      });
    }

    it(`/de/${path} does not exist`, async () => {
      expect((await call(handler, "de", path)).status).toBe(404);
    });
  }

  it("are listed in the sitemap of fixed pages", async () => {
    const xml = await sitemapPages(new Request("https://proofseen.com/sitemap-pages.xml")).text();
    for (const path of Object.keys(ROUTES)) {
      for (const lang of ["fr", "en"]) expect(xml).toContain(`<loc>https://proofseen.com/${lang}/${path}</loc>`);
    }
  });
});

/** Source files of the production web app and the packages it runs: no tests, no generated code, not the policy itself. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" || name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx|mjs)$/.test(name) && !/^legal-/.test(name) ? [path] : [];
  });

const CODE = [join(ROOT, "apps", "web", "src"), ...readdirSync(join(ROOT, "packages")).map((p) => join(ROOT, "packages", p, "src"))]
  .filter((dir) => {
    try {
      return statSync(dir).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap(sources)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

/** Each external API host the code may call, and the provider the policy must name for it. */
const API_HOSTS: Readonly<Record<string, string>> = {
  "api.anthropic.com": "Anthropic",
  "api.openai.com": "OpenAI",
  "api.perplexity.ai": "Perplexity",
  "api.resend.com": "Resend",
  "api.stripe.com": "Stripe",
  "api.indexnow.org": "IndexNow",
  "recherche-entreprises.api.gouv.fr": "Recherche d'entreprises",
};

/** Services reached through an SDK or a connection string rather than a literal API address. */
const SDKS: readonly { readonly pattern: RegExp; readonly provider: string }[] = [
  { pattern: /from "@clerk\//, provider: "Clerk" },
  { pattern: /from "web-push"/, provider: "Web Push" },
  { pattern: /railway/i, provider: "Railway" },
];

describe("privacy policy against the code", () => {
  const pages = (["fr", "en"] as const).map((lang) => renderLegalPage({ baseUrl: "https://proofseen.com", lang, page: "confidentialite" }));

  it("knows every external API host the code calls", () => {
    const hosts = new Set([...CODE.matchAll(/["'`]https:\/\/((?:api|[a-z0-9-]+\.api)\.[a-z0-9.-]+)/g)].map((m) => m[1] ?? ""));
    expect(hosts.size).toBeGreaterThanOrEqual(5);
    const unknown = [...hosts].filter((host) => API_HOSTS[host] === undefined);
    expect(unknown, "new external API host: name the provider in the privacy policy and add it here").toEqual([]);
  });

  it("names every provider found in the code, in both languages", () => {
    const found = [
      ...Object.entries(API_HOSTS)
        .filter(([host]) => CODE.includes(`https://${host}`))
        .map(([, provider]) => provider),
      ...SDKS.filter((sdk) => sdk.pattern.test(CODE)).map((sdk) => sdk.provider),
    ];
    expect(found).toEqual(expect.arrayContaining(["Anthropic", "OpenAI", "Perplexity", "Resend", "Clerk", "Railway", "Web Push"]));
    for (const html of pages) {
      const text = html.replace(/&#39;/g, "'");
      const missing = found.filter((provider) => !text.includes(provider));
      expect(missing).toEqual([]);
    }
  });

  it("lists in its table only providers it explains, and names the IONOS host", () => {
    for (const html of pages) {
      for (const processor of PROCESSORS) expect(html.replace(/&#39;/g, "'")).toContain(processor.name);
      expect(html).toContain("IONOS");
    }
  });
});
