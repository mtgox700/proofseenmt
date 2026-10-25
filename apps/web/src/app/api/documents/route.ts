import type { NextResponse } from "next/server";
import { createDocument, defaultDeps, listDocuments } from "./vault";

/*
 * The documents of an affair (GET ?kind=contract|quote|conversation|organisation|profile&id=...) and the opening of a
 * document with its first rendered version (POST). The rules are in vault.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  return listDocuments(request, defaultDeps());
}

export async function POST(request: Request): Promise<NextResponse> {
  return createDocument(request, defaultDeps());
}
