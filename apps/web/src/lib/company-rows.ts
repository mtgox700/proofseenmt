import type { CompanyCheck, RegistryStatus } from "@proofseen/db";

/*
 * The companies of the back-office registry list as the client component receives them: plain values, dates as ISO
 * strings. Read by the verifications page for its first rendering, and by the company search action (wave-3 review,
 * L14).
 */

export interface CompanyRow {
  readonly id: string;
  readonly name: string;
  readonly siret: string | null;
  readonly registryStatus: RegistryStatus | null;
  readonly registryName: string | null;
  readonly registryCheckedAt: string | null;
  /** The page alone, or the whole company with its missions, hidden by an operator. */
  readonly hidden: boolean;
}

export type CompanySearchState = { readonly kind: "too_many" } | { readonly kind: "hits"; readonly rows: readonly CompanyRow[] };

export const companyRows = (checks: readonly CompanyCheck[]): readonly CompanyRow[] =>
  checks.map((c) => ({
    id: c.id,
    name: c.name,
    siret: c.siret,
    registryStatus: c.registryStatus,
    registryName: c.registryName,
    registryCheckedAt: c.registryCheckedAt?.toISOString() ?? null,
    hidden: c.moderatedAt !== null || c.suspendedAt !== null,
  }));
