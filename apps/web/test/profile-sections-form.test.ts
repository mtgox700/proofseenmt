import { describe, expect, it } from "vitest";
import { readNotice } from "../src/lib/profile-notice";
import { certificationFromForm, experienceFromForm, monthField, monthOf, yearOf } from "../src/lib/profile-sections-form";

/*
 * The section forms only translate what was typed; the repository decides what is valid. An unreadable value must
 * become something the repository refuses, never a silent default.
 */

const form = (entries: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("profile section forms", () => {
  it("reads a month from the month input and from a typed MM/YYYY", () => {
    expect(monthOf("2023-03")).toEqual(new Date("2023-03-01T00:00:00Z"));
    expect(monthOf("3/2023")).toEqual(new Date("2023-03-01T00:00:00Z"));
    expect(monthOf("")).toBeNull();
    expect(Number.isNaN(monthOf("2023-13")?.getTime())).toBe(true);
    expect(Number.isNaN(monthOf("mars 2023")?.getTime())).toBe(true);
    expect(monthField(new Date("2023-03-01T00:00:00Z"))).toBe("2023-03");
    expect(yearOf("2019")).toBe(2019);
    expect(yearOf("")).toBeNull();
    expect(yearOf("19")).toBeNaN();
  });

  it("turns an ongoing position into no end month, and empty optional fields into null", () => {
    const input = experienceFromForm(form({ title: " Lead ", company: "", startMonth: "2023-03", endMonth: "2024-01", current: "1", description: "", skills: "Spark, dbt, Spark", companyHidden: "1" }));
    expect(input).toEqual({ title: "Lead", company: null, companyHidden: true, startMonth: new Date("2023-03-01T00:00:00Z"), endMonth: null, description: null, skills: ["Spark", "dbt"] });
    expect(certificationFromForm(form({ name: "AWS", credentialUrl: "", year: "" }))).toMatchObject({ credentialUrl: null, year: null, issuer: null });
  });

  it("reads back only known notices and known sections", () => {
    expect(readNotice("photo", "uploaded")).toEqual({ anchor: "photo", code: "uploaded", ok: true });
    expect(readNotice("cv", "quota")).toEqual({ anchor: "cv", code: "quota", ok: false });
    expect(readNotice("photo", "<script>")).toBeNull();
    expect(readNotice("ailleurs", "saved")).toBeNull();
    expect(readNotice(undefined, undefined)).toBeNull();
  });
});
