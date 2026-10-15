import { z } from "zod";
import { assertOperator, recordAction, type Operator } from "./back-office";
import type { Db } from "./client";
import type { RegistryStatus } from "./generated/enums";
import type { RegistryAnswer, RegistrySubject } from "./registry";

/*
 * Entreprises vues par l'opérateur (C19) : leur SIRET, l'état au répertoire officiel et sa date, et la relance d'un
 * contrôle à la demande. L'appel au répertoire (API publique, gratuite) est fait par l'application ; ce dépôt donne le
 * sujet à contrôler et enregistre le verdict, avec son entrée de journal, seulement si le SIRET n'a pas changé entre-temps.
 */

export interface CompanyCheck {
  readonly id: string;
  readonly name: string;
  readonly siret: string | null;
  readonly registryStatus: RegistryStatus | null;
  readonly registryName: string | null;
  readonly registryCheckedAt: Date | null;
  readonly registryAttemptedAt: Date | null;
  readonly createdAt: Date;
  readonly publicSlug: string | null;
  readonly moderatedAt: Date | null;
}

export interface RegistryDesk {
  /** Les entreprises, celles dont l'état pose question d'abord (jamais contrôlées, fermées, inconnues, autre nom). */
  list(search?: string): Promise<readonly CompanyCheck[]>;
  /** Le SIRET à contrôler pour cette entreprise ; `null` sans SIRET ou sans entreprise. */
  subject(organisationId: string): Promise<RegistrySubject | null>;
  /** Enregistre le verdict d'un contrôle demandé par l'opérateur ; `null` : répertoire injoignable, rien n'est conclu. */
  record(subject: RegistrySubject, answer: RegistryAnswer | null, now: Date): Promise<"recorded" | "attempted" | "changed">;
}

const Uuid = z.uuid();
const SearchSchema = z.string().trim().max(120);
const MAX_LISTED = 100;
const SELECT = { id: true, name: true, siret: true, registryStatus: true, registryName: true, registryCheckedAt: true, registryAttemptedAt: true, createdAt: true, publicSlug: true, moderatedAt: true } as const;

/** Ce qui demande un regard en premier : un état qui n'est pas « actif ». */
const concern = (status: RegistryStatus | null): number => (status === "active" ? 1 : 0);

export const registryDesk = (db: Db, operator: Operator): RegistryDesk => {
  assertOperator(operator);
  return {
    async list(raw = "") {
      const parsed = SearchSchema.safeParse(raw);
      const search = parsed.success ? parsed.data : "";
      const rows = await db.organisation.findMany({
        where: search === "" ? {} : { OR: [{ name: { contains: search, mode: "insensitive" } }, { siret: { startsWith: search.replace(/\s/g, "") } }] },
        orderBy: [{ registryCheckedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
        take: MAX_LISTED,
        select: SELECT,
      });
      return [...rows].sort((a, b) => concern(a.registryStatus) - concern(b.registryStatus));
    },

    async subject(organisationId) {
      if (!Uuid.safeParse(organisationId).success) return null;
      const row = await db.organisation.findUnique({ where: { id: organisationId }, select: { id: true, siret: true, name: true } });
      return row === null || row.siret === null ? null : { kind: "company", id: row.id, siret: row.siret, declaredName: row.name };
    },

    async record(subject, answer, now) {
      return db.$transaction(async (tx) => {
        const where = { id: subject.id, siret: subject.siret };
        const data = answer === null ? { registryAttemptedAt: now } : { registryStatus: answer.status, registryName: answer.officialName, registryCheckedAt: now, registryAttemptedAt: now };
        const { count } = await tx.organisation.updateMany({ where, data });
        if (count === 0) return "changed";
        await recordAction(tx, operator, { action: "registry_rechecked", targetType: "organisation", targetId: subject.id, reason: null, metadata: { status: answer?.status ?? "unreachable" } }, now);
        return answer === null ? "attempted" : "recorded";
      });
    },
  };
};
