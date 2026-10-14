import { createHmac } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@proofseen/profiles";

/*
 * Signed links of mission confirmations. The key is derived from PROOFSEEN_ACCESS_SECRET under its own label, like the
 * possession proofs (`proof-secret.ts`): the access links, the proof tokens and these links never share a key.
 *
 * A link's token is an HMAC of the request id: the database keeps only its SHA-256 (`@proofseen/db`), and the token is
 * recomputed here when the e-mail is (re)sent. Changing the secret makes every pending link invalid; the requests then
 * simply expire, nothing is published.
 */

const DERIVATION_LABEL = "proofseen:mission-confirmation:v1";

type Env = Readonly<Record<string, string | undefined>>;

/** `null` without a usable secret: no request by e-mail can then be made, and none is sent. */
export const confirmationSecret = (env: Env = process.env): string | null => {
  const access = env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (access.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", access).update(DERIVATION_LABEL).digest("hex");
};

/** The token of one request: 43 base64url characters, bound to that request id only. */
export const confirmationToken = (secret: string, requestId: string): string =>
  createHmac("sha256", secret).update(`mission-confirmation:${requestId}`).digest("base64url");

/** The address the contact opens. Opening it decides nothing: only the form on that page does. */
export const confirmationUrl = (baseUrl: string, lang: "fr" | "en", requestId: string, token: string): string =>
  `${baseUrl.replace(/\/$/, "")}/${lang}/confirmer-mission/${requestId}?t=${encodeURIComponent(token)}`;
