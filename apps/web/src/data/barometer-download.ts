import { hasDatabase } from "./intake-sink";
import { BAROMETER_CACHE_CONTROL } from "./barometer-cache";
import { logError } from "../lib/log";

/*
 * The barometer datasets (CSV, JSON) as downloads: open data under CC BY 4.0, readable from any origin, cached for the
 * same hour as the pages, named after the day they were computed.
 */

const TYPES = { csv: "text/csv; charset=utf-8", json: "application/json; charset=utf-8" } as const;

export const datasetResponse = async (name: string, format: keyof typeof TYPES, build: () => Promise<{ readonly body: string; readonly computedAt: Date }>): Promise<Response> => {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const { body, computedAt } = await build();
    return new Response(body, {
      headers: {
        "content-type": TYPES[format],
        "content-disposition": `inline; filename="proofseen-${name}-${computedAt.toISOString().slice(0, 10)}.${format}"`,
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff",
        "cache-control": BAROMETER_CACHE_CONTROL,
      },
    });
  } catch (error) {
    logError(`barometer dataset: ${name} not built`, error);
    return new Response("erreur serveur", { status: 500 });
  }
};
