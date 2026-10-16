import type { PendingPush, PushQueue } from "@proofseen/db";
import { pushMessage } from "../lib/push/payload";
import type { PushOutcome, PushSender } from "../lib/push/sender";

/*
 * Sends what waits in the push queue (C20), from the scheduled job. Bounded per run (a few batches), a few sends at a
 * time so one slow push service cannot hold the whole run. Each outcome goes back to the queue: delivered (the row
 * goes), gone (the subscription goes, 404 or 410), failed (retried later, then dropped).
 */

const BATCH = 100;
const MAX_BATCHES = 3;
const CONCURRENCY = 8;

export interface PushReport {
  readonly sent: number;
  readonly gone: number;
  readonly failed: number;
}

export interface PushDeliveryOptions {
  readonly queue: PushQueue;
  readonly sender: PushSender;
  readonly now: () => Date;
  readonly batch?: number;
  readonly maxBatches?: number;
}

const attempt = async (sender: PushSender, push: PendingPush): Promise<PushOutcome> => {
  try {
    return await sender.send(push.subscription, JSON.stringify(pushMessage(push)));
  } catch (error) {
    return { kind: "failed", error: error instanceof Error ? error.name : "unknown" };
  }
};

const settle = async (o: PushDeliveryOptions, push: PendingPush, outcome: PushOutcome): Promise<void> => {
  if (outcome.kind === "sent") await o.queue.markDelivered(push, o.now());
  else if (outcome.kind === "gone") await o.queue.markGone(push);
  else await o.queue.markFailed(push, o.now());
};

export const sendPushes = async (o: PushDeliveryOptions): Promise<PushReport> => {
  const counts = { sent: 0, gone: 0, failed: 0 };
  for (let round = 0; round < (o.maxBatches ?? MAX_BATCHES); round += 1) {
    const batch = await o.queue.claim(o.batch ?? BATCH, o.now());
    if (batch.length === 0) break;
    for (let start = 0; start < batch.length; start += CONCURRENCY) {
      const slice = batch.slice(start, start + CONCURRENCY);
      const outcomes = await Promise.all(slice.map((push) => attempt(o.sender, push)));
      for (const [index, push] of slice.entries()) {
        const outcome = outcomes[index] ?? { kind: "failed", error: "missing" };
        await settle(o, push, outcome);
        counts[outcome.kind] += 1;
      }
    }
  }
  return counts;
};
