"use server";

import { redirect } from "next/navigation";
import { contactReviews } from "@proofseen/db";
import { field, OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/* Review of first contacts from recent companies: let it through, or close the thread with a reason. */

export async function clearContact(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "contacts");
  const back = `/${lang}/app/operateur/contacts?etat=`;
  if (limited) redirect(back + OUTCOME_FLAGS.too_many);
  const result = await contactReviews(db, operator).clear(field(formData, "conversationId"), new Date());
  redirect(back + OUTCOME_FLAGS[result]);
}

export async function closeContact(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "contacts");
  const back = `/${lang}/app/operateur/contacts?etat=`;
  if (limited) redirect(back + OUTCOME_FLAGS.too_many);
  const reason = reasonOf(formData);
  if (reason === null) redirect(back + OUTCOME_FLAGS.invalid);
  const result = await contactReviews(db, operator).close(field(formData, "conversationId"), reason, new Date());
  redirect(back + OUTCOME_FLAGS[result]);
}
