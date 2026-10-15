import { rateCsv } from "@proofseen/hub";
import { rateBarometer } from "@/data/barometer-cache";
import { datasetResponse } from "@/data/barometer-download";

/** The day-rate barometer as a CSV dataset (CC BY 4.0): the same groups as the page, nothing below the minimum sample. */

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return datasetResponse("barometre-tjm", "csv", async () => {
    const b = await rateBarometer();
    return { body: rateCsv(b), computedAt: b.computedAt };
  });
}
