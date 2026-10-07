import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import type { TimesheetStatus } from "./generated/enums";
import type { Actor } from "./messaging";
import { notifications } from "./notifications";

/*
 * Relevés mensuels d'un contrat en régie. Le freelance déclare, pour un mois, le nombre de demi-journées travaillées ;
 * un administrateur de l'entreprise valide ou refuse. Un relevé refusé se corrige et se redépose ; un relevé validé ne
 * change plus : il fonde le paiement et la facture du mois.
 *
 * La base tient les règles (déclencheur `Timesheet_guard`) : régie seulement, contrat actif, mois dans la période,
 * plafond de jours du contrat jamais dépassé. Ce module les vérifie d'abord pour répondre clairement ; la base reste le
 * dernier mot, y compris quand deux validations arrivent en même temps.
 */

const Uuid = z.uuid();
const ADMIN_ROLES = ["owner", "admin"] as const;

export const TimesheetInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mois attendu sous la forme AAAA-MM"),
  halfDays: z.number().int().min(1).max(46),
  note: z
    .string()
    .trim()
    .max(2000)
    .refine((n) => !containsDirectContact(n), { message: NO_CONTACT })
    .nullable()
    .default(null),
});

export type TimesheetInput = z.input<typeof TimesheetInputSchema>;

export interface TimesheetRecord {
  readonly id: string;
  readonly contractId: string;
  readonly month: string;
  readonly halfDays: number;
  readonly note: string | null;
  readonly status: TimesheetStatus;
  readonly submittedAt: Date;
  readonly decidedAt: Date | null;
}

export type SubmitResult =
  | { readonly kind: "submitted"; readonly timesheet: TimesheetRecord }
  /** Pas un contrat en régie actif de ce freelance. */
  | { readonly kind: "absent" }
  /** Le mois est hors de la période du contrat. */
  | { readonly kind: "out_of_period" }
  /** Déjà validé : un relevé validé ne change plus. */
  | { readonly kind: "locked" }
  /** Mois à venir, ou plus de demi-journées que le mois n'a de jours ouvrés. */
  | { readonly kind: "implausible" };

export type DecideResult =
  | { readonly kind: "decided"; readonly timesheet: TimesheetRecord }
  | { readonly kind: "absent" }
  /** Valider dépasserait le plafond de jours du contrat. */
  | { readonly kind: "over_cap" }
  /** Le relevé a été modifié depuis que l'administrateur l'a lu : la décision porterait sur d'autres chiffres. */
  | { readonly kind: "changed" };

const SELECT = { id: true, contractId: true, month: true, halfDays: true, note: true, status: true, submittedAt: true, decidedAt: true } as const;

const monthOf = (d: Date): string => d.toISOString().slice(0, 7);

