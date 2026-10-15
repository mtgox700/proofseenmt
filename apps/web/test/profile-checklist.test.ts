import { describe, expect, it } from "vitest";
import { CHECKLIST_KEYS, MIN_SKILLS, MIN_SUMMARY_CHARS, OPTIONAL_KEYS, profileChecklist, type ChecklistInput, type ChecklistKey, type ChecklistProfile } from "../src/lib/profile-checklist";

const NOW = new Date("2026-10-14T10:00:00Z");

const COMPLETE: ChecklistProfile = {
  visibility: "pseudonymous",
  headline: "Data engineer Spark et dbt",
  summary: "x".repeat(MIN_SUMMARY_CHARS),
  skills: Array.from({ length: MIN_SKILLS }, (_, i) => `skill-${i}`),
  city: "Lyon",
  workMode: "hybrid",
  dailyRateCents: 65_000,
  availability: "available",
  availableFrom: null,
  verifiedUrls: 1,
};

const ALL_DONE: ChecklistInput = {
  lang: "fr",
  profile: COMPLETE,
  billing: { siret: "73282932000074", registry: { status: "active", checkedAt: NOW } },
  vigilance: { state: "valid", verified: true },
  sections: { hasPhoto: true, languages: 2, experiences: 3 },
  now: NOW,
};

const item = (input: ChecklistInput, key: ChecklistKey) => {
  const found = profileChecklist(input).items.find((i) => i.key === key);
  if (found === undefined) throw new Error(`no item ${key}`);
  return found;
};

const withProfile = (patch: Partial<ChecklistProfile>): ChecklistInput => ({ ...ALL_DONE, profile: { ...COMPLETE, ...patch } });

