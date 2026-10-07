import { describe, expect, it } from "vitest";
import { centsToField, eurosToCents, missionFromForm, skillsOf } from "../src/lib/mission-form";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const VALID = { title: "Data engineer Spark", description: "Migration vers dbt, équipe de 4.", skills: "Spark, dbt, Spark ,  ", workMode: "remote", city: "", durationMonths: "3", rateMin: "600", rateMax: "750,50" };

describe("mission form", () => {
  it("reads euros the way people type them", () => {
    expect(eurosToCents("650")).toBe(65_000);
    expect(eurosToCents("650,5")).toBe(65_050);
    expect(eurosToCents("1 200 €")).toBe(120_000);
    expect(eurosToCents(`1${String.fromCharCode(0x202f)}200`)).toBe(120_000);
    expect(eurosToCents("")).toBeNull();
    expect(eurosToCents("12abc")).toBeNaN();
    expect(eurosToCents("1.234")).toBeNaN();
  });

  it("keeps each skill once, trimmed, at most thirty", () => {
    expect(skillsOf("Spark, dbt, Spark ,  ")).toEqual(["Spark", "dbt"]);
    expect(skillsOf(Array.from({ length: 40 }, (_, i) => `s${i}`).join(","))).toHaveLength(30);
  });

  it("turns a valid form into the repository's input", () => {
    const parsed = missionFromForm(form(VALID));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ skills: ["Spark", "dbt"], durationMonths: 3, dailyRateMinCents: 60_000, dailyRateMaxCents: 75_050, city: null, workMode: "remote" });
  });

  it("lets the schema refuse what is wrong", () => {
    expect(missionFromForm(form({ ...VALID, workMode: "onsite" })).success).toBe(false);
    expect(missionFromForm(form({ ...VALID, rateMin: "900" })).success).toBe(false);
    expect(missionFromForm(form({ ...VALID, durationMonths: "trois" })).success).toBe(false);
    expect(missionFromForm(form({ ...VALID, description: "Écrivez à jean@exemple.fr" })).success).toBe(false);
    expect(missionFromForm(form({ ...VALID, workMode: "anywhere" })).success).toBe(false);
  });

  it("shows amounts back so that they read the same", () => {
    expect(centsToField(65_000)).toBe("650");
    expect(eurosToCents(centsToField(75_050))).toBe(75_050);
    expect(centsToField(null)).toBe("");
  });
});
