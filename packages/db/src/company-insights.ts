import { z } from "zod";
import type { Db } from "./client";
import type { ApplicationStatus, JobPostStatus } from "./generated/enums";
import type { Actor } from "./messaging";
import { dayDate, daysEnding, monthOf, monthsEnding, parisDay, STATS_WINDOW_DAYS } from "./stat-days";

/*
 * Le tableau de bord d'une entreprise : ses recrutements (missions et candidatures par étape, délai de première réponse),
 * ses dépenses (par mois, par centre de coûts) et l'activité de son équipe. Des comptes faits en base pour les membres
 * de l'entreprise seulement ; l'activité de l'équipe est un total, jamais le détail par membre.
 */

export const COMPANY_MONTHS = 12;
const DAY_MS = 86_400_000;
/** Au-delà, le délai médian se calcule sur les 500 décisions les plus récentes. */
const MAX_DECISIONS = 500;

type Counts<K extends string> = Readonly<Partial<Record<K, number>>>;

export interface MonthlySpend {
  readonly month: string;
  /** Versé au freelance (prestation validée). */
  readonly paidCents: number;
  /** Payé et bloqué en attente de validation. */
  readonly heldCents: number;
}

export interface CostCentreSpend {
  /** `null` : contrats sans centre de coûts. */
  readonly costCenter: string | null;
  readonly paidCents: number;
  readonly heldCents: number;
}

export interface CompanyInsights {
  readonly missions: Counts<JobPostStatus>;
  readonly applications: Counts<ApplicationStatus>;
  /** Délai médian entre une candidature et la décision de l'entreprise, sur 90 jours ; `null` sans décision. */
  readonly firstResponse: { readonly medianDays: number; readonly decided: number } | null;
  readonly publishedByMonth: readonly { readonly month: string; readonly count: number }[];
  /** `null` si les paiements sont dans plusieurs devises. */
  readonly spend: { readonly currency: string; readonly months: readonly MonthlySpend[]; readonly costCentres: readonly CostCentreSpend[] } | null;
  /** Sur 90 jours : recherches lancées, listes créées, freelances ajoutés à une liste. */
  readonly team: { readonly searches: number; readonly listsCreated: number; readonly profilesAdded: number };
}

export interface CompanyInsightsRepository {
  /** `null` si l'acteur n'est pas membre de l'entreprise. */
  forCompany(actor: Actor, organisationId: string, now: Date): Promise<CompanyInsights | null>;
}

const countBy = <K extends string>(rows: readonly { status: K; _count: { _all: number } }[]): Counts<K> =>
  Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Counts<K>;

/** La médiane d'une liste de durées en jours, à un dixième près. */
export const medianDays = (durationsMs: readonly number[]): number | null => {
  if (durationsMs.length === 0) return null;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round((median / DAY_MS) * 10) / 10;
};

interface SpendRow {
  readonly status: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly createdAt: Date;
  readonly contract: { readonly costCenter: string | null };
}

const paidOrHeld = (row: SpendRow): { paidCents: number; heldCents: number } =>
  row.status === "released" ? { paidCents: row.amountCents, heldCents: 0 } : { paidCents: 0, heldCents: row.amountCents };

/** Les dépenses au mois du paiement de l'entreprise, et par centre de coûts (le plus dépensier d'abord). */
export const spendOf = (rows: readonly SpendRow[], months: readonly string[]): CompanyInsights["spend"] => {
  const currencies = new Set(rows.map((r) => r.currency));
  if (currencies.size > 1) return null;
  const byMonth = new Map<string, { paidCents: number; heldCents: number }>();
  const byCentre = new Map<string | null, { paidCents: number; heldCents: number }>();
  for (const row of rows) {
    const amounts = paidOrHeld(row);
    const month = monthOf(parisDay(row.createdAt));
    const m = byMonth.get(month) ?? { paidCents: 0, heldCents: 0 };
    byMonth.set(month, { paidCents: m.paidCents + amounts.paidCents, heldCents: m.heldCents + amounts.heldCents });
    const c = byCentre.get(row.contract.costCenter) ?? { paidCents: 0, heldCents: 0 };
    byCentre.set(row.contract.costCenter, { paidCents: c.paidCents + amounts.paidCents, heldCents: c.heldCents + amounts.heldCents });
  }
  return {
    currency: [...currencies][0] ?? "EUR",
    months: months.map((month) => ({ month, ...(byMonth.get(month) ?? { paidCents: 0, heldCents: 0 }) })),
    costCentres: [...byCentre.entries()]
      .map(([costCenter, amounts]) => ({ costCenter, ...amounts }))
      .sort((a, b) => b.paidCents + b.heldCents - (a.paidCents + a.heldCents) || (a.costCenter ?? "").localeCompare(b.costCenter ?? "")),
  };
};

export const companyInsights = (db: Db): CompanyInsightsRepository => ({
  async forCompany(actor, organisationId, now) {
    if (!z.uuid().safeParse(organisationId).success) return null;
    if ((await db.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return null;
    const today = parisDay(now);
    const windowFrom = dayDate(daysEnding(today, STATS_WINDOW_DAYS)[0] ?? today);
    const months = monthsEnding(monthOf(today), COMPANY_MONTHS);
    const monthsFrom = dayDate(`${months[0] ?? monthOf(today)}-01`);
    const [missions, applications, decisions, published, payments, searches, listsCreated, profilesAdded] = await Promise.all([
      db.jobPost.groupBy({ by: ["status"], where: { organisationId }, _count: { _all: true } }),
      db.application.groupBy({ by: ["status"], where: { jobPost: { organisationId } }, _count: { _all: true } }),
      db.application.findMany({
        where: { jobPost: { organisationId }, status: { in: ["shortlisted", "declined", "hired"] }, createdAt: { gte: windowFrom } },
        orderBy: { createdAt: "desc" },
        take: MAX_DECISIONS,
        select: { createdAt: true, updatedAt: true },
      }),
      db.jobPost.findMany({ where: { organisationId, publishedAt: { gte: monthsFrom } }, select: { publishedAt: true } }),
      db.payment.findMany({
        where: { contract: { organisationId }, status: { in: ["held", "releasing", "released"] }, createdAt: { gte: monthsFrom } },
        select: { status: true, amountCents: true, currency: true, createdAt: true, contract: { select: { costCenter: true } } },
      }),
      db.organisationStatDay.aggregate({ where: { organisationId, day: { gte: windowFrom } }, _sum: { searches: true } }),
      db.freelanceList.count({ where: { organisationId, createdAt: { gte: windowFrom } } }),
      db.freelanceListItem.count({ where: { list: { organisationId }, createdAt: { gte: windowFrom } } }),
    ]);
    const median = medianDays(decisions.map((d) => d.updatedAt.getTime() - d.createdAt.getTime()));
    const publishedMonths = published.flatMap((p) => (p.publishedAt === null ? [] : [monthOf(parisDay(p.publishedAt))]));
    return {
      missions: countBy(missions),
      applications: countBy(applications),
      firstResponse: median === null ? null : { medianDays: median, decided: decisions.length },
      publishedByMonth: months.map((month) => ({ month, count: publishedMonths.filter((m) => m === month).length })),
      spend: spendOf(payments, months),
      team: { searches: searches._sum.searches ?? 0, listsCreated, profilesAdded },
    };
  },
});
