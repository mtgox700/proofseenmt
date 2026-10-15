"use server";

import { redirect } from "next/navigation";
import { userDesk } from "@proofseen/db";
import { uuidOf } from "@/lib/market";
import { OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/* Suspend or restore an account, with a reason the person receives. An operator never acts in the person's name. */

const run = async (formData: FormData, suspend: boolean): Promise<void> => {
  const { lang, db, operator, limited } = await operatorAction(formData, "users");
  const userId = uuidOf(formData.get("userId"));
  if (userId === null) redirect(`/${lang}/app/operateur/utilisateurs?etat=${OUTCOME_FLAGS.absent}`);
  const back = `/${lang}/app/operateur/utilisateurs/${userId}?etat=`;
  if (limited) redirect(back + OUTCOME_FLAGS.too_many);
  const reason = reasonOf(formData);
  if (reason === null) redirect(back + OUTCOME_FLAGS.invalid);
  const desk = userDesk(db, operator);
  const result = suspend ? await desk.suspend(userId, reason, new Date()) : await desk.restore(userId, reason, new Date());
  redirect(back + OUTCOME_FLAGS[result]);
};

/** What the search form shows: nothing yet, too many searches, or the accounts found (dates as ISO strings). */
export type UserSearchState =
  | { readonly kind: "idle" }
  | { readonly kind: "too_many" }
  | { readonly kind: "hits"; readonly hits: readonly { readonly id: string; readonly email: string; readonly displayName: string; readonly reference: string | null; readonly createdAt: string; readonly suspended: boolean }[] };

/**
 * Searches by e-mail address or reference. A server action rather than a GET form: an address never lands in a URL,
 * a browser history or an access log.
 */
export async function searchUsers(_previous: UserSearchState, formData: FormData): Promise<UserSearchState> {
  const { db, operator, limited } = await operatorAction(formData, "user-search");
  if (limited) return { kind: "too_many" };
  const query = formData.get("q");
  const hits = await userDesk(db, operator).search(typeof query === "string" ? query : "");
  return { kind: "hits", hits: hits.map((h) => ({ id: h.id, email: h.email, displayName: h.displayName, reference: h.reference, createdAt: h.createdAt.toISOString(), suspended: h.suspendedAt !== null })) };
}

export async function suspendUser(formData: FormData): Promise<void> {
  await run(formData, true);
}

export async function restoreUser(formData: FormData): Promise<void> {
  await run(formData, false);
}
