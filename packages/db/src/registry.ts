import { z } from "zod";
import type { Db } from "./client";
import type { RegistryStatus } from "./generated/enums";

/*
 * Contrôle des SIRET au répertoire officiel des entreprises (API publique Recherche d'entreprises, sans clé). Une
 * entreprise sait que le freelance existe légalement, un freelance que l'entreprise qui le contacte est réelle : un
 * fait daté, jamais une note.
 *
 * La réponse du répertoire est une donnée externe : elle est validée avant d'être crue. Un répertoire injoignable ne
 * produit aucun verdict (on réessaiera), jamais « fermé » par défaut : une panne ne doit bloquer personne.
 */

export const REGISTRY_RECHECK_DAYS = 30;
const DAY_MS = 86_400_000;

const Establishment = z.object({ siret: z.string(), etat_administratif: z.string().nullable().optional() });
const RegistryResponse = z.object({
  results: z.array(
    z.object({
      siren: z.string(),
      etat_administratif: z.string().nullable().optional(),
      matching_etablissements: z.array(Establishment).optional(),
      siege: Establishment.optional(),
    }),
  ),
});

/** Verdict à partir de la réponse brute de l'API, pour un SIRET donné ; `null` si la réponse est illisible. */
export const registryVerdict = (siret: string, raw: unknown): RegistryStatus | null => {
  const parsed = RegistryResponse.safeParse(raw);
  if (!parsed.success) return null;
  const unit = parsed.data.results.find((r) => r.siren === siret.slice(0, 9));
  if (unit === undefined) return "not_found";
  const establishment = [...(unit.matching_etablissements ?? []), ...(unit.siege === undefined ? [] : [unit.siege])].find((e) => e.siret === siret);
  if (establishment === undefined) return "not_found";
  return unit.etat_administratif === "A" && establishment.etat_administratif === "A" ? "active" : "ceased";
};

export type RegistrySubject = { readonly kind: "freelance" | "company"; readonly id: string; readonly siret: string };

export const registry = (db: Db) => ({
  /** Les SIRET jamais contrôlés, ou contrôlés il y a plus de REGISTRY_RECHECK_DAYS jours. */
  async due(now: Date, limit: number): Promise<readonly RegistrySubject[]> {
    const stale = new Date(now.getTime() - REGISTRY_RECHECK_DAYS * DAY_MS);
    const pending = { siret: { not: null }, OR: [{ registryCheckedAt: null }, { registryCheckedAt: { lt: stale } }] };
    const [freelances, companies] = await Promise.all([
      db.billingIdentity.findMany({ where: pending, select: { id: true, siret: true }, orderBy: { registryCheckedAt: { sort: "asc", nulls: "first" } }, take: limit }),
      db.organisation.findMany({ where: pending, select: { id: true, siret: true }, orderBy: { registryCheckedAt: { sort: "asc", nulls: "first" } }, take: limit }),
    ]);
    return [
      ...freelances.flatMap((f) => (f.siret === null ? [] : [{ kind: "freelance" as const, id: f.id, siret: f.siret }])),
      ...companies.flatMap((c) => (c.siret === null ? [] : [{ kind: "company" as const, id: c.id, siret: c.siret }])),
    ].slice(0, limit);
  },

  /** Enregistre un verdict, seulement si le SIRET n'a pas changé entre la lecture et le contrôle. */
  async record(subject: RegistrySubject, status: RegistryStatus, now: Date): Promise<boolean> {
    const where = { id: subject.id, siret: subject.siret };
    const data = { registryStatus: status, registryCheckedAt: now };
    const { count } = subject.kind === "freelance" ? await db.billingIdentity.updateMany({ where, data }) : await db.organisation.updateMany({ where, data });
    return count === 1;
  },
});
