import type { z } from "zod";
import type { Db } from "./client";
import { NO_CONTACT } from "./contact-detection";
import type { Prisma } from "./generated/client";
import type { LanguageLevel } from "./generated/enums";
import type { Actor } from "./messaging";
import {
  CertificationInputSchema,
  EducationInputSchema,
  ExperienceInputSchema,
  LanguageInputSchema,
  PortfolioInputSchema,
  SECTION_LIMITS,
  type CertificationInput,
  type EducationInput,
  type ExperienceInput,
  type LanguageInput,
  type PortfolioInput,
} from "./profile-section-schemas";

/*
 * Les sections du profil enrichi, lues et écrites par le seul freelance qui les possède : chaque requête passe par le
 * compte de l'acteur, un identifiant d'un autre profil est absent comme un identifiant inconnu.
 *
 * Chaque ajout se fait sous verrou du profil : deux ajouts simultanés ne dépassent pas le plafond de la section. La
 * photo et l'image d'une réalisation sont des fichiers déposés : remplacées ou retirées, leur ligne part, et le dépôt
 * rend l'identifiant pour que l'application efface le fichier du disque.
 *
 * La disponibilité confirmée est une date : celle de la dernière déclaration ou confirmation par le freelance. Elle est
 * affichée telle quelle ; jamais transformée en note.
 */

export type SectionName = "experiences" | "educations" | "certifications" | "portfolio";

export type SectionWriteResult = { readonly kind: "added"; readonly id: string } | { readonly kind: "absent" | "invalid" | "contact" | "limit" };

export interface ExperienceRecord {
  readonly id: string;
  readonly title: string;
  readonly company: string | null;
  readonly companyHidden: boolean;
  readonly startMonth: Date;
  readonly endMonth: Date | null;
  readonly description: string | null;
  readonly skills: readonly string[];
}

export interface EducationRecord {
  readonly id: string;
  readonly school: string;
  readonly degree: string | null;
  readonly startYear: number | null;
  readonly endYear: number | null;
}

export interface CertificationRecord {
  readonly id: string;
  readonly name: string;
  readonly issuer: string | null;
  readonly year: number | null;
  readonly credentialUrl: string | null;
  readonly skills: readonly string[];
}

export interface LanguageRecord {
  readonly code: string;
  readonly level: LanguageLevel;
}

export interface PortfolioRecord {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly imageFileId: string | null;
}

export interface ProfileSectionsView {
  readonly photoFileId: string | null;
  readonly availabilityAt: Date;
  readonly experiences: readonly ExperienceRecord[];
  readonly educations: readonly EducationRecord[];
  readonly certifications: readonly CertificationRecord[];
  readonly languages: readonly LanguageRecord[];
  readonly portfolio: readonly PortfolioRecord[];
}

