import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { dealsEn } from "../src/i18n/market/deals-en";
import { dealsFr } from "../src/i18n/market/deals-fr";

/*
 * L1-144: a NEW quote states the object of the work, so the freelancer's form asks for it, as plain HTML (readable and
 * sendable without JavaScript): the object required, the deliverables one per line, the last day to accept. When the
 * action sends the form back with « objet manquant », the error is said at the head of the section and tied to the field.
 */

vi.mock("@/app/[lang]/app/messages/quote-actions", () => ({ sendQuote: vi.fn(), decideQuote: vi.fn(), createContract: vi.fn() }));
const { QuotesSection } = await import("../src/components/market/QuotesSection");

const render = (error: string | null, lang: "fr" | "en" = "fr") =>
  renderToStaticMarkup(
    createElement(QuotesSection, { lang, d: lang === "fr" ? dealsFr : dealsEn, conversationId: "00000000-0000-4000-8000-0000000000c1", side: "freelance", canCommit: true, open: true, quotes: [], contractOf: new Map(), error }),
  );

describe("the quote form of the freelancer (L1-144)", () => {
  it("asks for the object of the work, required, 6 000 characters at most, with its label and its hint", () => {
    const html = render(null);
    expect(html).toMatch(/<label for="quote-scope">Objet de la prestation<\/label><textarea id="quote-scope" name="scope" required="" maxLength="6000" rows="6" aria-describedby="quote-scope-hint">/);
    expect(html).toContain(dealsFr.quotes.scopeHint.replace(/'/g, "&#x27;"));
    expect(html).not.toContain('aria-invalid');
  });

  it("asks for the deliverables, one per line, and the last day to accept, both optional", () => {
    const html = render(null);
    expect(html).toMatch(/<textarea id="quote-deliverables" name="deliverables" rows="4"/);
    expect(html).not.toMatch(/name="deliverables"[^>]*required/);
    expect(html).toMatch(/<input id="quote-valid-until" type="date" min="\d{4}-\d{2}-\d{2}"[^>]*name="validUntil"/);
    expect(html).not.toMatch(/name="validUntil"[^>]*required/);
  });

  it("says a missing object at the head of the section and ties it to the field", () => {
    const html = render(dealsFr.quotes.errors.scope_missing);
    expect(html).toContain(`<p class="form-error" role="alert" id="quote-error">${dealsFr.quotes.errors.scope_missing.replace(/'/g, "&#x27;")}</p>`);
    expect(html).toMatch(/id="quote-scope"[^>]*aria-describedby="quote-scope-hint quote-error" aria-invalid="true"/);
  });

  it("does not mark the object for an error about something else", () => {
    expect(render(dealsFr.quotes.errors.invalid)).not.toContain("aria-invalid");
  });

  it("has the same fields in English", () => {
    const html = render(null, "en");
    expect(html).toContain("Object of the work");
    expect(html).toContain("Deliverables (optional)");
    expect(html).toContain("Valid until (optional)");
  });
});
