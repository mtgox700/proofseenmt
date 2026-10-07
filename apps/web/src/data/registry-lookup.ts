import { registry, registryVerdict, type Db } from "@proofseen/db";
import { logError } from "../lib/log";

/*
 * Checks due SIRET numbers against the official company directory (public "Recherche d'entreprises" API, no key). A few
 * per scheduled run, one after the other, well under the API's rate limit. A failed call records nothing: the SIRET
 * stays due and is retried on the next run, it is never marked closed because the directory was unreachable.
 */

const ENDPOINT = "https://recherche-entreprises.api.gouv.fr/search";
const PER_RUN = 10;
const TIMEOUT_MS = 10_000;
const SPACING_MS = 250;

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const lookUp = async (siret: string, fetchImpl: typeof fetch = fetch): Promise<unknown> => {
  const response = await fetchImpl(`${ENDPOINT}?q=${encodeURIComponent(siret)}&per_page=1`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
  return response.json();
};

export const checkDueRegistry = async (db: Db, now: Date, fetchImpl: typeof fetch = fetch): Promise<{ readonly checked: number; readonly failed: number }> => {
  const due = await registry(db).due(now, PER_RUN);
  let checked = 0;
  let failed = 0;
  for (const [i, subject] of due.entries()) {
    if (i > 0) await pause(SPACING_MS);
    try {
      const verdict = registryVerdict(subject.siret, await lookUp(subject.siret, fetchImpl));
      if (verdict === null) {
        failed += 1;
        continue;
      }
      await registry(db).record(subject, verdict, now);
      checked += 1;
    } catch (error) {
      failed += 1;
      logError("registry: lookup failed", error);
    }
  }
  return { checked, failed };
};
