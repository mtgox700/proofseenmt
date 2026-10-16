import { confirmationMail, getDb, messageDigests, missionAlerts, notifications, payments, retention, storedFiles, validationReminders, vigilance } from "@proofseen/db";
import { deliver, transportFromEnv } from "@proofseen/notify";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { sendConfirmationEmails } from "@/data/confirmation-mail";
import { sendDigests } from "@/data/digest-mail";
import { deleteStored } from "@/data/uploads";
import { checkDueRegistry } from "@/data/registry-lookup";
import { hasDatabase } from "@/data/intake-sink";
import { sweepOrphanUploads } from "@/data/upload-sweeper";
import { deliverPushes } from "@/data/web-push-sender";
import { confirmationSecret } from "@/lib/confirmation-secret";
import { cronAuthorised } from "@/lib/cron-auth";
import { logError } from "@/lib/log";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Periodic job, called by a scheduler with `Authorization: Bearer <CRON_SECRET>`: deletes what has outlived its
 * retention period (and uploaded files left on disk without their row, a bounded number per run), replays the saved mission alerts, retries escrow releases, then sends what is waiting in the
 * notification queue. Proven addresses are reread by their own call (/api/cron/proofs).
 *
 * Push notifications (C20) go out before the mail, whatever the mail transport: they only need the VAPID keys.
 *
 * Without a mail transport configured (RESEND_API_KEY and NOTIFY_FROM), alerts are still turned into queued
 * notifications but nothing is sent: they wait, they are not lost. Several runs at once are safe — each batch is
 * leased in the database.
 */

export const runtime = "nodejs";

const BATCH = 50;
const MAX_BATCHES = 4;
/** A message attachment still without its message after a day was never sent (C15): its row and file go. */
const ORPHAN_ATTACHMENT_MS = 24 * 60 * 60 * 1000;

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return json({ ok: false, error: "non autorisé" }, 401);
  if (!hasDatabase()) return json({ ok: false, error: "non-configuré" }, 503);
  const db = getDb();
  const now = () => new Date();
  try {
    // A failing purge must not stop escrow releases and mail: it is logged and the run goes on.
    const purged = await retention(db)
      .purge(now())
      .catch((error: unknown) => {
        logError("cron: retention purge failed", error);
        return null;
      });
    const orphanAttachments = await storedFiles(db)
      .purgeOrphanAttachments(new Date(now().getTime() - ORPHAN_ATTACHMENT_MS))
      .then(async (ids) => {
        await deleteStored(ids);
        return ids.length;
      })
      .catch((error: unknown) => {
        logError("cron: orphan attachments purge failed", error);
        return null;
      });
    const sweptUploads = await sweepOrphanUploads(db, now()).catch((error: unknown) => {
      logError("cron: uploads sweep failed", error);
      return null;
    });
    const queued = await missionAlerts(db).scan(now());
    // Paid work never approved: both parties are reminded and a person reviews the case. Nothing is released here.
    const overdue = await validationReminders(db).flagOverdue(now());
    const vigilanceReminders = await vigilance(db).remindExpiring(now());
    // SIRET numbers checked against the official directory; an unreachable directory only delays the check.
    const registryChecks = await checkDueRegistry(db, now()).catch((error: unknown) => {
      logError("cron: registry checks failed", error);
      return null;
    });
    // Proven addresses are reread by their own scheduled call (/api/cron/proofs): third-party sites, slow or hostile,
    // must never delay escrow releases or the mail outbox.
    // Escrow releases that could not go through at approval time (payout account not ready, provider down) are
    // retried here; each one is claimed in the database first, so overlapping runs never pay twice.
    let gateway;
    try {
      gateway = gatewayFromEnv(process.env);
    } catch {
      gateway = null;
    }
    const identity = proofseenIdentity();
    const releases = gateway !== null && identity !== null ? await payments(db).releaseDue(gateway, identity, now()) : null;

    // Pushes to subscribed devices (C20): a bounded number per run; a failing push service only delays them.
    const pushes = await deliverPushes(now).catch((error: unknown) => {
      logError("cron: push notifications failed", error);
      return null;
    });

    const transport = transportFromEnv(process.env);
    if (transport === null) return json({ ok: true, data: { purged, orphanAttachments, sweptUploads, queued, overdue, vigilanceReminders, registryChecks, releases, pushes, sent: 0, failed: 0, confirmationMails: null, digests: null, transport: "absent" } });

    const outbox = notifications(db);
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const batch = await outbox.claim(BATCH, now());
      if (batch.length === 0) break;
      const report = await deliver(batch, { transport, outbox, baseUrl: publicBaseUrl(request), now });
      sent += report.sent;
      failed += report.failed;
    }
    // Mission confirmation requests addressed to a client contact without an account: their link is recomputed from
    // the secret, so without it nothing is sent (the requests wait, then expire without publishing anything).
    const linkSecret = confirmationSecret();
    const confirmationMails =
      linkSecret === null
        ? null
        : await sendConfirmationEmails({ outbox: confirmationMail(db), transport, secret: linkSecret, baseUrl: publicBaseUrl(request), now }).catch((error: unknown) => {
            logError("cron: confirmation e-mails failed", error);
            return null;
          });
    // Daily summaries of unread messages, for those who asked (C15): one a day at most, from the morning on.
    const digests = await sendDigests({ digests: messageDigests(db), transport, baseUrl: publicBaseUrl(request), now }).catch((error: unknown) => {
      logError("cron: message digests failed", error);
      return null;
    });
    return json({ ok: true, data: { purged, orphanAttachments, sweptUploads, queued, overdue, vigilanceReminders, registryChecks, releases, pushes, sent, failed, confirmationMails, digests, transport: "resend" } });
  } catch (error) {
    logError("cron notifications: failed", error);
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
