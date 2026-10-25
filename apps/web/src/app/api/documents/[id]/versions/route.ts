import type { NextResponse } from "next/server";
import { addDocumentVersion, defaultDeps } from "../../vault";

/** A new version of a document, rendered by the server from the affair's own data; the client sends no bytes. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  return addDocumentVersion(request, id, defaultDeps());
}
