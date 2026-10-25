import { NewQuoteInputSchema, NO_CONTACT, SCOPE_REQUIRED, type QuoteInput } from "@proofseen/db";
import { eurosToCents } from "@/lib/mission-form";

/*
 * The quote form (rate, days, object of the work, deliverables, last day to accept) read into the input of a NEW quote.
 * The object of the work is required (Code civil 1163); the deliverables stay optional, one per line. The problem is named
 * so the page can say what to fix: a generic "check the rate" would send the person to the wrong field.
 */

export type QuoteFormProblem = "invalid" | "scope_missing" | "scope_contact";

export type QuoteForm = { readonly ok: true; readonly data: QuoteInput } | { readonly ok: false; readonly problem: QuoteFormProblem };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");

export const quoteFromForm = (formData: FormData): QuoteForm => {
  const days = text(formData.get("days"));
  const scope = text(formData.get("scope"));
  const deliverables = text(formData.get("deliverables"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const validUntil = text(formData.get("validUntil"));
  const parsed = NewQuoteInputSchema.safeParse({
    dailyRateCents: eurosToCents(text(formData.get("rate"))),
    days: /^\d+$/.test(days) ? Number(days) : Number.NaN,
    billing: "fixed",
    // Absent when empty: the schema then says "required", not "too short".
    ...(scope === "" ? {} : { scope }),
    ...(deliverables.length === 0 ? {} : { deliverables }),
    ...(validUntil === "" ? {} : { validUntil }),
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues;
  if (issues.some((issue) => issue.message === SCOPE_REQUIRED)) return { ok: false, problem: "scope_missing" };
  if (issues.some((issue) => issue.message === NO_CONTACT)) return { ok: false, problem: "scope_contact" };
  return { ok: false, problem: "invalid" };
};
