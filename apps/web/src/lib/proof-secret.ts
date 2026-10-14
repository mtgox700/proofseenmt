import { createHmac } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@proofseen/profiles";

/*
 * The secret the possession tokens are derived from. PROOFSEEN_PROOF_SECRET when set (the CLI reads the same variable);
 * otherwise a key derived from PROOFSEEN_ACCESS_SECRET under its own label, so the access links and the proof tokens
 * never share a key. Changing the secret changes every token: proven addresses would fail their next recheck. Pick one
 * source and keep it.
 */

const DERIVATION_LABEL = "proofseen:possession-proof:v1";

type Env = Readonly<Record<string, string | undefined>>;

/** `null` when no usable secret is configured: proofs are then neither issued nor checked. */
export const proofSecret = (env: Env = process.env): string | null => {
  const own = env.PROOFSEEN_PROOF_SECRET ?? "";
  // A dedicated secret that is too short is refused outright, not silently replaced: the operator meant to set one.
  if (own !== "") return own.length >= MIN_SECRET_LENGTH ? own : null;
  const access = env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (access.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", access).update(DERIVATION_LABEL).digest("hex");
};
