"use server";

import { redirect } from "next/navigation";
import { isUniqueViolation, organisations, OrganisationInputSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, currentOrganisation, langOf } from "@/lib/market";

/** A company account creates its company, once: the person becomes its owner. */

const CREATE_RULE = { windowMs: 24 * 60 * 60_000, max: 3 };

export async function createOrganisation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  // One company per account for now: a second creation would only scatter missions and conversations.
  if ((await currentOrganisation(market)) !== null) redirect(`/${lang}/app`);
  if (await throttled("organisation-create", market.actor.userId, CREATE_RULE, new Date())) redirect(`/${lang}/app?erreur=trop`);
  const siret = formData.get("siret");
  const input = OrganisationInputSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    siret: typeof siret === "string" && siret.trim() !== "" ? siret : null,
  });
  if (!input.success) redirect(`/${lang}/app?erreur=invalide`);
  // A SIRET belongs to one company only: a second account claiming it is told so, nothing else.
  const taken = await organisations(market.db)
    .create(market.actor, input.data)
    .then(() => false)
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) return true;
      throw error;
    });
  redirect(taken ? `/${lang}/app?erreur=siret` : `/${lang}/app`);
}
