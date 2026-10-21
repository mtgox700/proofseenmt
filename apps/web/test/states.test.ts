import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import config from "../next.config";
import { EmptyNote, EmptyState } from "../src/components/EmptyState";
import { ErrorView, incidentReference } from "../src/components/states/ErrorView";
import { NotFoundView } from "../src/components/states/NotFoundView";
import { PageSkeleton } from "../src/components/states/Skeleton";
import { STATES } from "../src/i18n/states";
import { langOfPath, readLangHeader } from "../src/lib/request-lang";

/*
 * Lot g of the redesign: the states between pages. An unknown address answers the 404 of the brand, in its language,
 * with status 404; a failed page says so without leaking anything of the error; the pages that read data on the server
 * show a fixed-size skeleton; an empty list says what is missing, never with a figure, never in green.
 */

const route = vi.hoisted(() => ({ lang: "fr" as string | undefined }));

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useParams: () => (route.lang === undefined ? {} : { lang: route.lang }),
  useRouter: () => ({ refresh: () => undefined }),
}));

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(web, "src", "app");
const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");
const html = (element: React.ReactElement): string => renderToStaticMarkup(element);
const GREEN = /--ps-proof|tag-proof/;

beforeEach(() => {
  route.lang = "fr";
});

describe("404", () => {
  it.each(["fr", "en"] as const)("speaks %s, links the public pages of that language and searches its missions", (lang) => {
    const page = html(createElement(NotFoundView, { lang }));
    const copy = STATES[lang].notFound;
    expect(page).toContain(`<h1 id="nf-title" class="nf-title">${copy.title.replace(/'/g, "&#x27;")}</h1>`);
    for (const path of ["", "/missions", "/freelances", "/entreprises"]) expect(page).toContain(`href="/${lang}${path}"`);
    const form = page.match(/<form class="nf-search"[^>]*>/)?.[0] ?? "";
    expect(form).toContain('role="search"');
    expect(form).toContain('method="get"');
    expect(form).toContain(`action="/${lang}/missions"`);
    expect(page).toContain('name="q"');
    // The drawing is decorative and inline: no image file, and its meaning is said in words next to it.
    expect(page).toMatch(/<svg class="nf-art-svg"[^>]*aria-hidden="true"/);
    expect(page).not.toMatch(/<img|<script/);
    expect(page).toContain(copy.mark.replace(/'/g, "&#x27;"));
    expect(page).not.toMatch(GREEN);
  });

  it("reads the language of an unknown address from its path, and trusts nothing else", () => {
    expect(langOfPath("/fr/n-existe-pas")).toBe("fr");
    expect(langOfPath("/en")).toBe("en");
    expect(langOfPath("/en/app/unknown")).toBe("en");
    expect(langOfPath("/english/page")).toBe("none");
    expect(langOfPath("/de/foo")).toBe("none");
    expect(langOfPath("/")).toBe("none");
    expect(readLangHeader("en")).toBe("en");
    expect(readLangHeader("EN")).toBe("none");
    expect(readLangHeader("<script>")).toBe("none");
    expect(readLangHeader(null)).toBe("none");
  });

  it("answers every unknown address with the global 404, rendered on the server in the address's language", () => {
    // An unmatched address never reaches a page: Next renders global-not-found.tsx with status 404 (measured on the
    // dev server, 2026-10-21: /fr/..., /en/..., /de/..., /xyz all 404, h1 in the HTML without JavaScript).
    expect(config.experimental?.globalNotFound).toBe(true);
    expect(existsSync(join(app, "[lang]", "[...missing]"))).toBe(false);
    const global = read(app, "global-not-found.tsx");
    expect(global).toContain("readLangHeader((await headers()).get(LANG_HEADER))");
    expect(global).toContain("<html lang={lang}>");
    expect(global).toContain('<NotFoundView lang={lang} />');
    expect(global).toContain('asked === "none"');
    expect(global).toContain("robots: { index: false, follow: false }");
    // The middleware writes the header on every request it lets through, from the path only.
    const middleware = read(web, "src", "middleware.ts");
    expect(middleware).toContain("headers.set(LANG_HEADER, langOfPath(request.nextUrl.pathname));");
    expect(middleware).not.toMatch(/NextResponse\.next\(\)/);
  });

  it("keeps a branded 404 for the notFound() of a page, in the segment and in the connected space", () => {
    for (const file of [["[lang]", "not-found.tsx"], ["[lang]", "app", "not-found.tsx"]]) expect(existsSync(join(app, ...file)), file.join("/")).toBe(true);
    expect(read(app, "[lang]", "not-found.tsx")).toContain('<LangPick fr={<Page lang="fr" />} en={<Page lang="en" />} />');
  });

  it("opens no page to indexing", () => {
    for (const file of [["[lang]", "not-found.tsx"], ["global-not-found.tsx"], ["[lang]", "app", "not-found.tsx"]]) expect(read(app, ...file)).not.toMatch(/index:\s*true/);
  });
});

describe("the barometer address", () => {
  it("leads to the day-rate barometer for good, in both languages", async () => {
    const rules = (await config.redirects?.()) ?? [];
    expect(rules).toEqual(
      expect.arrayContaining([
        { source: "/:lang(fr|en)/barometre", destination: "/:lang/barometre/tjm", permanent: true },
        { source: "/barometre", destination: "/fr/barometre/tjm", permanent: true },
      ]),
    );
    // The home redirect is untouched.
    expect(rules).toContainEqual({ source: "/", destination: "/fr", permanent: false });
  });
});

describe("error", () => {
  const secret = "connect ECONNREFUSED 10.0.0.12:5432 at Pool.query (/srv/app/db.ts:42)";

  it.each(["fr", "en"] as const)("shows a human sentence in %s and nothing of the error", (lang) => {
    route.lang = lang;
    const error = Object.assign(new Error(secret), { digest: "4130296437" });
    const page = html(createElement(ErrorView, { error, reset: () => undefined }));
    expect(page).toContain(STATES[lang].error.title.replace(/'/g, "&#x27;"));
    expect(page).toContain(`>${STATES[lang].error.retry}</button>`);
    expect(page).toContain(`href="/${lang}"`);
    expect(page).toContain("<code>4130296437</code>");
    expect(page).not.toMatch(/ECONNREFUSED|10\.0\.0\.12|db\.ts|Pool\.query|stack/i);
  });

  it("shows the reference only when it is an opaque token", () => {
    expect(incidentReference({ digest: "4130296437" })).toBe("4130296437");
    expect(incidentReference({})).toBeNull();
    expect(incidentReference({ digest: "<script>alert(1)</script>" })).toBeNull();
    expect(incidentReference({ digest: "x".repeat(65) })).toBeNull();
  });

  it("never reads the message or the stack in the boundaries", () => {
    for (const file of [["components", "states", "ErrorView.tsx"], ["app", "global-error.tsx"], ["app", "[lang]", "error.tsx"], ["app", "[lang]", "app", "error.tsx"]]) {
      expect(read(web, "src", ...file), file.join("/")).not.toMatch(/\.message\b|\.stack\b/);
    }
    expect(read(app, "global-error.tsx")).toContain('<html lang="fr">');
  });
});

describe("loading", () => {
  it("is never declared where a page can redirect or answer 404: a loading boundary would stream a 200 with a meta refresh", () => {
    // Inside a loading boundary, redirect() and notFound() run after the response started: the visitor gets a 200 page
    // that refreshes itself instead of a 307 or a 404. The connected space redirects signed-out, suspended and
    // role-less accounts; the client space and the mission confirmation answer 404 to an unknown link.
    for (const file of [["[lang]", "loading.tsx"], ["[lang]", "app", "loading.tsx"], ["[lang]", "espace", "[reference]", "loading.tsx"], ["[lang]", "confirmer-mission", "[id]", "loading.tsx"]]) {
      expect(existsSync(join(app, ...file)), file.join("/")).toBe(false);
    }
  });

  it.each(["fr", "en"] as const)("announces itself once, politely, in %s, and draws a fixed number of rows", (lang) => {
    route.lang = lang;
    const page = html(createElement(PageSkeleton, { rows: 4 }));
    expect(page).toContain(`<p class="sr-only" role="status">${STATES[lang].loading}</p>`);
    expect(page).toContain('aria-busy="true"');
    expect(page.match(/class="sk-row"/g)).toHaveLength(4);
  });

  it("holds still under reduced motion and animates opacity only", () => {
    const css = read(web, "src", "styles", "states.css");
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, "");
    expect(outside).not.toMatch(/animation:/);
    const keyframes = css.match(/@keyframes sk-breathe \{[^}]*\}/)?.[0] ?? "";
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/transform|width|height|background-position/);
    // Fixed sizes: the rows and bars have their height written down.
    expect(css).toMatch(/\.sk-row \{[^}]*height: 4rem/);
    expect(css).toMatch(/\.sk-title \{[^}]*height: 2\.5rem/);
  });
});

describe("empty state", () => {
  it("says what is missing, then where to go, with the main call first", () => {
    const page = html(
      createElement(EmptyState, {
        title: "Aucune mission pour l'instant.",
        headingLevel: 3,
        actions: [
          { href: "/fr/missions", label: "Missions" },
          { href: "/fr/app/recherche", label: "Recherche" },
        ],
      }),
    );
    expect(page).toContain('<h3 class="empty-title">Aucune mission pour l&#x27;instant.</h3>');
    expect(page).toMatch(/<a class="btn btn-primary" href="\/fr\/missions">Missions<\/a><a class="btn" href="\/fr\/app\/recherche">Recherche<\/a>/);
    expect(page).toMatch(/<svg class="empty-mark"[^>]*aria-hidden="true"/);
    expect(page).not.toMatch(/\d+\s*(?:missions?|profils?)/);
    expect(page).not.toMatch(GREEN);
  });

  it("keeps the children of the pages that already use it, and renders no empty body or action row", () => {
    const page = html(createElement(EmptyState, { title: "T" }, createElement("p", null, "Texte")));
    expect(page).toContain('<div class="empty-body"><p>Texte</p></div>');
    expect(page).not.toContain("empty-actions");
    expect(html(createElement(EmptyState, { title: "T" }))).not.toContain("empty-body");
  });

  it("has a one-line form for a list under a heading", () => {
    const page = html(createElement(EmptyNote, null, "Aucune candidature pour l'instant."));
    expect(page).toMatch(/^<p class="empty-note"><svg class="empty-mark"[^>]*>.*<\/svg><span>Aucune candidature pour l&#x27;instant\.<\/span><\/p>$/);
  });

  it("replaces the bare sentences of the connected space", () => {
    const pages = ["abonnements", "alertes", "entreprises", "listes", join("listes", "[id]"), join("missions", "[id]"), "recherche"];
    for (const page of pages) {
      const source = read(app, "[lang]", "app", page, "page.tsx");
      expect(source, page).toMatch(/<Empty(?:State|Note)\b/);
      expect(source, page).not.toMatch(/<p className="muted">\{[\w.]+(?:\.(?:none|empty|itemsEmpty|applicantsEmpty))\}<\/p>/);
    }
    for (const file of [["market", "ApplicantsBoard.tsx"], ["community", "CommentThread.tsx"]]) expect(read(web, "src", "components", ...file)).toContain("<EmptyNote>");
  });

  it("styles every state without green and without a colour of its own", () => {
    const css = read(web, "src", "styles", "states.css");
    expect(css).not.toMatch(GREEN);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
