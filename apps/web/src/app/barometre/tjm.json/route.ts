import { rateJson } from "@proofseen/hub";
import { rateBarometer } from "@/data/barometer-cache";
import { datasetResponse } from "@/data/barometer-download";
import { publicBaseUrl } from "@/lib/public-url";

/** The day-rate barometer as a JSON dataset (CC BY 4.0), with its method, minimum sample and totals. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return datasetResponse("barometre-tjm", "json", async () => {
    const b = await rateBarometer();
    return { body: rateJson(b, publicBaseUrl(request)), computedAt: b.computedAt };
  });
}
