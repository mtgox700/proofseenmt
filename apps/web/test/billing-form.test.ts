import { describe, expect, it } from "vitest";
import { billingFromForm } from "../src/lib/billing-form";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const VALID = { legalName: "Camille Martin EI", siret: "552 100 554 00011", vatNumber: "fr40552100554", line1: "1 rue de Test", line2: "", postalCode: "69001", city: "Lyon", country: "fr", vatRateBp: "2000" };

describe("billing form", () => {
  it("turns a valid form into the repository's input", () => {
    const parsed = billingFromForm(form({ ...VALID, acceptInvoicingMandate: "on" }));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ siret: "55210055400011", vatNumber: "FR40552100554", vatRateBp: 2000, acceptInvoicingMandate: true, address: { country: "FR" } });
    expect(parsed.data?.address).not.toHaveProperty("line2");
  });

  it("reads an unchecked mandate as refused, and the franchise as a zero rate", () => {
    const parsed = billingFromForm(form({ ...VALID, vatRateBp: "0", vatNumber: "" }));
    expect(parsed.data).toMatchObject({ acceptInvoicingMandate: false, vatRateBp: 0, vatNumber: null });
  });

  it("lets the schema refuse what is wrong", () => {
    expect(billingFromForm(form({ ...VALID, siret: "123" })).success).toBe(false);
    expect(billingFromForm(form({ ...VALID, vatRateBp: "1900" })).success).toBe(false);
    expect(billingFromForm(form({ ...VALID, country: "France" })).success).toBe(false);
    expect(billingFromForm(form({ ...VALID, legalName: "Appelez le 06 12 34 56 78" })).success).toBe(false);
    expect(billingFromForm(form({ ...VALID, line1: "" })).success).toBe(false);
  });
});
