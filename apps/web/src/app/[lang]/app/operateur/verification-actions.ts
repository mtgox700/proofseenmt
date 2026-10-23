"use server";

import { redirect } from "next/navigation";
import { proofDisputes, registryDesk, registryVerdict, vigilanceDesk, type RegistryAnswer } from "@proofseen/db";
import { companyRows, type CompanySearchState } from "@/lib/company-rows";
import { lookUp } from "@/data/registry-lookup";
import { logError } from "@/lib/log";
import { field, OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/*
 * Verifications from the back office: URSSAF certificates (verified with the code the operator checked by hand, or
 * rejected with a reason), contested address proofs (withdrawn with a reason), and company registry checks re-run on
 * demand against the free public registry API. Companies are searched through a server action (wave-3 review, L14):
 * a name or a SIRET never lands in a URL, a browser history or an access log.
 */

/** Searches companies by name or SIRET. */
export async function searchCompanies(_previous: CompanySearchState, formData: FormData): Promise<CompanySearchState> {
  const { db, operator, limited } = await operatorAction(formData, "company-search");
  if (limited) return { kind: "too_many" };
  return { kind: "hits", rows: companyRows(await registryDesk(db, operator).list(field(formData, "q"))) };
}

const backTo = (lang: string, flag: string, anchor = ""): never => redirect(`/${lang}/app/operateur/verifications?etat=${flag}${anchor}`);

/*
 * After a verification, the page shows the acknowledgement: the address only names which certificate to read back, the
 * page reads its state and date from the database (`vigilanceDesk.verified`), so a forged address strikes nothing.
 */
const REFERENCE = /^FR-[A-Z2-9]{5,8}$/;
const acknowledge = (lang: string, reference: string): never =>
  REFERENCE.test(reference) ? redirect(`/${lang}/app/operateur/verifications?etat=${OUTCOME_FLAGS.done}&verifiee=${reference}#vigilance-title`) : backTo(lang, OUTCOME_FLAGS.done);

export async function verifyVigilance(formData: FormData): Promise<void> {
  const { lang, db, operator, limited } = await operatorAction(formData, "verifications");
  if (limited) backTo(lang, OUTCOME_FLAGS.too_many);
  const reference = field(formData, "reference").trim().toUpperCase();
  const result = await vigilanceDesk(db, operator).verify(reference, field(formData, "code"), new Date());
  if (result === "done") acknowledge(lang, reference);
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
