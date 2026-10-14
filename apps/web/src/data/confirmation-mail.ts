import type { ConfirmationMail } from "@proofseen/db";
import { renderConfirmationRequest, type SendResult, type Transport } from "@proofseen/notify";
import { confirmationToken, confirmationUrl } from "../lib/confirmation-secret";

/*
 * Sends the confirmation e-mails waiting for a client's contact. The queue is the request rows themselves (leased in
 * the database, so overlapping runs never send twice); the link's token is recomputed from the request id and the
 * server secret, never read from the database. A failure is retried later, then given up after five attempts.
 */

const BATCH = 50;

export interface ConfirmationMailReport {
  readonly sent: number;
  readonly failed: number;
}

export const sendConfirmationEmails = async (o: {
  readonly outbox: ConfirmationMail;
  readonly transport: Transport;
  readonly secret: string;
  readonly baseUrl: string;
  readonly now: () => Date;
}): Promise<ConfirmationMailReport> => {
  const batch = await o.outbox.claim(BATCH, o.now());
  let sent = 0;
  let failed = 0;
  for (const m of batch) {
    const link = confirmationUrl(o.baseUrl, m.lang, m.id, confirmationToken(o.secret, m.id));
    const email = renderConfirmationRequest({ lang: m.lang, freelancer: m.freelancer, role: m.role, clientName: m.clientName, startedOn: m.startedOn, endedOn: m.endedOn, expiresAt: m.expiresAt, link });
    let result: SendResult;
    try {
      result = await o.transport.send(m.to, email);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.name : "unknown" };
    }
    if (result.ok) {
      await o.outbox.markSent(m.id, o.now());
      sent += 1;
    } else {
      await o.outbox.markFailed(m.id, m.attempts, o.now());
      failed += 1;
    }
  }
  return { sent, failed };
};
