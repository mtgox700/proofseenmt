"use server";

import { redirect } from "next/navigation";
import { proofDisputes, registryDesk, registryVerdict, vigilanceDesk, type RegistryAnswer } from "@proofseen/db";
import { lookUp } from "@/data/registry-lookup";
import { logError } from "@/lib/log";
import { field, OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/*
 * Verifications from the back office: URSSAF certificates (verified with the code the operator checked by hand, or
 * rejected with a reason), contested address proofs (withdrawn with a reason), and company registry checks re-run on
 * demand against the free public registry API.
 */

const backTo = (lang: string, flag: string, anchor = ""): never => redirect(`/${lang}/app/operateur/verifications?etat=${flag}${anchor}`);

export async function verifyVigilance(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "verifications");
  if (limited) backTo(lang, OUTCOME_FLAGS.too_many);
  const result = await vigilanceDesk(db, operator).verify(field(formData, "reference"), field(formData, "code"), new Date());
  backTo(lang, OUTCOME_FLAGS[result]);
}

export async function rejectVigilance(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "verifications");
  if (limited) backTo(lang, OUTCOME_FLAGS.too_many);
  const reason = reasonOf(formData);
  if (reason === null) return backTo(lang, OUTCOME_FLAGS.invalid);
  const result = await vigilanceDesk(db, operator).reject(field(formData, "reference"), reason, new Date());
  backTo(lang, OUTCOME_FLAGS[result]);
}

export async function revokeProof(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "verifications");
  if (limited) backTo(lang, OUTCOME_FLAGS.too_many, "#adresses");
  const reason = reasonOf(formData);
  if (reason === null) return backTo(lang, OUTCOME_FLAGS.invalid, "#adresses");
  const result = await proofDisputes(db, operator).revoke(field(formData, "ownedUrlId"), reason, new Date());
  backTo(lang, OUTCOME_FLAGS[result], "#adresses");
}

export async function recheckCompany(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "registry");
  const back = (flag: string): never => redirect(`/${lang}/app/operateur/verifications?registre=${flag}#entreprises`);
  if (limited) return back(OUTCOME_FLAGS.too_many);
  const desk = registryDesk(db, operator);
  const subject = await desk.subject(field(formData, "organisationId"));
  if (subject === null) return back(OUTCOME_FLAGS.absent);
  let answer: RegistryAnswer | null = null;
  try {
    answer = registryVerdict(subject.siret, subject.declaredName, await lookUp(subject.siret));
  } catch (error) {
    // Unreachable registry: nothing is concluded, the attempt is still logged.
    logError("operator registry check failed", error);
  }
  back(await desk.record(subject, answer, new Date()));
}
