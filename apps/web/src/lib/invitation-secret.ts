import { createHmac } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@proofseen/profiles";

/*
 * Signed links of invitations (C23). The key is derived from PROOFSEEN_ACCESS_SECRET under its own label, like the
 * mission confirmation links: the two never share a key, so a confirmation token can never open an invitation.
 *
 * A link's token is an HMAC of the invitation id: the database keeps only its SHA-256 (`@proofseen/db`), and the token
 * is recomputed here when the e-mail is (re)sent. Changing the secret makes every pending link invalid; the invitations
 * then simply expire.
 */

const DERIVATION_LABEL = "proofseen:invitation:v1";

type Env = Readonly<Record<string, string | undefined>>;

/** `null` without a usable secret: no invitation can then be made, and none is sent. */
export const invitationSecret = (env: Env = process.env): string | null => {
  const access = env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (access.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", access).update(DERIVATION_LABEL).digest("hex");
};

/** The token of one invitation: 43 base64url characters, bound to that invitation id only. */
export const invitationToken = (secret: string, invitationId: string): string => createHmac("sha256", secret).update(`invitation:${invitationId}`).digest("base64url");

/** The address the invited person opens. Opening it decides nothing: signing in, then the form on that page, does. */
export const invitationPath = (lang: "fr" | "en", invitationId: string, token: string): string => `/${lang}/app/invitations/${invitationId}?t=${encodeURIComponent(token)}`;

export const invitationUrl = (baseUrl: string, lang: "fr" | "en", invitationId: string, token: string): string => `${baseUrl.replace(/\/$/, "")}${invitationPath(lang, invitationId, token)}`;
