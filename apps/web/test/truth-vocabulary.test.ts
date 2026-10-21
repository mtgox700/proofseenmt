import { describe, expect, it } from "vitest";
import { dictionary } from "../src/i18n";

/*
 * Today a mission is verified in two ways only: its client confirms it, or it is paid on Proofseen. No code checks a
 * document yet. The public texts of the storefront must not promise one: the method page alone may name the document
 * check, to say it is not offered (packages/profiles/test/entry.test.ts holds that page).
 */
const DOCUMENT_WORDS = /pi[eè]ces?\b|facture|invoice|\bdocuments?\b|attestation du client|client attestation/i;
const PUBLIC_SECTIONS = ["meta", "hero", "journey", "method", "study", "deliverable", "piece", "companies", "exit", "charter", "faq", "footer"] as const;

describe("the storefront promises no document check", () => {
  it.each(["fr", "en"] as const)("%s: no public section of the home page speaks of a document being checked", (lang) => {
    const t = dictionary(lang) as unknown as Record<string, unknown>;
    for (const section of PUBLIC_SECTIONS) {
      const text = JSON.stringify(t[section] ?? "");
      expect(text, `${lang}.${section}`).not.toMatch(DOCUMENT_WORDS);
    }
  });
});
