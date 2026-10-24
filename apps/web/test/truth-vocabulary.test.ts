import { describe, expect, it } from "vitest";
import { homeCopy } from "../src/content/home";
import { dictionary } from "../src/i18n";

/*
 * Today a mission is verified in two ways only: its client confirms it, or it is paid on Proofseen. No code checks a
 * document yet. The public texts of the storefront must not promise one: the method page alone may name the document
 * check, to say it is not offered (packages/profiles/test/entry.test.ts holds that page).
 */
const DOCUMENT_WORDS = /pi[eè]ces?\b|facture|invoice|\bdocuments?\b|attestation du client|client attestation/i;
const PUBLIC_SECTIONS = ["meta", "field", "footer"] as const;

describe("the storefront promises no document check", () => {
  it.each(["fr", "en"] as const)("%s: no public section of the home page speaks of a document being checked", (lang) => {
    const t = dictionary(lang) as unknown as Record<string, unknown>;
    for (const section of PUBLIC_SECTIONS) {
      const text = JSON.stringify(t[section] ?? "");
      expect(text, `${lang}.${section}`).not.toMatch(DOCUMENT_WORDS);
    }
  });

  it.each(["fr", "en"] as const)("%s: no scene of the home page v2 speaks of a document being checked", (lang) => {
    for (const [scene, copy] of Object.entries(homeCopy(lang))) expect(JSON.stringify(copy), `${lang}.home.${scene}`).not.toMatch(DOCUMENT_WORDS);
  });

  it.each(["fr", "en"] as const)("%s: the home page says a mission is verified only by its client or by its payment", (lang) => {
    const copy = homeCopy(lang);
    const ways = lang === "fr" ? [/confirm/i, /pay/i] : [/confirm/i, /paid|payment/i];
    for (const line of [copy.hero.lead, copy.verified.rows[0]?.by ?? "", copy.faq.items[0]?.a ?? ""]) for (const way of ways) expect(line, line).toMatch(way);
  });
});
