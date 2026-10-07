import { describe, expect, it } from "vitest";
import { profileFromForm } from "../src/lib/profile-form";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const VALID = { headline: "Data engineer Spark", summary: "Migrations vers dbt.", city: "Lyon", workMode: "hybrid", rate: "650", availability: "available", availableFrom: "", skills: "Spark, dbt" };

describe("profile form", () => {
  it("turns a valid form into the repository's input", () => {
    const parsed = profileFromForm(form(VALID));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ headline: "Data engineer Spark", dailyRateCents: 65_000, availability: "available", availableFrom: null, skills: ["Spark", "dbt"] });
  });

  it("reads the availability date only with « available from »", () => {
    const from = profileFromForm(form({ ...VALID, availability: "available_from", availableFrom: "2027-01-05" }));
    expect(from.data?.availableFrom?.toISOString()).toBe("2027-01-05T00:00:00.000Z");
    // A date left in the field after switching back to « available » is dropped, not refused.
    expect(profileFromForm(form({ ...VALID, availableFrom: "2027-01-05" })).data?.availableFrom).toBeNull();
    expect(profileFromForm(form({ ...VALID, availability: "available_from" })).success).toBe(false);
    expect(profileFromForm(form({ ...VALID, availability: "available_from", availableFrom: "05/01/2027" })).success).toBe(false);
  });

  it("lets empty optional fields be empty, and the schema refuse the rest", () => {
    expect(profileFromForm(form({ ...VALID, headline: "", summary: "", city: "", rate: "" })).data).toMatchObject({ headline: null, summary: null, city: null, dailyRateCents: null });
    expect(profileFromForm(form({ ...VALID, summary: "Appelez le 06 12 34 56 78" })).success).toBe(false);
    expect(profileFromForm(form({ ...VALID, workMode: "anywhere" })).success).toBe(false);
    expect(profileFromForm(form({ ...VALID, rate: "beaucoup" })).success).toBe(false);
  });
});
