import type { Identity } from "@proofseen/core";
import { readSealed, rescoreMasked } from "@proofseen/extract";
import { readJsonl, wavePaths, writeText } from "./files";
import { StoredDrawSchema, type RescoreRecord } from "./records";

export interface RescoreSummary {
  readonly rescored: number;
  readonly unavailable: number;
}

/** sim-extract: deterministic re-scoring of the sealed masked answers (within their 72 h life). */
export const rescoreWave = async (runsDir: string, waveId: string, identity: Identity, key: Buffer): Promise<RescoreSummary> => {
  const paths = wavePaths(runsDir, waveId);
  const draws = (await readJsonl(paths.draws, StoredDrawSchema)).filter((d) => d.status === "ok");
  const records: RescoreRecord[] = [];
  let unavailable = 0;
  for (const draw of draws) {
    try {
      const masked = await readSealed(paths.sealed, draw.id, key);
      records.push({ drawId: draw.id, ...rescoreMasked(masked, identity) });
    } catch {
      unavailable += 1; // purged (72 h) or unreadable
    }
  }
  await writeText(paths.rescore, records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : ""));
  return { rescored: records.length, unavailable };
};
