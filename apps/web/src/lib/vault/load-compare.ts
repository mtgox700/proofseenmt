import { defaultRegistry, type DocumentModel } from "@proofseen/documents";
import type { Actor, DocumentDetail, Documents, VersionSummary } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import type { VaultDictionary } from "@/i18n/market/vault-fr";
import { attribute, type Attribution, type ChainLink } from "./attribution";
import { choiceGroups, legendOf } from "./choices";
import { compareModels, type Comparison } from "./compare";
import { explainChanges, type Change, type Explanation } from "./explain";
import { previewVersion } from "./replay";
import { authorLabel } from "./versions";

/*
 * What the comparison page needs, read and computed on the server (storyboard L1.6, §4 E5): both versions recomputed
 * and verified (replay.ts: a text whose content fingerprint is not the PDF's is never compared), the clause by clause
 * comparison, « En bref », and who made each change, read along every version from the older to the newer one.
 * The frozen values never leave the server: only what the PDF itself says reaches the page.
 */

export type LoadedComparison =
  | {
      readonly kind: "ready";
      readonly older: { readonly version: VersionSummary; readonly model: DocumentModel };
      readonly newer: { readonly version: VersionSummary; readonly model: DocumentModel };
      readonly comparison: Comparison;
      readonly explanation: Explanation;
      readonly attributionOf: (change: Change) => Attribution | null;
    }
  | { readonly kind: "unavailable"; readonly code: string };

interface Frozen {
  readonly values: Readonly<Record<string, unknown>>;
  readonly optionalClauses: Readonly<Record<string, string>>;
}

const frozenValues = (variables: unknown): Frozen => {
  const v = (variables ?? {}) as { readonly values?: unknown; readonly optionalClauses?: unknown };
  return {
    values: typeof v.values === "object" && v.values !== null ? (v.values as Record<string, unknown>) : {},
    optionalClauses: typeof v.optionalClauses === "object" && v.optionalClauses !== null ? (v.optionalClauses as Record<string, string>) : {},
  };
};

export async function loadComparison(args: {
  readonly repo: Documents;
  readonly actor: Actor;
  readonly document: DocumentDetail;
  readonly from: number;
  readonly to: number;
  readonly lang: Lang;
  readonly t: VaultDictionary;
}): Promise<LoadedComparison> {
  const { repo, actor, document, from, to, lang, t } = args;
  const versions = [...document.versions].filter((v) => v.number >= from && v.number <= to).sort((a, b) => a.number - b.number);
  const frozen = await Promise.all(versions.map((version) => repo.frozen(actor, document.id, version.number)));
  const olderVersion = versions[0];
  const newerVersion = versions[versions.length - 1];
  const olderFrozen = frozen[0];
  const newerFrozen = frozen[frozen.length - 1];
  // Every version between the two is read: without one of them, the author of a change could not be told.
  if (olderVersion === undefined || newerVersion === undefined || olderFrozen == null || newerFrozen == null || frozen.some((entry) => entry === null)) return { kind: "unavailable", code: "frozen_missing" };
  const older = previewVersion({ ...olderFrozen, contentDigest: olderVersion.contentDigest });
  const newer = previewVersion({ ...newerFrozen, contentDigest: newerVersion.contentDigest });
  if (older.kind !== "ready") return { kind: "unavailable", code: older.code };
  if (newer.kind !== "ready") return { kind: "unavailable", code: newer.code };
  // Each version is read with its own template: labels, legends and clauses of the version that said them (L1-159).
  const template = defaultRegistry().find(newerFrozen.templateId, newer.model.templateVersion);
  const olderTemplate = defaultRegistry().find(olderFrozen.templateId, older.model.templateVersion);
  if (template === undefined || olderTemplate === undefined) return { kind: "unavailable", code: "template_unavailable" };
  const billing = frozenValues(newerFrozen.variables).values["contract.billing"];
  const asBilling = billing === "fixed" || billing === "monthly" ? billing : null;
  const groups = choiceGroups(template.decl, lang, t.prepare, asBilling);
  const olderGroups = choiceGroups(olderTemplate.decl, lang, t.prepare, asBilling);
  const comparison = compareModels(older.model, newer.model);
  const facts = (index: number, model: DocumentModel) => ({ number: versions[index]?.number ?? 0, templateVersion: model.templateVersion, ...frozenValues(frozen[index]?.variables), model });
  const explanation = explainChanges({ lang, template, older: facts(0, older.model), newer: facts(versions.length - 1, newer.model), comparison, t: t.compare, olderTemplate, legendOf: (name) => legendOf(groups, name) ?? legendOf(olderGroups, name) });
  const chain: ChainLink[] = versions.map((version, index) => ({ number: version.number, by: authorLabel(version, t.who), ...frozenValues(frozen[index]?.variables) }));
  return {
    kind: "ready",
    older: { version: olderVersion, model: older.model },
    newer: { version: newerVersion, model: newer.model },
    comparison,
    explanation,
    attributionOf: (change) => (change.key === null ? null : attribute(change.key, chain)),
  };
}
