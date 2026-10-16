import { createHmac } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@proofseen/profiles";

/*
 * The key of the erasure tombstones (wave-3 review, L11): when a suspended account is erased, the database keeps an
 * HMAC of its normalised e-mail address under this key, so that the suspension comes back if the same address signs
 * up again. Derived from PROOFSEEN_ACCESS_SECRET under its own label, like the other keys of the site: the database
 * never holds it, so the table alone cannot be matched against a list of known addresses.
 *
 * Changing the secret makes the existing tombstones unmatchable: they then simply expire after three years.
 */

const DERIVATION_LABEL = "proofseen:erasure-tombstone:v1";

type Env = Readonly<Record<string, string | undefined>>;

/** `null` without a usable secret: erasure then leaves no tombstone, and sign-ups are not compared to any. */
export const erasureTombstoneKey = (env: Env = process.env): string | null => {
  const access = env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (access.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", access).update(DERIVATION_LABEL).digest("hex");
};
