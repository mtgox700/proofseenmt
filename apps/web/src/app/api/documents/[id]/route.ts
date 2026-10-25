import type { NextResponse } from "next/server";
import { defaultDeps, showDocument } from "../vault";

/** One document with all its versions, for the parties of its affair; anyone else gets 404. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  return showDocument(id, defaultDeps());
}
