import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { ProofMethod } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Adresses prouvées : les URL qu'un freelance déclare, puis prouve posséder. Une mesure ne compte une citation que si
 * le moteur cite l'une d'elles ; une adresse seulement déclarée ne compte pour rien.
 *
 * Le contrôle d'accès est dans les requêtes : chaque lecture et chaque écriture passent par le profil de l'acteur. Un
 * identifiant qui n'est pas à lui donne `null` ou `not_found`, jamais les données d'une autre personne, et jamais un
 * indice sur leur existence.
 *
 * Ce dépôt ne va rien lire sur le réseau : il enregistre ce que la vérification (`@proofseen/profiles`) a constaté.
 */

export const MAX_OWNED_URLS = 10;
export const MAX_OWNED_URL_LENGTH = 300;
/** Une preuve se relit tous les trente jours : un domaine change de mains, un fichier disparaît. */
export const RECHECK_AFTER_DAYS = 30;
/** Après un échec, on retente le lendemain plutôt qu'au passage suivant : une panne d'une heure n'use pas la grâce. */
export const RETRY_AFTER_HOURS = 24;
/** Durée pendant laquelle une preuve qui ne se relit plus tient encore, le temps qu'une panne passe ou soit réparée. */
export const PROOF_GRACE_DAYS = 7;
/** Relectures au plus par passage planifié : chacune émet jusqu'à trois requêtes vers un site tiers. */
export const RECHECK_BATCH = 20;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type AutomaticProofMethod = Exclude<ProofMethod, "profile_token">;

/** Nom de domaine public : au moins deux étiquettes, la dernière commence par une lettre (ce qui écarte les IPv4). */
const PUBLIC_HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Suffixes qui ne désignent jamais un site public : réseau local, noms réservés aux essais et à la documentation. */
const PRIVATE_SUFFIXES = ["localhost", "local", "internal", "intranet", "lan", "home.arpa", "corp", "test", "example", "invalid"];

const isPrivateHost = (host: string): boolean => PRIVATE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

const OwnedUrlTextSchema = z.string().trim().min(1).max(MAX_OWNED_URL_LENGTH);

/**
 * L'adresse telle qu'elle est gardée, et sa clé de comparaison. Https seulement, nom de domaine public, sans port ni
 * identifiants ; la requête et l'ancre sont retirées (une preuve porte sur une page, pas sur un état de page). La clé
 * ignore `www.`, la casse du chemin et la barre finale : `/a` et `/A/` sont la même adresse pour l'unicité.
 * `null` pour tout ce qui ne se prouve pas.
 */
export const normaliseOwnedUrl = (raw: string): { readonly url: string; readonly urlKey: string } | null => {
  const text = OwnedUrlTextSchema.safeParse(raw);
  if (!text.success) return null;
  let parsed: URL;
  try {
    parsed = new URL(text.data);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.port !== "") return null;
  const host = parsed.hostname.toLowerCase().replace(/[.]$/, "");
  if (!PUBLIC_HOSTNAME.test(host) || isPrivateHost(host)) return null;
  const url = `https://${host}${parsed.pathname}`;
  const urlKey = `https://${host.replace(/^www[.]/, "")}${parsed.pathname.replace(/[/]+$/, "").toLowerCase()}`;
  return url.length > MAX_OWNED_URL_LENGTH ? null : { url, urlKey };
};

export interface OwnedUrlRecord {
  readonly id: string;
  readonly profileId: string;
  readonly url: string;
  /** Pour une adresse en attente, la méthode prévue ; pour une adresse prouvée, celle qui a réussi. */
  readonly proofMethod: ProofMethod;
  readonly verifiedAt: Date | null;
  readonly checkedAt: Date | null;
  /** Non nul quand la preuve ne se relit plus : elle tient jusqu'à `failedAt + PROOF_GRACE_DAYS`. */
  readonly failedAt: Date | null;
  readonly createdAt: Date;
}

export type AddOwnedUrlResult =
  | { readonly kind: "added"; readonly record: OwnedUrlRecord }
  | { readonly kind: "invalid" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "limit" }
  | { readonly kind: "no_profile" };

export type MarkVerifiedResult =
  | { readonly kind: "verified"; readonly record: OwnedUrlRecord }
  | { readonly kind: "not_found" }
  | { readonly kind: "manual_only" }
  | { readonly kind: "already_proven_elsewhere" };

/** Une preuve à relire : de quoi refaire le jeton (profil, adresse), rien de plus. */
export interface DueProof {
  readonly id: string;
  readonly profileId: string;
  readonly url: string;
}

export type RecheckResult = "confirmed" | "grace" | "revoked";

export interface OwnedUrls {
  /** `manual` : plateforme jamais interrogée (LinkedIn, Malt) ; l'adresse est gardée comme lien déclaré. */
  add(actor: Actor, raw: string, options: { readonly manual: boolean }): Promise<AddOwnedUrlResult>;
  list(actor: Actor): Promise<readonly OwnedUrlRecord[]>;
  get(actor: Actor, id: string): Promise<OwnedUrlRecord | null>;
  remove(actor: Actor, id: string): Promise<boolean>;
  /** Enregistre une preuve constatée par la personne elle-même ; une preuve manuelle ne s'auto-certifie pas. */
  markVerified(actor: Actor, id: string, method: AutomaticProofMethod, now: Date): Promise<MarkVerifiedResult>;
  /** Les preuves à relire, les plus anciennement relues d'abord. Jamais une preuve manuelle. */
  dueForRecheck(now: Date, limit?: number): Promise<readonly DueProof[]>;
  /** Résultat d'une relecture : la méthode qui a tenu, ou `null` si aucune. `null` en retour si l'adresse a disparu. */
  recordRecheck(id: string, method: AutomaticProofMethod | null, now: Date): Promise<RecheckResult | null>;
}

