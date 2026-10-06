import { renderEmail, type Email, type NotificationInput } from "./templates";

/*
 * Envoi d'un lot de notifications déjà prises en charge. Le transport (Resend en production) et la file (Postgres)
 * sont injectés : ce module ne sait ni écrire en base ni appeler un fournisseur, il décide seulement de l'ordre des
 * choses — rendre, envoyer, puis marquer envoyé ou échoué.
 */

export type SendResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface Transport {
  send(to: string, email: Email): Promise<SendResult>;
}

export interface Claimed extends NotificationInput {
  readonly id: string;
  readonly attempts: number;
  readonly to: NotificationInput["to"] & { readonly email: string };
}

export interface Outbox {
  markSent(id: string, now: Date): Promise<void>;
  markFailed(id: string, attempts: number, errorName: string, now: Date): Promise<void>;
}

export interface DeliveryReport {
  readonly sent: number;
  readonly failed: number;
}

export const deliver = async (batch: readonly Claimed[], o: { transport: Transport; outbox: Outbox; baseUrl: string; now: () => Date }): Promise<DeliveryReport> => {
  let sent = 0;
  let failed = 0;
  for (const n of batch) {
    let result: SendResult;
    try {
      result = await o.transport.send(n.to.email, renderEmail(n, o.baseUrl));
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.name : "unknown" };
    }
    if (result.ok) {
      await o.outbox.markSent(n.id, o.now());
      sent += 1;
    } else {
      await o.outbox.markFailed(n.id, n.attempts, result.error, o.now());
      failed += 1;
    }
  }
  return { sent, failed };
};
