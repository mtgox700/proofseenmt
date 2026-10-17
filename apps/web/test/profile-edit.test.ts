import { describe, expect, it } from "vitest";
import { editHref, editingOf, noticeHref } from "../src/lib/profile-notice";

/*
 * Editing a declared item in place (C21): the edit form opens from a plain link (`?modifier=<id>#section`), rendered by
 * the server. Only an item id or a language code is read back from the address; the page then matches it against the
 * person's own items, so another person's id opens nothing.
 */

const ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";

describe("profile edit addresses", () => {
  it("opens the edit form of one item at its section", () => {
    expect(editHref("fr", "experiences", ID)).toBe(`/fr/app/profil?modifier=${ID}#experiences`);
    expect(editHref("en", "langues", "en")).toBe("/en/app/profil?modifier=en#langues");
  });

  it("reads back an item id or a language code, nothing else", () => {
    expect(editingOf(ID)).toBe(ID);
    expect(editingOf("de")).toBe("de");
    expect(editingOf(undefined)).toBeNull();
    expect(editingOf("<script>")).toBeNull();
    expect(editingOf(`${ID}&avis=saved`)).toBeNull();
    expect(editingOf("DEU")).toBeNull();
  });

  it("keeps a refused edit form open, and drops anything that is not an id", () => {
    expect(noticeHref("fr", "formation", "invalid", ID)).toBe(`/fr/app/profil?section=formation&avis=invalid&modifier=${ID}#formation`);
    expect(noticeHref("fr", "formation", "saved", null)).toBe("/fr/app/profil?section=formation&avis=saved#formation");
    expect(noticeHref("fr", "formation", "contact", "javascript:alert(1)")).toBe("/fr/app/profil?section=formation&avis=contact#formation");
  });
});
