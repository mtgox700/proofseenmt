import type { MessageDigests } from "@proofseen/db";
import { renderDigest, type SendResult, type Transport } from "@proofseen/notify";

/*
 * Sends the daily summaries of unread messages (C15). The people due today are claimed in the database (one summary a
 * day at most, overlapping runs never take the same person). A failed send is not retried: a summary is a convenience,
 * the next one comes tomorrow, and an address that bounces is not hammered every five minutes.
 */

const BATCH = 100;

export interface DigestReport {
  readonly sent: number;
  readonly failed: number;
}

export const sendDigests = async (o: { readonly digests: MessageDigests; readonly transport: Transport; readonly baseUrl: string; readonly now: () => Date }): Promise<DigestReport> => {
  const due = await o.digests.claimDue(o.now(), BATCH);
  let sent = 0;
  let failed = 0;
  for (const digest of due) {
    const email = renderDigest({ to: { lang: digest.to.lang, displayName: digest.to.displayName }, unread: digest.unread, threads: digest.threads }, o.baseUrl);
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
