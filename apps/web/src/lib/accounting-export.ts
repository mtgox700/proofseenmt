import { NextResponse } from "next/server";
import { companyApi, getDb } from "@proofseen/db";
import { accountingCsv } from "@proofseen/invoicing";
import { fail } from "@/lib/api";
import { exportPeriod } from "@/lib/export-period";
import { logError } from "@/lib/log";

/** The accounting CSV of one company over `?from=YYYY-MM-DD&to=YYYY-MM-DD`, once the caller's right to read is settled. */
export const accountingExport = async (organisationId: string, request: Request): Promise<NextResponse> => {
  const query = new URL(request.url).searchParams;
  try {
    const period = exportPeriod(query);
    if (period === null) return fail("période invalide");
    const rows = await companyApi(getDb()).exportInvoices(organisationId, period.from, period.to);
    if (rows === "too_many") return fail("export trop volumineux");
    return new NextResponse(accountingCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="proofseen-factures-${query.get("from") ?? ""}-${query.get("to") ?? ""}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    logError("accounting export failed", error);
    return fail("erreur serveur");
  }
};
