import { BillingIdentitySchema, type BillingIdentityInput } from "@proofseen/db";

/*
 * A billing identity form, as posted, turned into the repository's input. Empty optional fields become null (or are
 * left out for the second address line), the VAT rate is read from its select, the mandate from its checkbox. The
 * repository schema decides what is valid.
 */

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const orNull = (value: string): string | null => (value === "" ? null : value);

export const billingFromForm = (form: FormData): ReturnType<typeof BillingIdentitySchema.safeParse> => {
  const line2 = field(form, "line2");
  const input: BillingIdentityInput = {
    legalName: field(form, "legalName"),
    siret: orNull(field(form, "siret")),
    vatNumber: orNull(field(form, "vatNumber")),
    address: {
      line1: field(form, "line1"),
      ...(line2 === "" ? {} : { line2 }),
      postalCode: field(form, "postalCode"),
      city: field(form, "city"),
      country: field(form, "country").toUpperCase(),
    },
    vatRateBp: Number(field(form, "vatRateBp") || "0") as BillingIdentityInput["vatRateBp"],
    acceptInvoicingMandate: form.get("acceptInvoicingMandate") === "on",
  };
  return BillingIdentitySchema.safeParse(input);
};
