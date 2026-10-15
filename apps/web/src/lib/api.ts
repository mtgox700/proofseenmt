import { NextResponse } from "next/server";
import { BELOW_MINIMUM, getDb, NO_CONTACT, users, type Actor } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { session } from "./session";

/*
 * What every connected API route shares: one response envelope, one way to learn who is calling, one origin check.
 *
 * The envelope is `{ ok: true, data }` or `{ ok: false, error }`. Errors are short sentences meant for the person, never
 * an underlying message: a driver error can carry a host name, a stack can carry a path.
 */

export type ApiError = "non-configuré" | "non-connecté" | "introuvable" | "requête invalide" | "origine refusée" | "trop de demandes" | "en attente d'accord" | "conversation fermée" | "profil requis" | "profil privé" | "déjà candidat" | "mission verrouillée" | "coordonnées refusées" | "déjà accepté" | "déjà payé" | "identité de facturation requise" | "paiements non configurés" | "pas encore payé" | "montant trop faible" | "contrat en cours" | "contrat avec soi-même" | "entreprise fermée" | "attestation de vigilance requise" | "siret déjà utilisé" | "brief incompris" | "hors de la période du contrat" | "relevé déjà validé" | "plafond de jours dépassé" | "paiement par relevé mensuel" | "relevé modifié entre-temps" | "relevé invraisemblable" | "régie pas encore ouverte" | "clé invalide" | "trop de clés" | "période invalide" | "export trop volumineux" | "un seul administrateur" | "identité non concordante" | "déjà facturé" | "compte suspendu" | "erreur serveur";

const STATUS: Record<ApiError, number> = {
  "non-configuré": 503,
  "non-connecté": 401,
  introuvable: 404,
  "requête invalide": 400,
  "origine refusée": 403,
  "trop de demandes": 429,
  "en attente d'accord": 409,
  "conversation fermée": 409,
  "profil requis": 409,
  "déjà candidat": 409,
  "profil privé": 409,
  "mission verrouillée": 409,
  "coordonnées refusées": 422,
  "déjà accepté": 409,
  "déjà payé": 409,
  "identité de facturation requise": 422,
  "paiements non configurés": 503,
  "pas encore payé": 409,
  "montant trop faible": 422,
  "contrat en cours": 409,
  "contrat avec soi-même": 409,
  "entreprise fermée": 409,
  "attestation de vigilance requise": 422,
  "siret déjà utilisé": 409,
  "brief incompris": 422,
  "hors de la période du contrat": 422,
  "relevé déjà validé": 409,
  "plafond de jours dépassé": 409,
  "paiement par relevé mensuel": 409,
  "relevé modifié entre-temps": 409,
  "relevé invraisemblable": 422,
  "régie pas encore ouverte": 409,
  "clé invalide": 401,
  "trop de clés": 409,
  "période invalide": 422,
  "export trop volumineux": 422,
  "un seul administrateur": 409,
  "identité non concordante": 422,
  "déjà facturé": 409,
  "compte suspendu": 403,
  "erreur serveur": 500,
};

export const ok = <T>(data: T, status = 200): NextResponse => NextResponse.json({ ok: true, data }, { status });

export const fail = (error: ApiError): NextResponse => NextResponse.json({ ok: false, error }, { status: STATUS[error] });

/** A body that failed validation: a refusal the person can act on gets its own answer, so they know why. */
export const invalid = (issues: readonly { readonly message: string }[]): NextResponse => {
  if (issues.some((issue) => issue.message === NO_CONTACT)) return fail("coordonnées refusées");
  if (issues.some((issue) => issue.message === BELOW_MINIMUM)) return fail("montant trop faible");
  return fail("requête invalide");
};

/*
 * Cross-site request forgery: the Clerk session cookie is sent with any same-site request, so a write must prove it
 * comes from our own pages. Browsers always send `Origin` on a cross-origin POST; when it is present it must match.
 */
export const sameOrigin = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
};

export type Caller = { readonly kind: "actor"; readonly actor: Actor } | { readonly kind: "refused"; readonly response: NextResponse };

/** The signed-in person as a database actor, their row created on first use; or the response to send instead. */
/**
 * `allowSuspended`: only for the person's own GDPR rights (export, erasure), which a suspension never takes away.
 */
export const caller = async (options: { readonly allowSuspended?: boolean } = {}): Promise<Caller> => {
  if (!hasDatabase()) return { kind: "refused", response: fail("non-configuré") };
  const state = await session();
  if (state.kind === "unconfigured") return { kind: "refused", response: fail("non-configuré") };
  if (state.kind === "signed-out" || state.person.email === "") return { kind: "refused", response: fail("non-connecté") };
  const { userId, suspension } = await users(getDb()).ensure({ clerkId: state.person.id, email: state.person.email, displayName: state.person.name });
  // A suspended account (C19) keeps no access to the connected API either.
  if (suspension !== null && options.allowSuspended !== true) return { kind: "refused", response: fail("compte suspendu") };
  return { kind: "actor", actor: { userId } };
};

const MAX_JSON_BYTES = 32_768;

/*
 * The JSON body, or `null` when it is unreadable or larger than `maxBytes`. The body is read as a stream and abandoned
 * as soon as it passes the cap: a declared length can be absent or false, and buffering first would let one request
 * hold megabytes of memory.
 */
export const readJson = async (request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> => {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (request.body === null) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
};

/** Like `readJson`, but only for a request that says it carries JSON: a cross-site form cannot set that header. */
export const jsonBody = async (request: Request): Promise<unknown> =>
  (request.headers.get("content-type") ?? "").startsWith("application/json") ? readJson(request) : null;