/** Jours du lundi au vendredi d'un mois « AAAA-MM » : le maximum de jours qu'un relevé peut déclarer pour ce mois. */
export const weekdaysIn = (month: string): number => {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d += 1) {
    const weekday = new Date(Date.UTC(year, m - 1, d)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

/** Le contrat en régie actif dont l'acteur est le freelance. */
const freelanceContract = (db: Db, actor: Actor, contractId: string) =>
  db.contract.findFirst({
    where: { id: contractId, billing: "monthly", status: "active", profile: { userId: actor.userId } },
    select: { id: true, startsOn: true, endsOn: true, organisationId: true },
  });

export const timesheets = (db: Db) => ({
  /** Le freelance déclare ou corrige le relevé d'un mois (avant décision, ou après un refus). */
  async submit(actor: Actor, contractId: string, raw: TimesheetInput, now: Date): Promise<SubmitResult> {
    if (!Uuid.safeParse(contractId).success) return { kind: "absent" };
    const input = TimesheetInputSchema.parse(raw);
    const contract = await freelanceContract(db, actor, contractId);
    if (contract === null) return { kind: "absent" };
    if (input.month < monthOf(contract.startsOn) || (contract.endsOn !== null && input.month > monthOf(contract.endsOn))) return { kind: "out_of_period" };
    // On déclare un mois commencé, jamais un mois à venir ; et pas plus de jours que le mois n'en compte d'ouvrés.
    if (input.month > monthOf(now) || input.halfDays > weekdaysIn(input.month) * 2) return { kind: "implausible" };
    try {
    return await db.$transaction(async (tx): Promise<SubmitResult> => {
      const existing = await tx.timesheet.findUnique({ where: { contractId_month: { contractId, month: input.month } }, select: { id: true, status: true } });
      if (existing?.status === "approved") return { kind: "locked" };
      const data = { halfDays: input.halfDays, note: input.note, status: "submitted" as const, submittedAt: now, decidedAt: null, decidedByUserId: null };
      const timesheet =
        existing === null
          ? await tx.timesheet.create({ data: { contractId, month: input.month, ...data }, select: SELECT })
          : await tx.timesheet.update({ where: { id: existing.id }, data, select: SELECT });
      if (contract.organisationId !== null) {
        const members = await tx.membership.findMany({ where: { organisationId: contract.organisationId, role: { in: [...ADMIN_ROLES] } }, select: { userId: true } });
        await notifications(db).enqueue(tx, members.map((m) => m.userId), "contract_update", { contractId, status: "timesheet_submitted", month: input.month });
      }
      return { kind: "submitted", timesheet };
    });
    } catch (error) {
      // Validé entre la lecture et l'écriture : la base l'a protégé, la réponse le dit.
      if (error instanceof Error && error.message.includes("validé ne change plus")) return { kind: "locked" };
      throw error;
    }
  },

  /** Un administrateur de l'entreprise valide ou refuse un relevé déposé ; jamais le freelance du contrat. */
  /**
   * `seenSubmittedAt` est la date de dépôt du relevé tel que l'administrateur l'a lu : s'il a été corrigé depuis, la
   * décision n'est pas appliquée (« changed »), pour ne jamais valider des chiffres qu'il n'a pas vus.
   */
  async decide(actor: Actor, timesheetId: string, decision: "approved" | "rejected", seenSubmittedAt: Date, now: Date): Promise<DecideResult> {
    if (!Uuid.safeParse(timesheetId).success) return { kind: "absent" };
    const row = await db.timesheet.findFirst({
      where: {
        id: timesheetId,
        status: "submitted",
        contract: { organisation: { members: { some: { userId: actor.userId, role: { in: [...ADMIN_ROLES] } } } }, NOT: { profile: { userId: actor.userId } } },
      },
      select: { id: true, contractId: true, month: true, contract: { select: { profile: { select: { userId: true } } } } },
    });
    if (row === null) return { kind: "absent" };
    try {
      return await db.$transaction(async (tx): Promise<DecideResult> => {
        const { count } = await tx.timesheet.updateMany({ where: { id: row.id, status: "submitted", submittedAt: seenSubmittedAt }, data: { status: decision, decidedAt: now, decidedByUserId: actor.userId } });
        if (count === 0) return { kind: "changed" };
        const freelance = row.contract.profile?.userId;
        if (freelance !== undefined) {
          await notifications(db).enqueue(tx, [freelance], "contract_update", { contractId: row.contractId, status: decision === "approved" ? "timesheet_approved" : "timesheet_rejected", month: row.month });
        }
        return { kind: "decided", timesheet: await tx.timesheet.findUniqueOrThrow({ where: { id: row.id }, select: SELECT }) };
      });
    } catch (error) {
      // La base refuse de dépasser le plafond, même quand deux validations se croisent.
      if (error instanceof Error && error.message.includes("plafond de jours")) return { kind: "over_cap" };
      throw error;
    }
  },

  /** Les relevés d'un contrat, pour ses deux parties ; `null` pour les autres. */
  async list(actor: Actor, contractId: string): Promise<readonly TimesheetRecord[] | null> {
    if (!Uuid.safeParse(contractId).success) return null;
    const visible = await db.contract.count({
      where: { id: contractId, OR: [{ profile: { userId: actor.userId } }, { organisation: { members: { some: { userId: actor.userId } } } }] },
    });
    if (visible === 0) return null;
    return db.timesheet.findMany({ where: { contractId }, orderBy: { month: "asc" }, select: SELECT });
  },
});
