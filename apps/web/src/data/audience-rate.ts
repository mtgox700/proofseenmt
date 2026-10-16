import { addressFromHeaders, throttled } from "./throttle";

/*
 * How often one address may make audience counting write to the database (wave-3 review, M4): each counted request is
 * an insert, and without this a script reloading a profile page would be a stream of writes. Past the rate, the
 * request is simply not counted; the page served is the same.
 */

export const AUDIENCE_RATE = { windowMs: 60_000, max: 30 } as const;
/** Without a known address (no proxy in front), every such caller shares one bucket: still limited. */
const UNKNOWN_ADDRESS = "unknown";

/** True when this request may still write audience counts. */
export const audienceWriteAllowed = async (headers: Pick<Headers, "get">, now: Date): Promise<boolean> =>
  !(await throttled("audience-write", addressFromHeaders(headers) ?? UNKNOWN_ADDRESS, AUDIENCE_RATE, now));
