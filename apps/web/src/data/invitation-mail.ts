import type { InvitationMail } from "@proofseen/db";
import { renderInvitation, type SendResult, type Transport } from "@proofseen/notify";
import { invitationToken, invitationUrl } from "../lib/invitation-secret";

/*
 * Sends the invitation e-mails waiting in the queue (C23). The queue is the invitation rows themselves (leased in the
 * database, so overlapping runs never send twice); the link's token is recomputed from the invitation id and the
 * server secret, never read from the database. The same e-mail goes out whether the address has an account or not.
 * A failure is retried later, then given up after five attempts.
 */

const BATCH = 50;

export interface InvitationMailReport {
  readonly sent: number;
  readonly failed: number;
}

export const sendInvitationEmails = async (o: {
  readonly outbox: InvitationMail;
  readonly transport: Transport;
  readonly secret: string;
  readonly baseUrl: string;
  readonly now: () => Date;
}): Promise<InvitationMailReport> => {
  const batch = await o.outbox.claim(BATCH, o.now());
  let sent = 0;
  let failed = 0;
  for (const m of batch) {
    const link = invitationUrl(o.baseUrl, m.lang, m.id, invitationToken(o.secret, m.id));
    const email = renderInvitation({ lang: m.lang, kind: m.kind, inviter: m.inviter, message: m.message, expiresAt: m.expiresAt, link, reminder: m.reminder });
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
