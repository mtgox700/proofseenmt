import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * Lot 6 of the connected redesign (CONNECTED_PLAN section 3): the network, the account and the back office, brought to
 * the brand. Named links instead of arrows, the danger colour for erasure, 44 px targets, Clerk in the page's theme,
 * and the one true strike of this lot: the operator's acknowledgement of a verified URSSAF certificate.
 */

vi.mock("@/app/[lang]/app/fil/actions", () => ({ createPost: async () => undefined }));
vi.mock("@/app/[lang]/app/operateur/verification-actions", () => ({ verifyVigilance: async () => undefined, rejectVigilance: async () => undefined, revokeProof: async () => undefined }));

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts: string[]): string => readFileSync(join(web, "src", ...parts), "utf8");
const css = (file: string): string => read("styles", file).replace(/\/\*[\s\S]*?\*\//g, "");
const ruleOf = (sheet: string, selector: string): string => {
  const at = sheet.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return sheet.slice(at, sheet.indexOf("}", at) + 1);
};

describe("the feed's composer without a voice", () => {
  it("names its link instead of drawing an arrow", async () => {
    const { Composer } = await import("../src/components/community/Composer");
    const { marketDictionary } = await import("../src/i18n/market");
    for (const lang of ["fr", "en"] as const) {
      const c = marketDictionary(lang).community;
      for (const role of ["freelance", "company"] as const) {
        const html = renderToStaticMarkup(createElement(Composer, { lang, c, speaker: null, role, back: "following" }));
        const label = role === "freelance" ? c.composer.toProfile : c.composer.toCompany;
        expect(html).toContain(`>${label.replace(/'/g, "&#x27;")}</a>`);
        expect(html).not.toMatch(/>\s*[→←]\s*</);
      }
    }
  });
});

describe("the arrows of the lot are drawn, not read", () => {
  const files = [
    ["app", "[lang]", "app", "fil", "[id]", "page.tsx"],
    ["app", "[lang]", "app", "equipe", "page-publique", "page.tsx"],
    ["app", "[lang]", "app", "articles", "nouveau", "page.tsx"],
    ["app", "[lang]", "app", "articles", "[id]", "page.tsx"],
    ["app", "[lang]", "app", "operateur", "utilisateurs", "[id]", "page.tsx"],
    ["app", "[lang]", "app", "operateur", "journal", "page.tsx"],
    ["app", "[lang]", "app", "operateur", "retours", "page.tsx"],
  ];
  it.each(files.map((f) => [f.join("/"), f] as const))("%s hides every arrow from the accessible name", (_name, parts) => {
    const source = read(...parts);
    expect(source).toMatch(/[←→]/);
    expect(source.match(/[←→]/g)?.length ?? 0).toBe(source.match(/<span aria-hidden="true">[←→]<\/span>/g)?.length ?? 0);
  });

  it("keeps no arrow inside the dictionaries of the back office and the articles", async () => {
    const { marketDictionary } = await import("../src/i18n/market");
    for (const lang of ["fr", "en"] as const) {
      const m = marketDictionary(lang);
      for (const text of [m.operator.common.previous, m.operator.common.next, m.operator.users.back, m.articles.back]) expect(text).not.toMatch(/[←→]/);
    }
  });
});

describe("erasing the account", () => {
  it("speaks in the danger colour, never in the amber of 'to correct'", () => {
    const sheet = css("insights.css");
    for (const selector of [".settings-danger", ".btn-danger"]) {
      const rule = ruleOf(sheet, selector);
      expect(rule).toContain("var(--ps-danger)");
      expect(rule).not.toContain("--ps-signal");
    }
    // Disabled until the word is typed: the dashed brand state, not a faded button below contrast.
    expect(sheet).not.toMatch(/\.btn-danger:disabled\s*\{[^}]*opacity/);
  });
});

describe("the sign-in pages", () => {
  it("title on the page scale and never widen a phone", () => {
    const sheet = css("auth.css");
    expect(ruleOf(sheet, ".auth-copy h1")).toContain("var(--ps-step-4)");
    expect(ruleOf(sheet, ".auth-page")).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("theme Clerk with the page's own custom properties, in its current variable names, and no green", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const { CLERK_VARIABLES } = await import("../src/components/auth/AuthProvider");
    const colours = Object.entries(CLERK_VARIABLES).filter(([name]) => name.startsWith("color"));
    expect(colours.length).toBeGreaterThan(8);
    for (const [name, value] of colours) expect(value, name).toMatch(/^var\(--ps-[a-z-]+\)$/);
    expect(colours.map(([, value]) => value)).not.toContain("var(--ps-proof)");
    for (const legacy of ["colorText", "colorTextSecondary", "colorInputBackground", "colorInputText", "colorTextOnPrimaryBackground"]) expect(CLERK_VARIABLES).not.toHaveProperty(legacy);
    vi.unstubAllEnvs();
  });
});

describe("the back office", () => {
  it("makes every link a 44 px target and lets no long address widen the page", () => {
    const sheet = css("operator.css");
    const links = ruleOf(sheet, ".op-nav a, .op .row-actions a, .op .back-link");
    expect(links).toContain("min-height: 2.75rem");
    expect(ruleOf(sheet, ".op-tiles dt a::after")).toContain("inset: 0");
    expect(ruleOf(sheet, ".op")).toContain("minmax(0, 1fr)");
  });

  it("acknowledges a verified certificate with the seal, read back from the database, and strikes only just after", async () => {
    const { VerificationQueues } = await import("../src/components/operator/VerificationQueues");
    const { marketDictionary } = await import("../src/i18n/market");
    const o = marketDictionary("fr").operator;
    const verifiedAt = new Date("2026-10-23T09:00:00Z");
    const verified = { reference: "FR-2ABCD", issuedOn: new Date("2026-09-20T00:00:00Z"), expiresOn: new Date("2027-03-20T00:00:00Z"), verifiedAt };
    const render = (props: Record<string, unknown>): string => renderToStaticMarkup(createElement(VerificationQueues, { lang: "fr", o, attestations: [], disputes: [], ...props } as never));

    expect(render({})).not.toContain('class="seal"');
    const fresh = render({ verified, now: new Date(verifiedAt.getTime() + 5_000) });
    expect(fresh).toContain('<p class="seal" data-strike=""><time dateTime="2026-10-23">Attestation de vigilance de FR-2ABCD vérifiée le 23 octobre 2026</time></p>');
    expect(fresh).toContain("<dt>Contrôle</dt><dd>code de sécurité relu sur le site de l&#x27;URSSAF</dd>");
    expect(fresh).toContain("<dt>Échéance</dt><dd>20 mars 2027</dd>");
    // The same address opened again later: the cartouche is there, nothing strikes.
    expect(render({ verified, now: new Date(verifiedAt.getTime() + 3_600_000) })).toContain('<p class="seal"><time');
    // The empty queues are an empty note, not a bare sentence.
    expect(render({})).toContain('<p class="empty-note">');
  });

  it("asks the database, not the address, whether a certificate was verified", () => {
    const page = read("app", "[lang]", "app", "operateur", "verifications", "page.tsx");
    expect(page).toMatch(/desk\.verified\(verifiee\)/);
    const actions = read("app", "[lang]", "app", "operateur", "verification-actions.ts");
    expect(actions).toMatch(/if \(result === "done"\) acknowledge\(lang, reference\)/);
  });
});
