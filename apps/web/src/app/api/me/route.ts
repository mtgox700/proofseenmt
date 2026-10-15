import type { NextResponse } from "next/server";
import { z } from "zod";
import { gdpr, getDb, storedFiles, users } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { deleteStored } from "@/data/uploads";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { deleteSignInAccount, session } from "@/lib/session";
import { logError } from "@/lib/log";

/*
 * The signed-in person's own data (GDPR): GET hands over everything the database holds on them as a JSON file,
 * DELETE erases their account.
 *
 * Erasure needs an explicit JSON confirmation: a cross-site form cannot send one. It is refused while a contract is in
 * progress or money is still held, because erasing one party would strand the other. The database goes first, then the
 * sign-in account, then the database once more: a request from another tab in between recreates an empty row from the
 * still-valid session (under a new id, found again by the sign-in id), and the second pass removes it. If the sign-in
 * deletion fails, a new attempt finishes the job. The uploaded files are read before each pass, so files stored from
 * that other tab go too; a file written in the instant between a read and its pass loses its row and is removed by the
 * scheduled sweep of orphan files (upload-sweeper.ts, run by the notifications cron).
 * Export and erasure have separate limits: downloading the file ten times must not lock the person out of erasure.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 10 };

const ConfirmSchema = z.object({ confirm: z.literal(true) });

export async function GET(): Promise<Response> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("gdpr-export", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  try {
    const exported = await gdpr(getDb()).exportUser(who.actor.userId, new Date());
    if (exported === null) return fail("introuvable");
    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="proofseen-export-${exported.exportedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logError("gdpr export failed", error);
    return fail("erreur serveur");
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("gdpr-erase", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  if (!ConfirmSchema.safeParse(await jsonBody(request)).success) return fail("requête invalide");
  const state = await session();
  if (state.kind !== "signed-in") return fail("non-connecté");
  try {
    // The uploaded files' rows leave with the account (cascade): their ids are read first, so their bytes go too.
    const fileIds = await storedFiles(getDb()).idsOfOwner(who.actor.userId);
    const erased = await gdpr(getDb()).eraseUser(who.actor.userId);
    if (erased === "in_progress") return fail("contrat en cours");
    await deleteStored(fileIds);
    await deleteSignInAccount(state.person.id);
    // The row recreated from another tab has a new id: it is found by the sign-in id, and its files are read before the
    // second pass, since that tab may already have stored some.
    const recreated = await users(getDb()).idOfSignIn(state.person.id);
    for (const userId of new Set([who.actor.userId, ...(recreated === null ? [] : [recreated])])) {
      const lateFileIds = await storedFiles(getDb()).idsOfOwner(userId);
      await gdpr(getDb()).eraseUser(userId);
      await deleteStored(lateFileIds);
    }
    return ok({ erased: true });
  } catch (error) {
    logError("gdpr erasure failed", error);
    return fail("erreur serveur");
  }
}