describe("profile checklist", () => {
  it("lists every fact once, in a stable order, with a link to where it is fixed", () => {
    const list = profileChecklist(ALL_DONE);
    expect(list.items.map((i) => i.key)).toEqual([...CHECKLIST_KEYS]);
    expect(list.missing).toBe(0);
    expect(list.items.every((i) => i.done && i.note === null)).toBe(true);
    expect(item(ALL_DONE, "headline").href).toBe("/fr/app/profil#headline");
    expect(item(ALL_DONE, "dailyRate").href).toBe("/fr/app/profil#rate");
    expect(item(ALL_DONE, "provenAddress").href).toBe("/fr/app/preuves");
    expect(item({ ...ALL_DONE, lang: "en" }, "siret").href).toBe("/en/app/facturation#siret");
    expect(item(ALL_DONE, "vigilance").href).toBe("/fr/app/facturation#vigilance-title");
  });

  it("groups what the page says apart from what proves it", () => {
    const groups = profileChecklist(ALL_DONE).items.map((i) => [i.key, i.group]);
    expect(groups.filter(([, g]) => g === "proof").map(([k]) => k)).toEqual(["provenAddress", "siret", "vigilance"]);
  });

  it("marks everything missing without a profile", () => {
    const list = profileChecklist({ ...ALL_DONE, profile: null });
    expect(list.missing).toBe(CHECKLIST_KEYS.length - OPTIONAL_KEYS.length);
    expect(list.items.every((i) => !i.done && i.note === null)).toBe(true);
  });

  it("counts a private profile as not published", () => {
    expect(item(withProfile({ visibility: "private" }), "published").done).toBe(false);
    expect(item(withProfile({ visibility: "named" }), "published").done).toBe(true);
  });

  it("needs a headline and a city that are not blank", () => {
    expect(item(withProfile({ headline: null }), "headline").done).toBe(false);
    expect(item(withProfile({ headline: "  " }), "headline").done).toBe(false);
    expect(item(withProfile({ city: null }), "city").done).toBe(false);
    expect(item(withProfile({ city: " " }), "city").done).toBe(false);
  });

  it("needs a summary long enough not to be thin, and says when it is too short", () => {
    expect(item(withProfile({ summary: null }), "summary")).toMatchObject({ done: false, note: null });
    expect(item(withProfile({ summary: "   " }), "summary")).toMatchObject({ done: false, note: null });
    expect(item(withProfile({ summary: "x".repeat(MIN_SUMMARY_CHARS - 1) }), "summary")).toMatchObject({ done: false, note: "too_short" });
    expect(item(withProfile({ summary: ` ${"x".repeat(MIN_SUMMARY_CHARS - 1)} ` }), "summary").note).toBe("too_short");
  });

  it("needs enough skills, and says when there are too few", () => {
    expect(item(withProfile({ skills: [] }), "skills")).toMatchObject({ done: false, note: null });
    expect(item(withProfile({ skills: ["Spark"] }), "skills")).toMatchObject({ done: false, note: "too_few" });
  });

  it("needs a daily rate", () => {
    expect(item(withProfile({ dailyRateCents: null }), "dailyRate").done).toBe(false);
    expect(item(withProfile({ dailyRateCents: 0 }), "dailyRate").done).toBe(true);
  });

  it("flags an availability date already gone, not today's or a future one", () => {
    expect(item(withProfile({ availability: "available_from", availableFrom: new Date("2026-10-13T00:00:00Z") }), "availability")).toMatchObject({ done: false, note: "date_passed" });
    expect(item(withProfile({ availability: "available_from", availableFrom: new Date("2026-10-14T00:00:00Z") }), "availability").done).toBe(true);
    expect(item(withProfile({ availability: "available_from", availableFrom: new Date("2027-01-05T00:00:00Z") }), "availability").done).toBe(true);
    expect(item(withProfile({ availability: "unavailable" }), "availability").done).toBe(true);
  });

  it("needs at least one proven address", () => {
    expect(item(withProfile({ verifiedUrls: 0 }), "provenAddress").done).toBe(false);
  });

  it("needs a SIRET found active in the registry", () => {
    expect(item({ ...ALL_DONE, billing: null }, "siret")).toMatchObject({ done: false, note: null });
    expect(item({ ...ALL_DONE, billing: { siret: null, registry: { status: null, checkedAt: null } } }, "siret")).toMatchObject({ done: false, note: null });
    expect(item({ ...ALL_DONE, billing: { siret: "73282932000074", registry: { status: null, checkedAt: null } } }, "siret")).toMatchObject({ done: false, note: "awaiting_check" });
    for (const status of ["ceased", "not_found", "mismatch"] as const) {
      expect(item({ ...ALL_DONE, billing: { siret: "73282932000074", registry: { status, checkedAt: NOW } } }, "siret")).toMatchObject({ done: false, note: "registry_problem" });
    }
  });

  it("needs a valid URSSAF certificate checked by an operator", () => {
    expect(item({ ...ALL_DONE, vigilance: null }, "vigilance")).toMatchObject({ done: false, note: null });
    expect(item({ ...ALL_DONE, vigilance: { state: "missing", verified: false } }, "vigilance")).toMatchObject({ done: false, note: null });
    expect(item({ ...ALL_DONE, vigilance: { state: "expired", verified: true } }, "vigilance")).toMatchObject({ done: false, note: "expired" });
    expect(item({ ...ALL_DONE, vigilance: { state: "valid", verified: false } }, "vigilance")).toMatchObject({ done: false, note: "awaiting_operator" });
  });

  it("needs at least one experience and one language; the photo is only recommended", () => {
    const bare = { ...ALL_DONE, sections: { hasPhoto: false, languages: 0, experiences: 0 } };
    expect(item(bare, "experience")).toMatchObject({ done: false, optional: false, href: "/fr/app/profil#experiences" });
    expect(item(bare, "languages")).toMatchObject({ done: false, optional: false, href: "/fr/app/profil#langues" });
    expect(item(bare, "photo")).toMatchObject({ done: false, optional: true, href: "/fr/app/profil#photo" });
    // The missing photo is shown, never counted.
    expect(profileChecklist(bare).missing).toBe(2);
    expect(profileChecklist({ ...ALL_DONE, sections: null }).missing).toBe(2);
  });

  it("counts the missing facts, nothing more", () => {
    const list = profileChecklist({ ...withProfile({ dailyRateCents: null, verifiedUrls: 0 }), vigilance: null });
    expect(list.missing).toBe(3);
    expect(Object.keys(list).sort()).toEqual(["items", "missing"]);
  });
});
