import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowOutcome } from "@proofseen/profiles";
import { missionUrl, profileUrl } from "@proofseen/hub";
import { logError } from "../lib/log";
import { throttled } from "./throttle";

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

/*
 * One announcement per page every five minutes at most. The key is shared by the whole site: a member saving the same
 * mission in a loop must not spend its quota and get the real announcements refused. The engines come back to a page
 * anyway, and the sitemaps carry the latest changes.
 */
const DEBOUNCE = { windowMs: 5 * 60_000, max: 1 };

const notify = (urlsFor: (base: string) => readonly string[]): void => {
  const key = indexNowKey();
  const base = configuredBase();
  if (key === null || base === null) return;
  const urlList = urlsFor(base);
  void throttled("indexnow", urlList[0] ?? base, DEBOUNCE, new Date())
    .then((skip) => (skip ? undefined : send(base, key, urlList)))
    .catch((error: unknown) => logError("indexnow: not sent", error));
};

const send = (base: string, key: string, urlList: readonly string[]): Promise<void> => {
  const body = { host: new URL(base).host, key, keyLocation: `${base}${KEY_PATH}`, urlList };
  return fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((response) => {
      const outcome = indexNowOutcome(response.status);
      if (!outcome.ok) logError("indexnow: rejected", undefined, new Date(), `http-${response.status}`);
    })
    .catch((error: unknown) => {
      logError("indexnow: not sent", error);
    });
};
