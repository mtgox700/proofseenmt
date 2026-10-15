import { describe, expect, it } from "vitest";
import { profileEn } from "../src/i18n/market/profile-en";
import { profileFr } from "../src/i18n/market/profile-fr";

/*
 * The profile screen says what a pseudonymous page shows and what it never shows (wave-2 review, M3), in both
 * languages: the person decides between reference and name knowing what each one publishes.
 */

describe("what a pseudonymous profile shows", () => {
  it("lists what is shown and what is withheld, in French", () => {
    const text = profileFr.pseudonymousShows;
    for (const shown of ["rôles", "dates", "compétences"]) expect(text).toContain(shown);
    for (const withheld of ["nom", "photo", "entreprises", "écoles", "images", "liens"]) expect(text).toContain(withheld);
  });

  it("lists what is shown and what is withheld, in English", () => {
    const text = profileEn.pseudonymousShows;
    for (const shown of ["roles", "dates", "skills"]) expect(text).toContain(shown);
    for (const withheld of ["name", "photo", "companies", "schools", "images", "links"]) expect(text).toContain(withheld);
  });
});
