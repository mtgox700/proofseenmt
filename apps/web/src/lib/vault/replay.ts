import { replayVersion, type DocumentModel, type TemplateRegistry } from "@proofseen/documents";

/*
 * The HTML preview of a stored version (storyboard L1.6, §4 E4, T4): its model recomputed from the version's frozen
 * values, shown only if it is the PDF's text. Two checks, both on the content fingerprint the PDF prints:
 * 1. `replayVersion` (packages/documents) gives back exactly the stored content fingerprint, or a named refusal;
 * 2. that fingerprint equals the one the vault keeps in its own column for this version (L1-131), so the screen can
 *    never show a text whose fingerprint differs from the one drawn in its mark and printed in its footer.
 * Anything else is « unavailable »: the PDF stays the reference, and no approximate text is ever shown.
 */

/** A version as the vault keeps it: what the replay needs, and the content fingerprint of its own column. */
export interface StoredVersion {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly engine: string;
  readonly variables: unknown;
  readonly contentDigest: string;
}

export type Preview = { readonly kind: "ready"; readonly model: DocumentModel } | { readonly kind: "unavailable"; readonly code: string };

export function previewVersion(stored: StoredVersion, registry?: TemplateRegistry): Preview {
  const replayed = replayVersion(stored, registry === undefined ? {} : { registry });
  if (!replayed.ok) return { kind: "unavailable", code: replayed.error.code };
  if (replayed.value.contentDigest !== stored.contentDigest) return { kind: "unavailable", code: "column_mismatch" };
  return { kind: "ready", model: replayed.value };
}
