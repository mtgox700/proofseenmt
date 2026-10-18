import { z } from "zod";
import type { Db } from "./client";
import type { ApplicationStatus, AvailabilityStatus, ContractStatus, JobPostStatus } from "./generated/enums";
import { vatOf } from "./invoices";
import type { Actor } from "./messaging";
import { REQUIRED_TO_PUBLISH } from "./profiles";
import { SETTLED_PAYMENT } from "./reviews";

/*
 * Tableaux de bord. Des faits comptés en base, rien d'estimé : un chiffre affiché ici se retrouve ligne à ligne dans
 * les missions, les contrats, les paiements et les factures de la personne.
 *
 * Revenus du freelance : ce qui lui a été réellement versé (montant payé moins la commission et sa TVA), et ce qui est
 * bloqué en attente de validation. Jamais un chiffre d'affaires « prévu ».
 */

type Counts<K extends string> = Readonly<Partial<Record<K, number>>>;

export interface FreelanceDashboard {
  readonly profile: {
    readonly published: boolean;
    /** Ce qui manque pour publier, dans l'ordre de REQUIRED_TO_PUBLISH : le parcours guidé l'affiche tel quel (C23). */
    readonly missing: readonly string[];
    readonly verifiedUrls: number;
    readonly verifiedMissions: number;
    /** La disponibilité déclarée et sa dernière confirmation, pour la demande de reconfirmation de l'accueil (C23). */
    readonly availability: AvailabilityStatus;
    readonly availabilityAt: Date;
  } | null;
  readonly applications: Counts<ApplicationStatus>;
  readonly contracts: Counts<ContractStatus>;
  readonly money: { readonly currency: string; readonly receivedCents: number; readonly heldCents: number } | null;
  readonly invoices: number;
  readonly reviews: number;
}

export interface CompanyDashboard {
  readonly missions: Counts<JobPostStatus>;
  /** Candidatures reçues sur les missions ouvertes, retraits exclus. */
  readonly openApplications: number;
  readonly contracts: Counts<ContractStatus>;
  readonly spend: { readonly currency: string; readonly paidCents: number; readonly heldCents: number } | null;
  readonly invoices: number;
}

export interface Dashboards {
  freelance(actor: Actor): Promise<FreelanceDashboard>;
  /** `null` si l'acteur n'est pas membre de l'entreprise. */
  company(actor: Actor, organisationId: string): Promise<CompanyDashboard | null>;
}

const countBy = <K extends string>(rows: readonly { status: K; _count: { _all: number } }[]): Counts<K> =>
  Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Counts<K>;

/**
 * Une seule devise par somme : la plateforme ne convertit pas. Aucun paiement, ou plusieurs devises : pas de somme
 * (`null`), plutôt qu'un « 0 € » dans une devise supposée ou un total qui additionne des euros et des francs.
 */
const singleCurrency = (rows: readonly { currency: string }[]): string | null => {
  const currencies = new Set(rows.map((r) => r.currency));
  return currencies.size === 1 ? ([...currencies][0] ?? null) : null;
};

export const dashboards = (db: Db): Dashboards => ({
  async freelance(actor) {
    const profile = await db.freelanceProfile.findUnique({
      where: { userId: actor.userId },
      select: {
        id: true,
        visibility: true,
        headline: true,
        summary: true,
        city: true,
        availability: true,
        availabilityAt: true,
        _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true, reviews: { where: { contract: { payments: { some: SETTLED_PAYMENT } } } } } },
      },
    });
    if (profile === null) {
      return { profile: null, applications: {}, contracts: {}, money: null, invoices: 0, reviews: 0 };
    }
    const [applications, contracts, payments, invoices] = await Promise.all([
      db.application.groupBy({ by: ["status"], where: { profileId: profile.id }, _count: { _all: true } }),
      db.contract.groupBy({ by: ["status"], where: { profileId: profile.id }, _count: { _all: true } }),
      db.payment.findMany({ where: { contract: { profileId: profile.id }, status: { in: ["held", "releasing", "released"] } }, select: { status: true, amountCents: true, commissionCents: true, currency: true } }),
      db.invoice.count({ where: { contract: { profileId: profile.id } } }),
    ]);
    const currency = singleCurrency(payments);
    const net = (p: { amountCents: number; commissionCents: number }) => p.amountCents - p.commissionCents - vatOf(p.commissionCents, 2000);
    return {
      profile: {
        published: profile.visibility !== "private",
        missing: REQUIRED_TO_PUBLISH.filter((field) => profile[field] === null),
        verifiedUrls: profile._count.ownedUrls,
        verifiedMissions: profile._count.missions,
        availability: profile.availability,
        availabilityAt: profile.availabilityAt,
      },
      applications: countBy(applications),
      contracts: countBy(contracts),
      money:
        currency === null
          ? null
          : {
              currency,
              receivedCents: payments.filter((p) => p.status === "released").reduce((sum, p) => sum + net(p), 0),
              heldCents: payments.filter((p) => p.status !== "released").reduce((sum, p) => sum + net(p), 0),
            },
      invoices,
      reviews: profile._count.reviews,
    };
  },

  async company(actor, organisationId) {
    if (!z.uuid().safeParse(organisationId).success) return null;
    if ((await db.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return null;
    const [missions, openApplications, contracts, payments, invoices] = await Promise.all([
      db.jobPost.groupBy({ by: ["status"], where: { organisationId }, _count: { _all: true } }),
      db.application.count({ where: { jobPost: { organisationId, status: "open" }, status: { not: "withdrawn" } } }),
      db.contract.groupBy({ by: ["status"], where: { organisationId }, _count: { _all: true } }),
      db.payment.findMany({ where: { contract: { organisationId }, status: { in: ["held", "releasing", "released"] } }, select: { status: true, amountCents: true, currency: true } }),
      // L'entreprise ne voit que les factures de mission : la commission regarde le freelance et Proofseen.
      db.invoice.count({ where: { kind: "mission", contract: { organisationId } } }),
    ]);
    const currency = singleCurrency(payments);
    return {
      missions: countBy(missions),
      openApplications,
      contracts: countBy(contracts),
      spend:
        currency === null
          ? null
          : {
              currency,
              paidCents: payments.filter((p) => p.status === "released").reduce((sum, p) => sum + p.amountCents, 0),
              heldCents: payments.filter((p) => p.status !== "released").reduce((sum, p) => sum + p.amountCents, 0),
            },
      invoices,
    };
  },
});
