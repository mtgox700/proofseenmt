import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { MissionInputSchema, missions, type MissionInput, type MissionRecord } from "./missions";

/*
 * Modèles de mission et duplication, côté entreprise. Un modèle garde les champs d'une mission (intitulé, description,
 * compétences, TJM, lieu, questions) pour en créer une nouvelle ; la duplication crée tout de suite un brouillon copié
 * d'une mission existante, même clôturée. Rien de cela n'est public, et rien ne se publie sans le geste habituel.
 *
 * Un modèle est relu avec le schéma de saisie des missions à chaque usage : un modèle devenu invalide (règle durcie
 * depuis) est ignoré plutôt que de remplir un formulaire faux.
 */

export const MAX_TEMPLATES_PER_ORGANISATION = 30;
export const TemplateNameSchema = z.string().trim().min(1).max(120);

const Uuid = z.uuid();

export interface TemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly createdAt: Date;
}

export interface TemplateDetail {
  readonly id: string;
  readonly name: string;
  readonly input: z.output<typeof MissionInputSchema>;
}

export type SaveTemplateResult = { readonly kind: "saved"; readonly templateId: string } | { readonly kind: "limit" } | { readonly kind: "absent" };

export interface MissionTemplates {
  /** Enregistre une mission de l'entreprise comme modèle. */
  saveFromMission(actor: Actor, missionId: string, name: string): Promise<SaveTemplateResult>;
  /** Les modèles de l'entreprise pour ses membres ; `null` pour les autres. */
  list(actor: Actor, organisationId: string): Promise<readonly TemplateSummary[] | null>;
  get(actor: Actor, templateId: string): Promise<TemplateDetail | null>;
  remove(actor: Actor, templateId: string): Promise<boolean>;
  /** Un brouillon copié d'une mission de l'entreprise ; `null` si l'acteur n'en est pas membre. */
  duplicate(actor: Actor, missionId: string): Promise<MissionRecord | null>;
}

/** Les champs saisis d'une mission, tels qu'un formulaire les renverrait. */
export const missionInput = (m: MissionRecord): MissionInput => ({
  title: m.title,
  description: m.description,
  skills: [...m.skills],
  durationMonths: m.durationMonths,
  dailyRateMinCents: m.dailyRateMinCents,
  dailyRateMaxCents: m.dailyRateMaxCents,
  currency: m.currency as MissionInput["currency"],
  city: m.city,
  workMode: m.workMode,
  questions: [...m.questions],
});

const memberOf = (userId: string) => ({ organisation: { members: { some: { userId } } } });

/** La mission, si l'acteur est membre de son entreprise. */
const ownMission = async (db: Db, actor: Actor, missionId: string): Promise<MissionRecord | null> => {
  if (!Uuid.safeParse(missionId).success) return null;
  const row = await db.jobPost.findFirst({ where: { id: missionId, ...memberOf(actor.userId) }, select: { organisationId: true } });
  if (row === null) return null;
  const all = await missions(db).listForOrganisation(actor, row.organisationId);
  return all?.find((m) => m.id === missionId) ?? null;
};

export const missionTemplates = (db: Db): MissionTemplates => ({
  async saveFromMission(actor, missionId, rawName) {
    const name = TemplateNameSchema.parse(rawName);
    const mission = await ownMission(db, actor, missionId);
    if (mission === null) return { kind: "absent" };
    const data = MissionInputSchema.parse(missionInput(mission));
    return db.$transaction(async (tx): Promise<SaveTemplateResult> => {
      await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${mission.organisationId}::uuid FOR UPDATE`;
      if ((await tx.missionTemplate.count({ where: { organisationId: mission.organisationId } })) >= MAX_TEMPLATES_PER_ORGANISATION) return { kind: "limit" };
      const { id } = await tx.missionTemplate.create({
        data: { organisationId: mission.organisationId, createdByUserId: actor.userId, name, data: data as Prisma.InputJsonObject },
        select: { id: true },
      });
      return { kind: "saved", templateId: id };
    });
  },

  async list(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return null;
    if ((await db.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return null;
    const rows = await db.missionTemplate.findMany({
      where: { organisationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_TEMPLATES_PER_ORGANISATION,
      select: { id: true, name: true, data: true, createdAt: true },
    });
    return rows.flatMap((row) => {
      const input = MissionInputSchema.safeParse(row.data);
      return input.success ? [{ id: row.id, name: row.name, title: input.data.title, createdAt: row.createdAt }] : [];
    });
  },

  async get(actor, templateId) {
    if (!Uuid.safeParse(templateId).success) return null;
    const row = await db.missionTemplate.findFirst({ where: { id: templateId, ...memberOf(actor.userId) }, select: { id: true, name: true, data: true } });
    if (row === null) return null;
    const input = MissionInputSchema.safeParse(row.data);
    return input.success ? { id: row.id, name: row.name, input: input.data } : null;
  },

  async remove(actor, templateId) {
    if (!Uuid.safeParse(templateId).success) return false;
    const { count } = await db.missionTemplate.deleteMany({ where: { id: templateId, ...memberOf(actor.userId) } });
    return count === 1;
  },

  async duplicate(actor, missionId) {
    const mission = await ownMission(db, actor, missionId);
    if (mission === null) return null;
    return missions(db).create(actor, mission.organisationId, missionInput(mission));
  },
});
