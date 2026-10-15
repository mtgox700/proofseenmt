import { skillJson } from "@proofseen/hub";
import { skillBarometer } from "@/data/barometer-cache";
import { datasetResponse } from "@/data/barometer-download";
import { publicBaseUrl } from "@/lib/public-url";

/** The skills-in-demand barometer as a JSON dataset (CC BY 4.0), with its method, window and totals. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return datasetResponse("barometre-competences", "json", async () => {
    const b = await skillBarometer();
    return { body: skillJson(b, publicBaseUrl(request)), computedAt: b.computedAt };
  });
}
