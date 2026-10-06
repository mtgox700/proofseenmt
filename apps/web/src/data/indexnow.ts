import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowOutcome } from "@proofseen/profiles";
import { missionUrl, profileUrl } from "@proofseen/hub";

/*
 * Tells IndexNow (Bing, Yandex, Seznam… one notification shared between them) that a mission page appeared or went
 * away. A notification, not an instruction: nothing guarantees a crawl.
 *
 * Off unless both `INDEXNOW_KEY` and `PROOFSEEN_PUBLIC_URL` are set: a preview or a developer machine must never
 * announce its own addresses to the engines. Never awaited by the request that triggered it, never allowed to fail it.
 */

const TIMEOUT_MS = 5_000;
/** Where the key file is served (see `app/indexnow-key.txt/route.ts`). Any path on the host is valid for the protocol. */
export const KEY_PATH = "/indexnow-key.txt";

export const indexNowKey = (): string | null => {
  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  return INDEXNOW_KEY.test(key) ? key : null;
};

const configuredBase = (): string | null => {
  try {
    const raw = (process.env.PROOFSEEN_PUBLIC_URL ?? "").trim();
    return raw === "" ? null : new URL(raw).origin;
  } catch {
    return null;
  }
};

export const notifyMissionChanged = (missionId: string): void => {
  notify((base) => [missionUrl(base, "fr", missionId), missionUrl(base, "en", missionId), `${base}/sitemap-missions.xml`]);
};

export const notifyProfileChanged = (slug: string): void => {
  notify((base) => [profileUrl(base, "fr", slug), profileUrl(base, "en", slug), `${base}/sitemap-profiles.xml`]);
};

const notify = (urlsFor: (base: string) => readonly string[]): void => {
  const key = indexNowKey();
  const base = configuredBase();
  if (key === null || base === null) return;
  const body = { host: new URL(base).host, key, keyLocation: `${base}${KEY_PATH}`, urlList: urlsFor(base) };
  void fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((response) => {
      const outcome = indexNowOutcome(response.status);
      if (!outcome.ok) console.error("indexnow:", outcome.meaning);
    })
    .catch((error: unknown) => {
      console.error("indexnow: not sent", error instanceof Error ? error.name : "unknown");
    });
};
