import { getDb, ReasonSchema, userDesk } from "@proofseen/db";
import { accountUsers } from "@/data/accounts";
import { hasDatabase } from "@/data/intake-sink";
import { throttled } from "@/data/throttle";
import { sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";
import { OPERATOR_ACTION_RULE, operatorOf } from "@/lib/operator-access";
import { session } from "@/lib/session";

/*
 * GDPR export of one account, for a support request (C19). Posted from the account page with the request as reason;
 * the export is logged before it is built. Anyone but an operator gets the 404 of an unknown address.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (): Response => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

/** Only a posted form exports: any other method answers like an unknown address, for everyone. */
export function GET(): Response {
  return notFound();
}

export async function POST(request: Request, { params }: { params: Promise<{ lang: string; id: string }> }): Promise<Response> {
  const person = operatorOf(await session());
  if (person === null || !hasDatabase() || person.email === "") return notFound();
  // A whole personal-data export: the posting page must say where it comes from, and be ours.
  if (request.headers.get("origin") === null || !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return notFound();
  const form = await request.formData().catch(() => null);
  const reason = ReasonSchema.safeParse(form?.get("reason") ?? "");
  if (!reason.success) return new Response("Reason required", { status: 422 });
  try {
    const db = getDb();
    const { userId, suspension } = await accountUsers(db).ensure({ clerkId: person.id, email: person.email, displayName: person.name });
    if (suspension !== null) return notFound();
    if (await throttled("operator:export", userId, OPERATOR_ACTION_RULE, new Date())) return new Response("Too many requests", { status: 429 });
    const exported = await userDesk(db, { role: "operator", userId }).exportFor(id, reason.data, new Date());
    if (exported === null) return notFound();
    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="proofseen-export-${id}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logError("operator export failed", error);
    return new Response("Server error", { status: 500 });
  }
}
