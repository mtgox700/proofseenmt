"use server";

import { redirect } from "next/navigation";
import { containsDirectContact, contractView, getDb } from "@proofseen/db";
import { vaultOpen } from "@/app/api/documents/vault";
import { deleteStored, writeStored } from "@/data/uploads";
import { throttled } from "@/data/throttle";
import { createDocumentRenderer } from "@/lib/document-renderer";
import { logError } from "@/lib/log";
import { actionMarket, langOf, uuidOf } from "@/lib/market";
import { choiceGroups, engineProblems, readChoices, type Problem } from "@/lib/vault/choices";
import { vaultText } from "@/lib/vault/dictionary";
import { drafts, type KeptDraft } from "@/lib/vault/drafts";
import { recordVersion, type RecordOutcome } from "@/lib/vault/record-version";

/*
 * « Préparer » (storyboard L1.6, §4 E2, T10): a plain form posted here, without JavaScript. The choices are read by the
 * template's declaration (fields whose condition does not hold are ignored, even if sent); a form with problems, or
 * refused by the engine, goes back to the form with its values (kept ten minutes on the server, never in the address);
 * a version recorded goes back to the tab with `?depose=n`, where its fingerprint inks (M1). Every other outcome is a
 * key of `?erreur=`, said in words by the page. The rules themselves are the vault's: access, state of the affair and
 * the version the person saw (`attendu`) are checked by the repository before and after the rendering.
 */

const WRITE_RULE = { windowMs: 60 * 60_000, max: 30 };
const TEMPLATE = "service-agreement";
const EXPECTED = /^[0-9]{1,6}$/;

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");

type EngineRefusal = KeptDraft["refusal"];
const refusalOf = (code: string): EngineRefusal =>
  code === "decision_pending" ? "monthly" : code === "source_expired" || code === "template_not_effective" ? "expired" : code === "invalid_variable" ? "invalid" : "other";

export async function prepareVersion(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const contractId = uuidOf(formData.get("contractId"));
  if (contractId === null) redirect(`/${lang}/app/contrats`);
  const tab = `/${lang}/app/contrats/${contractId}/documents`;
  const market = await actionMarket(lang);
  if (!vaultOpen(process.env)) redirect(tab);
  const now = new Date();
  const contract = await contractView(market.db).find(market.actor, contractId);
  if (contract === null) redirect(tab);
  const rawExpected = text(formData.get("attendu"));
  if (!EXPECTED.test(rawExpected)) redirect(`${tab}?erreur=invalide`);
  const expected = Number(rawExpected);
  const documentId = uuidOf(formData.get("documentId"));

  const engine = await import("@proofseen/documents");
  const template = engine.defaultRegistry().latest(TEMPLATE);
  if (template === undefined) redirect(`${tab}?erreur=moteur`);
  const groups = choiceGroups(template.decl, lang, vaultText(lang).prepare);
  const read = readChoices(groups, (name) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : null;
  });
  const reason = text(formData.get("reason")).slice(0, 300);
  const docLang = formData.get("docLang") === "en" ? "en" : "fr";
  const reasonProblems: Problem[] = reason !== "" && containsDirectContact(reason) ? [{ name: "reason", kind: "contact" }] : [];
  const values = { ...read.draft, ...(reason === "" ? {} : { reason }), ...(documentId === null ? { docLang } : {}) };

  const back = (draft: Omit<KeptDraft, "userId" | "contractId" | "values">): never => {
    const key = drafts().keep({ userId: market.actor.userId, contractId, values, ...draft }, now);
    redirect(`${tab}/preparer?brouillon=${key}#erreurs`);
  };
  if (await throttled("document-write", market.actor.userId, WRITE_RULE, now)) back({ problems: [], facts: [], refusal: null, message: "tooMany" });
  const problems = [...read.problems, ...reasonProblems];
  if (problems.length > 0) back({ problems, facts: [], refusal: null, message: null });

  let outcome: RecordOutcome;
  try {
    outcome = await recordVersion(
      market.actor,
      documentId === null ? { affair: { kind: "contract", id: contractId }, type: "service_agreement", lang: docLang } : { documentId },
      expected,
      reason === "" ? (expected === 0 ? "première version" : "nouvelle version") : reason,
      { ...read.inputs, optionalClauses: read.optionalClauses },
      { db: market.db, renderer: createDocumentRenderer({ db: getDb }), storage: { write: (key, bytes) => writeStored(key, bytes), remove: (keys) => deleteStored(keys) }, now: () => now },
    );
  } catch (error) {
    logError("vault: prepare failed", error);
    redirect(`${tab}?erreur=serveur`);
  }
  switch (outcome.kind) {
    case "recorded":
      return redirect(`${tab}?depose=${outcome.number}`);
    case "stale":
      return redirect(`${tab}?erreur=plus-recente&derniere=${outcome.latest}`);
    case "absent":
      return redirect(tab);
    case "refused":
      if (outcome.reason === "invalid") return back({ problems: [], facts: [], refusal: "invalid", message: null });
      return redirect(outcome.reason === "scope" ? tab : `${tab}?erreur=etat`);
    case "engine": {
      if (outcome.code === "missing_variable") {
        const split = engineProblems(groups, outcome.missing);
        const labels = split.facts.map((name) => (lang === "en" ? template.decl.variables[name]?.label.en : undefined) ?? template.decl.variables[name]?.label.fr ?? name);
        return back({ problems: split.fields, facts: labels, refusal: null, message: null });
      }
      if (outcome.code === "invalid_variable") {
        const split = engineProblems(groups, outcome.missing);
        // A text the engine refused after our checks holds contact details; anything else is a request we never build.
        if (split.facts.length === 0 && split.fields.length > 0) return back({ problems: split.fields.map((p) => ({ name: p.name, kind: p.kind === "text" ? "contact" : p.kind })), facts: [], refusal: null, message: null });
      }
      return back({ problems: [], facts: [], refusal: refusalOf(outcome.code), message: null });
    }
    case "unconfigured":
      return redirect(`${tab}?erreur=moteur`);
    case "invalid-version":
      return redirect(`${tab}?erreur=version`);
    case "server":
      return redirect(`${tab}?erreur=serveur`);
  }
}
