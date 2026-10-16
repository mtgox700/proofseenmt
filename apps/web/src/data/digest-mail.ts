import type { MessageDigests } from "@proofseen/db";
import { renderDigest, type SendResult, type Transport } from "@proofseen/notify";

/*
 * Sends the daily summaries of unread messages (C15). The people due today are claimed in the database (one summary a
 * day at most, overlapping runs never take the same person, a suspended account is never taken). A failed send is not
 * retried: a summary is a convenience, the next one comes tomorrow, and an address that bounces is not hammered every
 * five minutes. Each summary carries a one-click unsubscribe link (`List-Unsubscribe`, wave-3 review, L12) when the
 * caller can sign one.
 */

const BATCH = 100;

export interface DigestReport {
  readonly sent: number;
  readonly failed: number;
}

export interface DigestRun {
  readonly digests: MessageDigests;
  readonly transport: Transport;
  readonly baseUrl: string;
  readonly now: () => Date;
  /** The signed unsubscribe link of one person, or `null` when none can be signed. */
  readonly unsubscribe?: (userId: string) => string | null;
}

const unsubscribeHeaders = (url: string | null): Readonly<Record<string, string>> | undefined =>
  url === null ? undefined : { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

export const sendDigests = async (o: DigestRun): Promise<DigestReport> => {
  const due = await o.digests.claimDue(o.now(), BATCH);
  let sent = 0;
  let failed = 0;
  for (const digest of due) {
    const rendered = renderDigest({ to: { lang: digest.to.lang, displayName: digest.to.displayName }, unread: digest.unread, threads: digest.threads }, o.baseUrl);
    const headers = unsubscribeHeaders(o.unsubscribe?.(digest.userId) ?? null);
    const email = headers === undefined ? rendered : { ...rendered, headers };
    let result: SendResult;
    try {
      result = await o.transport.send(digest.to.email, email);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.name : "unknown" };
    }
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
};
