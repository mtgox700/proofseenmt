import type { Db } from "./client";
import { vatOf } from "./invoices";
import type { Actor } from "./messaging";
import { dayDate, dayOf, daysEnding, monthOf, monthsEnding, parisDay, STATS_WINDOW_DAYS } from "./stat-days";

/*
 * Ce que le tableau de bord du freelance montre de son audience et de ses revenus. Des comptes, jour par jour ou mois par
 * mois : jamais une position, une note ni une comparaison avec d'autres freelances (AI Act).
 *
 * Les jours sans rien valent zéro : la courbe a toujours ses 90 points, et un jour vide se lit comme tel.
 */

export const REVENUE_MONTHS = 12;
export const TOP_KEYWORDS = 20;
/**
 * Un filtre n'est montré qu'à partir de trois apparitions sur la période (revue vague 3, L13) : en deçà, un mot rare
 * désignerait presque la recherche d'une seule entreprise.
 */
export const MIN_KEYWORD_APPEARANCES = 3;

export interface DailyAudience {
  /** Jour de Paris, « AAAA-MM-JJ ». */
  readonly day: string;
  readonly views: number;
  readonly searchAppearances: number;
  readonly directoryAppearances: number;
  readonly listAdds: number;
}

export interface KeywordCount {
  readonly kind: "skill" | "city";
  readonly keyword: string;
  readonly appearances: number;
}

export interface MonthlyRevenue {
  /** « AAAA-MM », mois de Paris. */
  readonly month: string;
  /** Versé au freelance ce mois-là, commission et TVA sur la commission déduites. */
  readonly receivedCents: number;
  /** Payé par l'entreprise ce mois-là et encore bloqué en attente de validation. */
  readonly heldCents: number;
}

export interface FreelanceInsights {
  readonly days: readonly DailyAudience[];
  readonly keywords: readonly KeywordCount[];
  /** `null` si les paiements sont dans plusieurs devises : la plateforme ne convertit pas, elle n'additionne pas. */
  readonly revenue: { readonly currency: string; readonly months: readonly MonthlyRevenue[] } | null;
}

export interface FreelanceInsightsRepository {
  /** `null` si la personne n'a pas de profil. */
  forFreelance(actor: Actor, now: Date): Promise<FreelanceInsights | null>;
}

const EMPTY_DAY = { views: 0, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 } as const;

const net = (p: { readonly amountCents: number; readonly commissionCents: number }): number => p.amountCents - p.commissionCents - vatOf(p.commissionCents, 2000);

interface PaymentRow {
  readonly status: string;
  readonly amountCents: number;
  readonly commissionCents: number;
  readonly currency: string;
  readonly createdAt: Date;
  readonly releasedAt: Date | null;
}

/** Les revenus mois par mois : versé au mois du versement, bloqué au mois du paiement de l'entreprise. */
export const revenueByMonth = (payments: readonly PaymentRow[], months: readonly string[], fallbackCurrency: string): FreelanceInsights["revenue"] => {
  const currencies = new Set(payments.map((p) => p.currency));
  if (currencies.size > 1) return null;
  const received = new Map<string, number>();
  const held = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "released" && p.releasedAt !== null) {
      const month = monthOf(parisDay(p.releasedAt));
      received.set(month, (received.get(month) ?? 0) + net(p));
    } else if (p.status === "held" || p.status === "releasing") {
      const month = monthOf(parisDay(p.createdAt));
      held.set(month, (held.get(month) ?? 0) + net(p));
    }
  }
  return {
    currency: [...currencies][0] ?? fallbackCurrency,
    months: months.map((month) => ({ month, receivedCents: received.get(month) ?? 0, heldCents: held.get(month) ?? 0 })),
  };
};

export const freelanceInsights = (db: Db): FreelanceInsightsRepository => ({
  async forFreelance(actor, now) {
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true, currency: true } });
    if (profile === null) return null;
    const today = parisDay(now);
    const days = daysEnding(today, STATS_WINDOW_DAYS);
    const from = dayDate(days[0] ?? today);
    const months = monthsEnding(monthOf(today), REVENUE_MONTHS);
    const monthsFrom = dayDate(`${months[0] ?? monthOf(today)}-01`);
    const [rows, keywords, payments] = await Promise.all([
      db.profileStatDay.findMany({
        where: { profileId: profile.id, day: { gte: from } },
        select: { day: true, views: true, searchAppearances: true, directoryAppearances: true, listAdds: true },
      }),
      db.profileStatKeyword.groupBy({
        by: ["kind", "keyword"],
        where: { profileId: profile.id, day: { gte: from } },
        _sum: { appearances: true },
        having: { appearances: { _sum: { gte: MIN_KEYWORD_APPEARANCES } } },
        orderBy: [{ _sum: { appearances: "desc" } }, { keyword: "asc" }],
        take: TOP_KEYWORDS,
      }),
      db.payment.findMany({
        where: {
          contract: { profileId: profile.id },
          OR: [
            { status: "released", releasedAt: { gte: monthsFrom } },
            { status: { in: ["held", "releasing"] } },
          ],
        },
        select: { status: true, amountCents: true, commissionCents: true, currency: true, createdAt: true, releasedAt: true },
      }),
    ]);
    const byDay = new Map(rows.map((row) => [dayOf(row.day), row]));
    return {
      days: days.map((day) => {
        const row = byDay.get(day);
        return row === undefined ? { day, ...EMPTY_DAY } : { day, views: row.views, searchAppearances: row.searchAppearances, directoryAppearances: row.directoryAppearances, listAdds: row.listAdds };
      }),
      keywords: keywords.map((k) => ({ kind: k.kind, keyword: k.keyword, appearances: k._sum.appearances ?? 0 })),
      revenue: revenueByMonth(payments, months, profile.currency),
    };
  },
});
