import { getDb, invoices } from "@proofseen/db";
import { renderInvoice } from "@proofseen/invoicing";
import { caller } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * One invoice as a printable HTML document, with the French mandatory mentions. Visible to the parties allowed to
 * see it; anyone else gets 404.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const db = getDb();
    const invoice = await invoices(db).find(who.actor, id);
    if (invoice === null) return new Response("introuvable", { status: 404 });
    const contract = await db.contract.findUnique({ where: { id: invoice.contractId }, select: { days: true, dailyRateCents: true } });
    // Une mission se facture au jour ; une commission est une seule ligne.
    const perDay = invoice.kind === "mission" && contract !== null && contract.days * contract.dailyRateCents === invoice.netCents;
    const html = renderInvoice({
      ...invoice,
      quantity: perDay ? contract.days : 1,
      unitCents: perDay ? contract.dailyRateCents : invoice.netCents,
    });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  } catch (error) {
    logError("invoice render failed", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
