"use server";

import { redirect } from "next/navigation";
import { feedbackTriage, TriageInputSchema } from "@proofseen/db";
import { field, OUTCOME_FLAGS, operatorAction } from "@/lib/operator";

/* Sorting beta feedback: a status and an internal note. */

export async function triageFeedback(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "feedback");
  const back = `/${lang}/app/operateur/retours?etat=`;
  if (limited) redirect(back + OUTCOME_FLAGS.too_many);
  const input = TriageInputSchema.safeParse({ status: field(formData, "status"), note: field(formData, "note") });
  if (!input.success) redirect(back + OUTCOME_FLAGS.invalid);
  const result = await feedbackTriage(db, operator).triage(field(formData, "id"), { status: input.data.status, note: input.data.note ?? "" }, new Date());
  redirect(back + OUTCOME_FLAGS[result]);
}