const Uuid = z.uuid();

const SELECT = { id: true, profileId: true, url: true, proofMethod: true, verifiedAt: true, checkedAt: true, failedAt: true, createdAt: true } as const;

const mine = (actor: Actor, id: string) => ({ id, profile: { userId: actor.userId } });

export const ownedUrls = (db: Db): OwnedUrls => ({
  async add(actor, raw, { manual }) {
    const normalised = normaliseOwnedUrl(raw);
    if (normalised === null) return { kind: "invalid" };
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (profile === null) return { kind: "no_profile" };
    if ((await db.ownedUrl.count({ where: { profileId: profile.id } })) >= MAX_OWNED_URLS) return { kind: "limit" };
    try {
      const record = await db.ownedUrl.create({
        // La méthode d'une adresse en attente n'est qu'une prévision : celle qui réussira la remplacera.
        data: { profileId: profile.id, ...normalised, proofMethod: manual ? "profile_token" : "well_known_file" },
        select: SELECT,
      });
      return { kind: "added", record };
    } catch (error) {
      if (isUniqueViolation(error)) return { kind: "duplicate" };
      throw error;
    }
  },

  async list(actor) {
    return db.ownedUrl.findMany({ where: { profile: { userId: actor.userId } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: SELECT });
  },

  async get(actor, id) {
    if (!Uuid.safeParse(id).success) return null;
    return db.ownedUrl.findFirst({ where: mine(actor, id), select: SELECT });
  },

  async remove(actor, id) {
    if (!Uuid.safeParse(id).success) return false;
    const { count } = await db.ownedUrl.deleteMany({ where: mine(actor, id) });
    return count === 1;
  },

  async markVerified(actor, id, method, now) {
    if (!Uuid.safeParse(id).success) return { kind: "not_found" };
    const row = await db.ownedUrl.findFirst({ where: mine(actor, id), select: { id: true, profileId: true, urlKey: true, proofMethod: true, verifiedAt: true } });
    if (row === null) return { kind: "not_found" };
    if (row.proofMethod === "profile_token") return { kind: "manual_only" };
    const taken = await db.ownedUrl.findFirst({ where: { urlKey: row.urlKey, verifiedAt: { not: null }, profileId: { not: row.profileId } }, select: { id: true } });
    if (taken !== null) return { kind: "already_proven_elsewhere" };
    try {
      // Une adresse déjà prouvée garde sa date de première preuve ; la relecture, elle, repart de maintenant.
      const record = await db.ownedUrl.update({
        where: { id: row.id },
        data: { verifiedAt: row.verifiedAt ?? now, proofMethod: method, checkedAt: now, failedAt: null },
        select: SELECT,
      });
      return { kind: "verified", record };
    } catch (error) {
      // Deux profils qui prouvent la même adresse au même instant : l'index partiel tranche, le second l'apprend ici.
      if (isUniqueViolation(error)) return { kind: "already_proven_elsewhere" };
      throw error;
    }
  },

  async dueForRecheck(now, limit = RECHECK_BATCH) {
    const stale = new Date(now.getTime() - RECHECK_AFTER_DAYS * DAY_MS);
    const retry = new Date(now.getTime() - RETRY_AFTER_HOURS * HOUR_MS);
    return db.ownedUrl.findMany({
      where: {
        verifiedAt: { not: null },
        proofMethod: { not: "profile_token" },
        OR: [
          { failedAt: null, checkedAt: { lt: stale } },
          { failedAt: null, checkedAt: null, verifiedAt: { lt: stale } },
          { failedAt: { not: null }, checkedAt: { lt: retry } },
        ],
      },
      orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: Math.max(1, Math.min(limit, RECHECK_BATCH)),
      select: { id: true, profileId: true, url: true },
    });
  },

  async recordRecheck(id, method, now) {
    const row = await db.ownedUrl.findUnique({ where: { id }, select: { verifiedAt: true, failedAt: true, proofMethod: true } });
    if (row === null || row.verifiedAt === null || row.proofMethod === "profile_token") return null;
    // `updateMany` sur l'identifiant : une adresse retirée entre la lecture et l'écriture ne fait pas échouer le passage.
    if (method !== null) {
      await db.ownedUrl.updateMany({ where: { id }, data: { checkedAt: now, failedAt: null, proofMethod: method } });
      return "confirmed";
    }
    const since = row.failedAt ?? now;
    if (now.getTime() - since.getTime() >= PROOF_GRACE_DAYS * DAY_MS) {
      // La grâce est épuisée : l'adresse redevient une simple déclaration, et une autre personne peut la prouver.
      await db.ownedUrl.updateMany({ where: { id }, data: { verifiedAt: null, failedAt: null, checkedAt: now } });
      return "revoked";
    }
    await db.ownedUrl.updateMany({ where: { id }, data: { failedAt: since, checkedAt: now } });
    return "grace";
  },
});
