import { z } from "zod";
import type { Db } from "./client";
import type { RegistryStatus } from "./generated/enums";

/*
 * Contrôle des SIRET au répertoire officiel des entreprises (API publique Recherche d'entreprises, sans clé). Une
 * entreprise sait que le freelance existe légalement, un freelance que l'entreprise qui le contacte est réelle : un
 * fait daté, jamais une note.
 *
 * Un SIRET actif ne suffit pas : il doit appartenir à la partie qui le déclare. Le nom officiel du répertoire est donc
 * comparé à la raison sociale déclarée ; sans correspondance, le verdict est « mismatch » et aucun fait n'est affiché.
 * La réponse du répertoire est une donnée externe, validée avant d'être crue. Un répertoire injoignable ne produit aucun
 * verdict (on réessaiera plus tard), jamais « fermé » par défaut : une panne ne doit bloquer personne.
 */

export const REGISTRY_RECHECK_DAYS = 30;
/** Après un échec, un SIRET attend avant d'être retenté, pour ne pas bloquer la file des autres. */
export const REGISTRY_RETRY_HOURS = 24;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const Establishment = z.object({ siret: z.string(), etat_administratif: z.string().nullable().optional() });
const RegistryResponse = z.object({
  results: z.array(
    z.object({
      siren: z.string(),
      nom_complet: z.string().nullable().optional(),
      nom_raison_sociale: z.string().nullable().optional(),
      etat_administratif: z.string().nullable().optional(),
      matching_etablissements: z.array(Establishment).optional(),
      siege: Establishment.optional(),
    }),
  ),
});

/** Formes juridiques et mots vides : « ACME SAS » et « Acme » désignent la même entreprise. */
const NOISE = new Set(["sas", "sasu", "sarl", "eurl", "sa", "sci", "scop", "snc", "ei", "eirl", "micro", "entreprise", "societe", "ste", "et", "de", "du", "des", "la", "le", "les", "l", "d", "capital", "variable"]);

const tokens = (name: string): readonly string[] =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !NOISE.has(t));

/** Vrai si les deux noms désignent la même entité : tous les mots significatifs de l'un se retrouvent dans l'autre. */
export const sameEntityName = (declared: string, official: string): boolean => {
  const a = tokens(declared);
  const b = tokens(official);
  if (a.length === 0 || b.length === 0) return false;
  const contains = (big: readonly string[], small: readonly string[]): boolean => small.every((t) => big.includes(t));
  return contains(a, b) || contains(b, a);
};

export interface RegistryAnswer {
  readonly status: RegistryStatus;
  readonly officialName: string | null;
}

/** Verdict pour un SIRET et la raison sociale déclarée ; `null` si la réponse est illisible. */
export const registryVerdict = (siret: string, declaredName: string, raw: unknown): RegistryAnswer | null => {
  const parsed = RegistryResponse.safeParse(raw);
  if (!parsed.success) return null;
  const unit = parsed.data.results.find((r) => r.siren === siret.slice(0, 9));
  if (unit === undefined) return { status: "not_found", officialName: null };
  const establishment = [...(unit.matching_etablissements ?? []), ...(unit.siege === undefined ? [] : [unit.siege])].find((e) => e.siret === siret);
  if (establishment === undefined) return { status: "not_found", officialName: null };
  const officialName = unit.nom_raison_sociale ?? unit.nom_complet ?? null;
  if (unit.etat_administratif !== "A" || establishment.etat_administratif !== "A") return { status: "ceased", officialName };
  const names = [unit.nom_raison_sociale, unit.nom_complet].filter((n): n is string => typeof n === "string" && n.trim() !== "");
  return { status: names.some((n) => sameEntityName(declaredName, n)) ? "active" : "mismatch", officialName };
};

export type RegistrySubject = { readonly kind: "freelance" | "company"; readonly id: string; readonly siret: string; readonly declaredName: string };

export const registry = (db: Db) => ({
  /** Les SIRET jamais contrôlés ou à revérifier, hors ceux dont une tentative a échoué il y a moins de REGISTRY_RETRY_HOURS. */
  async due(now: Date, limit: number): Promise<readonly RegistrySubject[]> {
    const stale = new Date(now.getTime() - REGISTRY_RECHECK_DAYS * DAY_MS);
    const retry = new Date(now.getTime() - REGISTRY_RETRY_HOURS * HOUR_MS);
    const pending = {
      siret: { not: null },
      OR: [{ registryCheckedAt: null }, { registryCheckedAt: { lt: stale } }],
      AND: [{ OR: [{ registryAttemptedAt: null }, { registryAttemptedAt: { lt: retry } }] }],
    };
    const order = { registryAttemptedAt: { sort: "asc" as const, nulls: "first" as const } };
    const [freelances, companies] = await Promise.all([
      db.billingIdentity.findMany({ where: pending, select: { id: true, siret: true, legalName: true }, orderBy: order, take: limit }),
      db.organisation.findMany({ where: pending, select: { id: true, siret: true, name: true }, orderBy: order, take: limit }),
    ]);
    return [
      ...freelances.flatMap((f) => (f.siret === null ? [] : [{ kind: "freelance" as const, id: f.id, siret: f.siret, declaredName: f.legalName }])),
      ...companies.flatMap((c) => (c.siret === null ? [] : [{ kind: "company" as const, id: c.id, siret: c.siret, declaredName: c.name }])),
    ].slice(0, limit);
  },

  /** Enregistre un verdict, seulement si le SIRET n'a pas changé entre la lecture et le contrôle. */
  async record(subject: RegistrySubject, answer: RegistryAnswer, now: Date): Promise<boolean> {
    const where = { id: subject.id, siret: subject.siret };
    const data = { registryStatus: answer.status, registryName: answer.officialName, registryCheckedAt: now, registryAttemptedAt: now };
    const { count } = subject.kind === "freelance" ? await db.billingIdentity.updateMany({ where, data }) : await db.organisation.updateMany({ where, data });
    return count === 1;
  },

  /** Une tentative sans verdict (répertoire injoignable, réponse illisible) : retentée plus tard. */
  async attempted(subject: RegistrySubject, now: Date): Promise<void> {
    const where = { id: subject.id, siret: subject.siret };
    const data = { registryAttemptedAt: now };
    if (subject.kind === "freelance") await db.billingIdentity.updateMany({ where, data });
    else await db.organisation.updateMany({ where, data });
  },
});
