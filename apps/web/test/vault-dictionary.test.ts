import { describe, expect, it } from "vitest";
import { vaultEn } from "../src/i18n/market/vault-en";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { vaultText } from "../src/lib/vault/dictionary";

/*
 * L1.6, T2: the texts of the vault. Every string the screens can show, functions called with example arguments, holds
 * the house rules: no em dash nor en dash, no emoji, and in French a narrow no-break space (never an ordinary one, never
 * U+00A0) before « : ; ! ? » and inside the guillemets.
 */

/** Every text of a dictionary: strings as they are, functions called with « 3 » for each argument. */
function texts(node: unknown, path = ""): { path: string; text: string }[] {
  if (typeof node === "string") return [{ path, text: node }];
  if (typeof node === "function") {
    const out = (node as (...a: unknown[]) => unknown)(...Array.from({ length: node.length }, () => "3"));
    return typeof out === "string" ? [{ path: `${path}()`, text: out }] : [];
  }
  if (node !== null && typeof node === "object") return Object.entries(node).flatMap(([key, value]) => texts(value, path === "" ? key : `${path}.${key}`));
  return [];
}

const keys = (node: unknown): string[] =>
  node !== null && typeof node === "object" && typeof node !== "function" ? Object.entries(node).flatMap(([k, v]) => [k, ...keys(v).map((s) => `${k}.${s}`)]) : [];

const NARROW = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0xa0);

describe("the texts of the vault (T2)", () => {
  it("has the same keys in both languages, and picks by the page's language", () => {
    expect(keys(vaultEn).sort()).toEqual(keys(vaultFr).sort());
    expect(vaultText("fr")).toBe(vaultFr);
    expect(vaultText("en")).toBe(vaultEn);
  });

  it.each([
    ["fr", vaultFr],
    ["en", vaultEn],
  ] as const)("%s: no em dash, no en dash, no emoji, in any text", (_, dictionary) => {
    const all = texts(dictionary);
    expect(all.length).toBeGreaterThan(150);
    for (const { path, text } of all) {
      expect(text, path).not.toMatch(/[–—]/);
      expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("writes French punctuation with the narrow no-break space, never an ordinary one nor U+00A0", () => {
    for (const { path, text } of texts(vaultFr)) {
      expect(text, path).not.toMatch(new RegExp(`[ ${NBSP}][:;!?»]|«[ ${NBSP}]`));
      // Every « : ; ! ? » that follows a word has its narrow space (a colon in a time such as 09:42 is not punctuation).
      for (const match of text.matchAll(/(\S)([;!?»]|:(?!\d))/g)) expect(match[1], `${path}: ${text}`).toBe(NARROW);
    }
  });

  it("says the exact sentences of the storyboard where a test can hold them", () => {
    expect(vaultFr.states.empty.title).toBe("Aucun document pour l'instant.");
    expect(vaultFr.card.deposited(3, "7F3A 91C2 0B4E D2A8")).toBe(`Version 3 déposée. Empreinte du contenu${NARROW}: 7F3A 91C2 0B4E D2A8.`);
    expect(vaultFr.compare.phrase.number("Délai de recette", "15 jours", "20 jours")).toBe(`Délai de recette${NARROW}: 15 jours devient 20 jours.`);
    expect(vaultFr.compare.distinct).toBe(`Deux empreintes différentes${NARROW}: ce sont deux documents distincts.`);
    // Never « Générer »: one prepares a contract, one does not generate it (storyboard §8).
    for (const { path, text } of texts(vaultFr)) expect(text, path).not.toMatch(/g[ée]n[ée]r/i);
  });
});
