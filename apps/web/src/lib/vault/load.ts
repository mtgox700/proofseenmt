import { documents, type Actor, type Db, type DocumentDetail, type FrozenVersion } from "@proofseen/db";
import { logError } from "@/lib/log";

/*
 * What the pages of the vault read, through the repository only (`documents(db)`: access is checked in its queries).
 * A failure to read is said as such (S6), never as an empty list; a person who is not a party gets null, which the page
 * turns into the 404 of a document that does not exist.
 */

export interface AffairDocument {
  readonly detail: DocumentDetail;
  /** The latest version was rendered with the review notice of its template (frozen with it). */
  readonly underReview: boolean;
}

/** Whether a version was issued with the notice « en cours de relecture »: unknown counts as yes, the cautious reading. */
export const issuedUnderReview = (frozen: FrozenVersion | null): boolean => {
  const notice = (frozen?.variables as { readonly reviewNotice?: unknown } | undefined)?.reviewNotice;
  return notice !== false;
};

export async function affairDocuments(db: Db, actor: Actor, contractId: string): Promise<readonly AffairDocument[] | null | "error"> {
  try {
    const repo = documents(db);
    const list = await repo.list(actor, { kind: "contract", id: contractId });
    if (list === null) return null;
    // A handful of documents per affair: one read each, for their strata (`list` gives the latest version only).
    const found = await Promise.all(
      [...list]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(async (summary) => {
          const detail = await repo.find(actor, summary.id);
          if (detail === null || detail.latest === null) return null;
          const frozen = await repo.frozen(actor, detail.id, detail.latest.number);
          return { detail, underReview: issuedUnderReview(frozen) };
        }),
    );
    return found.filter((entry): entry is AffairDocument => entry !== null);
  } catch (error) {
    logError("vault: affair documents could not be read", error);
    return "error";
  }
}

export interface LatestServiceVersion {
  readonly documentId: string;
  readonly number: number;
  readonly contentDigest: string;
}

/**
 * For the page « L'affaire »: how many documents the affair has (the tab « Documents (n) ») and the latest version of
 * its service agreement (the line of the panel « Signatures »). A read that fails gives an unknown count and no line.
 */
export async function affairSummary(db: Db, actor: Actor, contractId: string): Promise<{ readonly count: number | null; readonly latest: LatestServiceVersion | null }> {
  try {
    const list = await documents(db).list(actor, { kind: "contract", id: contractId });
    const service = list?.find((doc) => doc.type === "service_agreement" && doc.latest !== null) ?? null;
    const latest = service?.latest ?? null;
    return { count: list?.length ?? null, latest: service === null || latest === null ? null : { documentId: service.id, number: latest.number, contentDigest: latest.contentDigest } };
  } catch (error) {
    logError("vault: affair documents could not be counted", error);
    return { count: null, latest: null };
  }
}
