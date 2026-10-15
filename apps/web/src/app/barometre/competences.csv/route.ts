import { skillCsv } from "@proofseen/hub";
import { skillBarometer } from "@/data/barometer-cache";
import { datasetResponse } from "@/data/barometer-download";

/** The skills-in-demand barometer as a CSV dataset (CC BY 4.0): nothing below the minimum count. */

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return datasetResponse("barometre-competences", "csv", async () => {
    const b = await skillBarometer();
    return { body: skillCsv(b), computedAt: b.computedAt };
  });
}
