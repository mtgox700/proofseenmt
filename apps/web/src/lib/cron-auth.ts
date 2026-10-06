import { timingSafeEqual } from "node:crypto";

/*
 * Machine-to-machine calls (the scheduler, an uptime monitor) prove themselves with `Authorization: Bearer
 * <CRON_SECRET>`. A secret shorter than 32 characters counts as absent: a guessable one would be worse than none.
 */

const MIN_SECRET_LENGTH = 32;

export const cronAuthorised = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
};
