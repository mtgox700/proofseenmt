/*
 * Server log lines as JSON, one per event, so a log platform can count and alert on them. A line carries the event,
 * the error's class name and a time; never an error message, a request body or an identifier: a driver message can
 * hold a database host or a password, a provider message an e-mail address.
 */

const MAX_EVENT = 120;
/** A short code such as `http-429` or `key-not-valid`: letters and dashes, digits only as an HTTP status. */
const DETAIL = /^(?:http-[0-9]{3}|[a-z]+(?:-[a-z]+){0,5})$/;

export const logError = (event: string, error?: unknown, now: Date = new Date(), detail?: string): void => {
  const entry = {
    level: "error",
    event: event.replace(/[\r\n]+/g, " ").slice(0, MAX_EVENT),
    error: error instanceof Error ? error.name : "unknown",
    at: now.toISOString(),
    ...(detail !== undefined && DETAIL.test(detail) ? { detail } : {}),
  };
  console.error(JSON.stringify(entry));
};

/** A condition worth watching before it becomes an error (a volume filling up): same line, level "warn". */
export const logWarning = (event: string, now: Date = new Date()): void => {
  console.warn(JSON.stringify({ level: "warn", event: event.replace(/[\r\n]+/g, " ").slice(0, MAX_EVENT), at: now.toISOString() }));
};
