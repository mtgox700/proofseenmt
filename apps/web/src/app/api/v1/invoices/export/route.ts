import type { NextResponse } from "next/server";
import { accountingExport } from "@/lib/accounting-export";
import { keyCaller } from "@/lib/api-key";

/** Read-only company API: the accounting CSV of the calling company's mission invoices over a period. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const who = await keyCaller(request);
  if (who.kind === "refused") return who.response;
  return accountingExport(who.caller.organisationId, request);
}
