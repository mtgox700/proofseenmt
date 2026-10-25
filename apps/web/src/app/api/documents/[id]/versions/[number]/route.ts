import { downloadFallback } from "@/lib/vault/download-fallback";
import { defaultDeps, downloadVersion } from "../../../vault";

/**
 * The bytes of one version, as a download: never cached, never indexed, served only if they still match the recorded
 * fingerprint. A person who is not a party of the affair gets 404. A failed download opened by a person (a navigation,
 * not a script) goes back to the document's page, which says it in words, instead of showing raw JSON (L1-146).
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string; readonly number: string }>;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const { id, number } = await context.params;
  return downloadFallback(request, await downloadVersion(id, number, defaultDeps()), id, number);
}
