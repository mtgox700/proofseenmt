import { z } from "zod";
import { AddressSchema, type Address } from "./billing";
import type { Db } from "./client";
import type { RegistryStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Les identités de facturation, relues pour les remontrer dans les formulaires : celle du freelance pour lui seul, celle
 * de l'entreprise pour ses propriétaires et administrateurs. Le compte de versement Stripe n'en sort que sous forme de
 * fait (prêt ou non), jamais son identifiant.
 */

const Uuid = z.uuid();

export interface RegistryView {
  readonly status: RegistryStatus | null;
  readonly checkedAt: Date | null;
}

export interface FreelanceIdentityView {
  readonly legalName: string;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  readonly address: Address;
  readonly vatRateBp: number;
  readonly invoicingMandateAt: Date | null;
  readonly payoutsReady: boolean;
  /** Un compte de versement existe chez le prestataire (inscription commencée) ; son identifiant ne sort jamais. */
  readonly payoutAccountOpened: boolean;
  readonly registry: RegistryView;
}

export interface OrganisationIdentityView {
  readonly legalName: string;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  /** `null` tant que l'adresse de facturation n'a pas été renseignée. */
  readonly address: Address | null;
  readonly registry: RegistryView;
}

const address = (raw: unknown): Address | null => {
  const parsed = AddressSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

export const billingView = (db: Db) => ({
  /** L'identité de facturation du freelance ; `null` s'il n'a pas de profil ou ne l'a pas encore renseignée. */
  async freelance(actor: Actor): Promise<FreelanceIdentityView | null> {
    const row = await db.billingIdentity.findFirst({
      where: { profile: { userId: actor.userId } },
      select: { legalName: true, siret: true, vatNumber: true, address: true, vatRateBp: true, invoicingMandateAt: true, payoutsEnabledAt: true, stripeAccountId: true, registryStatus: true, registryCheckedAt: true },
    });
    const parsed = row === null ? null : address(row.address);
    if (row === null || parsed === null) return null;
    return {
      legalName: row.legalName,
      siret: row.siret,
      vatNumber: row.vatNumber,
      address: parsed,
      vatRateBp: row.vatRateBp,
      invoicingMandateAt: row.invoicingMandateAt,
      payoutsReady: row.payoutsEnabledAt !== null,
      payoutAccountOpened: row.stripeAccountId !== null,
      registry: { status: row.registryStatus, checkedAt: row.registryCheckedAt },
    };
  },

  /** L'identité légale de l'entreprise, pour ses propriétaires et administrateurs ; `null` pour les autres. */
  async organisation(actor: Actor, organisationId: string): Promise<OrganisationIdentityView | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    const row = await db.organisation.findFirst({
      where: { id: organisationId, members: { some: { userId: actor.userId, role: { in: ["owner", "admin"] } } } },
      select: { name: true, siret: true, vatNumber: true, billingAddress: true, registryStatus: true, registryCheckedAt: true },
    });
    if (row === null) return null;
    return {
      legalName: row.name,
      siret: row.siret,
      vatNumber: row.vatNumber,
      address: address(row.billingAddress),
      registry: { status: row.registryStatus, checkedAt: row.registryCheckedAt },
    };
  },
});

export type BillingView = ReturnType<typeof billingView>;
