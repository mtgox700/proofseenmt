import { createHmac, timingSafeEqual } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@proofseen/profiles";

/*
 * One-click unsubscribe of the daily digest (wave-3 review, L12, RFC 8058). Each digest carries `List-Unsubscribe`
 * with a link signed for its recipient only, and `List-Unsubscribe-Post`: the mail client POSTs to it and the digest
 * is switched off, without signing in. The key is derived from PROOFSEEN_ACCESS_SECRET under its own label, like the
 * other keys of the site. The link can only switch the digest off: it reads nothing and changes nothing else.
 */

const DERIVATION_LABEL = "proofseen:digest-unsubscribe:v1";

type Env = Readonly<Record<string, string | undefined>>;

/** `null` without a usable secret: digests then go without the header (the settings page still turns them off). */
export const digestUnsubscribeSecret = (env: Env = process.env): string | null => {
  const access = env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (access.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", access).update(DERIVATION_LABEL).digest("hex");
};

/** The token of one person: 43 base64url characters, bound to that user id only. */
export const unsubscribeToken = (secret: string, userId: string): string => createHmac("sha256", secret).update(`digest-unsubscribe:${userId}`).digest("base64url");

/** Compares in constant time; any other shape is simply false. */
export const isUnsubscribeToken = (secret: string, userId: string, token: string): boolean => {
  const expected = Buffer.from(unsubscribeToken(secret, userId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

export const unsubscribeUrl = (baseUrl: string, userId: string, token: string): string =>
  `${baseUrl.replace(/\/$/, "")}/api/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