export interface ProfileSections {
  /** Les sections du profil de l'acteur ; `null` sans profil. */
  mine(actor: Actor): Promise<ProfileSectionsView | null>;
  addExperience(actor: Actor, input: ExperienceInput): Promise<SectionWriteResult>;
  addEducation(actor: Actor, input: EducationInput): Promise<SectionWriteResult>;
  addCertification(actor: Actor, input: CertificationInput): Promise<SectionWriteResult>;
  /** L'image, facultative, est un fichier `portfolio_image` déjà déposé par l'acteur et libre. */
  addPortfolioItem(actor: Actor, input: PortfolioInput, imageFileId?: string | null): Promise<SectionWriteResult>;
  /** Pose ou change le niveau d'une langue (une ligne par langue). */
  setLanguage(actor: Actor, input: LanguageInput): Promise<SectionWriteResult>;
  removeLanguage(actor: Actor, code: string): Promise<boolean>;
  /** Retire un élément ; pour une réalisation, rend aussi l'image supprimée à effacer du disque. */
  remove(actor: Actor, section: SectionName, id: string): Promise<{ readonly removed: boolean; readonly fileIds: readonly string[] }>;
  /** Date de la confirmation ; `null` sans profil. */
  confirmAvailability(actor: Actor, now: Date): Promise<Date | null>;
  /** Pose la photo (un fichier `photo` de l'acteur) ; rend l'ancienne, supprimée, à effacer du disque. */
  setPhoto(actor: Actor, fileId: string): Promise<{ readonly kind: "set"; readonly previousFileId: string | null } | { readonly kind: "absent" }>;
  /** Retire la photo ; rend son identifiant, à effacer du disque. */
  removePhoto(actor: Actor): Promise<string | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le profil de l'acteur, verrouillé jusqu'à la fin de la transaction ; `null` sans profil. */
const lockProfile = async (tx: Prisma.TransactionClient, actor: Actor): Promise<string | null> => {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "FreelanceProfile" WHERE "userId" = ${actor.userId}::uuid FOR UPDATE`;
  return rows[0]?.id ?? null;
};

type Counter = (tx: Prisma.TransactionClient, profileId: string) => Promise<number>;

const failure = (issues: readonly { readonly message: string }[]): SectionWriteResult =>
  issues.some((issue) => issue.message === NO_CONTACT) ? { kind: "contact" } : { kind: "invalid" };

/** Valide, verrouille le profil, vérifie le plafond, crée. */
const addWith = async <S extends z.ZodType>(
  db: Db,
  actor: Actor,
  schema: S,
  raw: unknown,
  limit: number,
  count: Counter,
  create: (tx: Prisma.TransactionClient, profileId: string, data: z.output<S>) => Promise<string | null>,
): Promise<SectionWriteResult> => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return failure(parsed.error.issues);
  return db.$transaction(async (tx): Promise<SectionWriteResult> => {
    const profileId = await lockProfile(tx, actor);
    if (profileId === null) return { kind: "absent" };
    if ((await count(tx, profileId)) >= limit) return { kind: "limit" };
    const id = await create(tx, profileId, parsed.data);
    return id === null ? { kind: "absent" } : { kind: "added", id };
  });
};

const MONTHS_ORDER = [{ endMonth: { sort: "desc", nulls: "first" } }, { startMonth: "desc" }, { id: "desc" }] satisfies Prisma.ProfileExperienceOrderByWithRelationInput[];

export const profileSections = (db: Db): ProfileSections => ({
  async mine(actor) {
    const row = await db.freelanceProfile.findUnique({
      where: { userId: actor.userId },
      select: {
        photoFileId: true,
        availabilityAt: true,
        experiences: { orderBy: MONTHS_ORDER, select: { id: true, title: true, company: true, companyHidden: true, startMonth: true, endMonth: true, description: true, skills: true } },
        educations: { orderBy: [{ endYear: { sort: "desc", nulls: "first" } }, { id: "desc" }], select: { id: true, school: true, degree: true, startYear: true, endYear: true } },
        certifications: { orderBy: [{ year: { sort: "desc", nulls: "last" } }, { id: "desc" }], select: { id: true, name: true, issuer: true, year: true, credentialUrl: true, skills: true } },
        languages: { orderBy: { code: "asc" }, select: { code: true, level: true } },
        portfolio: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, title: true, url: true, description: true, imageFileId: true } },
      },
    });
    return row;
  },

  addExperience(actor, raw) {
    return addWith(db, actor, ExperienceInputSchema, raw, SECTION_LIMITS.experiences, (tx, profileId) => tx.profileExperience.count({ where: { profileId } }), async (tx, profileId, data) =>
      (await tx.profileExperience.create({ data: { ...data, profileId }, select: { id: true } })).id,
    );
  },

  addEducation(actor, raw) {
    return addWith(db, actor, EducationInputSchema, raw, SECTION_LIMITS.educations, (tx, profileId) => tx.profileEducation.count({ where: { profileId } }), async (tx, profileId, data) =>
      (await tx.profileEducation.create({ data: { ...data, profileId }, select: { id: true } })).id,
    );
  },

  addCertification(actor, raw) {
    return addWith(db, actor, CertificationInputSchema, raw, SECTION_LIMITS.certifications, (tx, profileId) => tx.profileCertification.count({ where: { profileId } }), async (tx, profileId, data) =>
      (await tx.profileCertification.create({ data: { ...data, profileId }, select: { id: true } })).id,
    );
  },

  addPortfolioItem(actor, raw, imageFileId = null) {
    if (imageFileId !== null && !UUID.test(imageFileId)) return Promise.resolve({ kind: "invalid" });
    return addWith(db, actor, PortfolioInputSchema, raw, SECTION_LIMITS.portfolio, (tx, profileId) => tx.portfolioItem.count({ where: { profileId } }), async (tx, profileId, data) => {
      // L'image doit être un fichier de l'acteur, de cet usage, et ne servir à aucune autre réalisation.
      if (imageFileId !== null && (await tx.storedFile.count({ where: { id: imageFileId, ownerId: actor.userId, kind: "portfolio_image", portfolioOf: null } })) === 0) return null;
      return (await tx.portfolioItem.create({ data: { ...data, profileId, imageFileId }, select: { id: true } })).id;
    });
  },

  async setLanguage(actor, raw) {
    const parsed = LanguageInputSchema.safeParse(raw);
    if (!parsed.success) return { kind: "invalid" };
    const { code, level } = parsed.data;
    return db.$transaction(async (tx): Promise<SectionWriteResult> => {
      const profileId = await lockProfile(tx, actor);
      if (profileId === null) return { kind: "absent" };
      const exists = (await tx.profileLanguage.count({ where: { profileId, code } })) > 0;
      if (!exists && (await tx.profileLanguage.count({ where: { profileId } })) >= SECTION_LIMITS.languages) return { kind: "limit" };
      await tx.profileLanguage.upsert({ where: { profileId_code: { profileId, code } }, create: { profileId, code, level }, update: { level } });
      return { kind: "added", id: code };
    });
  },

  async removeLanguage(actor, code) {
    const { count } = await db.profileLanguage.deleteMany({ where: { code, profile: { userId: actor.userId } } });
    return count > 0;
  },

  async remove(actor, section, id) {
    if (!UUID.test(id)) return { removed: false, fileIds: [] };
    const mine = { id, profile: { userId: actor.userId } };
    if (section === "experiences") return { removed: (await db.profileExperience.deleteMany({ where: mine })).count > 0, fileIds: [] };
    if (section === "educations") return { removed: (await db.profileEducation.deleteMany({ where: mine })).count > 0, fileIds: [] };
    if (section === "certifications") return { removed: (await db.profileCertification.deleteMany({ where: mine })).count > 0, fileIds: [] };
    return db.$transaction(async (tx) => {
      const item = await tx.portfolioItem.findFirst({ where: mine, select: { imageFileId: true } });
      if (item === null) return { removed: false, fileIds: [] };
      await tx.portfolioItem.delete({ where: { id } });
      if (item.imageFileId === null) return { removed: true, fileIds: [] };
      await tx.storedFile.deleteMany({ where: { id: item.imageFileId, ownerId: actor.userId } });
      return { removed: true, fileIds: [item.imageFileId] };
    });
  },

  async confirmAvailability(actor, now) {
    const { count } = await db.freelanceProfile.updateMany({ where: { userId: actor.userId }, data: { availabilityAt: now } });
    return count === 0 ? null : now;
  },

  async setPhoto(actor, fileId) {
    if (!UUID.test(fileId)) return { kind: "absent" };
    return db.$transaction(async (tx) => {
      const profileId = await lockProfile(tx, actor);
      if (profileId === null) return { kind: "absent" as const };
      if ((await tx.storedFile.count({ where: { id: fileId, ownerId: actor.userId, kind: "photo" } })) === 0) return { kind: "absent" as const };
      const before = await tx.freelanceProfile.findUnique({ where: { id: profileId }, select: { photoFileId: true } });
      const previousFileId = before?.photoFileId ?? null;
      await tx.freelanceProfile.update({ where: { id: profileId }, data: { photoFileId: fileId } });
      if (previousFileId !== null && previousFileId !== fileId) await tx.storedFile.deleteMany({ where: { id: previousFileId, ownerId: actor.userId } });
      return { kind: "set" as const, previousFileId: previousFileId === fileId ? null : previousFileId };
    });
  },

  async removePhoto(actor) {
    return db.$transaction(async (tx) => {
      const profileId = await lockProfile(tx, actor);
      if (profileId === null) return null;
      const before = await tx.freelanceProfile.findUnique({ where: { id: profileId }, select: { photoFileId: true } });
      const fileId = before?.photoFileId ?? null;
      if (fileId === null) return null;
      await tx.freelanceProfile.update({ where: { id: profileId }, data: { photoFileId: null } });
      await tx.storedFile.deleteMany({ where: { id: fileId, ownerId: actor.userId } });
      return fileId;
    });
  },
});
