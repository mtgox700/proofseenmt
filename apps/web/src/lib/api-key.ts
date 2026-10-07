import type { NextResponse } from "next/server";
import { apiKeys, getDb, type ApiCaller } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { fail } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * Authentication for the read-only company API: `Authorization: Bearer psk_…`. No cookie and no session, so no CSRF
 * surface. Every request is limited per address before the key is even looked at, then per key.
 */

export type KeyCaller = { readonly kind: "company"; readonly caller: ApiCaller } | { readonly kind: "refused"; readonly response: NextResponse };

const PER_ADDRESS = { windowMs: 60 * 60_000, max: 2_000 };
const PER_KEY = { windowMs: 60 * 60_000, max: 600 };
const BEARER = /^Bearer (\S+)$/;

const lookup = async (key: string, now: Date): Promise<ApiCaller | null | "error"> => {
  try {
    return await apiKeys(getDb()).authenticate(key, now);
  } catch (error) {
    logError("api key check failed", error);
    return "error";
  }
};

export const keyCaller = async (request: Request): Promise<KeyCaller> => {
  if (!hasDatabase()) return { kind: "refused", response: fail("non-configuré") };
  const now = new Date();
  if (await throttled("api-v1-address", clientAddress(request) ?? "unknown", PER_ADDRESS, now)) return { kind: "refused", response: fail("trop de demandes") };
  const key = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  const caller = key === undefined ? null : await lookup(key, now);
  if (caller === "error") return { kind: "refused", response: fail("erreur serveur") };
  if (caller === null) return { kind: "refused", response: fail("clé invalide") };
  if (await throttled("api-v1-key", caller.keyId, PER_KEY, now)) return { kind: "refused", response: fail("trop de demandes") };
  return { kind: "company", caller };
};
