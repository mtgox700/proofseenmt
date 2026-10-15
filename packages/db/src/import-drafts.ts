import type { Db } from "./client";
import {
  certificationInput,
  CvDraftSchema,
  draftItemKey,
  educationInput,
  EMPTY_DRAFT,
  experienceInput,
  isEmptyDraft,
  languageInput,
  type CvDraft,
  type DraftSection,
} from "./cv-draft";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { profileSections, type SectionWriteResult } from "./profile-sections";
import { ensureSkills, MAX_SKILLS, uniqueSkills } from "./skills";

/*
 * Le brouillon d'import d'un CV, privé au freelance : un seul par profil, remplacé par un nouvel import. Accepter un
 * élément le retire du brouillon puis l'ajoute au profil par le dépôt de sa section (mêmes validations, mêmes plafonds
 * que la saisie à la main) ; si l'ajout est refusé, l'élément revient dans le brouillon. Le retrait se fait sous
 * verrou du brouillon et contre l'empreinte de l'élément montré à l'écran : un double envoi n'ajoute pas deux fois, et
 * un brouillon changé entre-temps ne fait pas accepter un autre élément.
 */

export type AcceptResult = SectionWriteResult["kind"] | "stale";

export interface ImportDrafts {
  /** Range le brouillon (vide : supprime le brouillon) ; `false` sans profil. */
  save(actor: Actor, draft: CvDraft): Promise<boolean>;
  get(actor: Actor): Promise<CvDraft | null>;
  /** Ajoute au profil l'élément `index` de la section, si son empreinte est toujours `key`. */
  accept(actor: Actor, section: Exclude<DraftSection, "skills">, index: number, key: string): Promise<AcceptResult>;
  /** Ajoute les compétences proposées à celles du profil (30 au plus au total). */
  acceptSkills(actor: Actor): Promise<"added" | "absent" | "stale">;
  dismiss(actor: Actor, section: DraftSection, index: number, key: string): Promise<boolean>;
  discard(actor: Actor): Promise<void>;
}

type Item = CvDraft[DraftSection][number];

const readDraft = (proposal: unknown): CvDraft => {
  const parsed = CvDraftSchema.safeParse(proposal);
  return parsed.success ? parsed.data : EMPTY_DRAFT;
};

const withoutItem = (draft: CvDraft, section: DraftSection, index: number): CvDraft => ({ ...draft, [section]: draft[section].filter((_, i) => i !== index) });

const withItem = (draft: CvDraft, section: DraftSection, index: number, item: Item): CvDraft => {
  const list: readonly Item[] = draft[section];
  return { ...draft, [section]: [...list.slice(0, index), item, ...list.slice(index)] };
};

/** Le brouillon de l'acteur, verrouillé jusqu'à la fin de la transaction. */
const lockDraft = async (tx: Prisma.TransactionClient, actor: Actor): Promise<{ readonly profileId: string; readonly draft: CvDraft } | null> => {
  const rows = await tx.$queryRaw<{ profileId: string; proposal: unknown }[]>`
    SELECT d."profileId", d."proposal" FROM "ProfileImportDraft" d JOIN "FreelanceProfile" p ON p."id" = d."profileId"
    WHERE p."userId" = ${actor.userId}::uuid FOR UPDATE OF d`;
  const row = rows[0];
  return row === undefined ? null : { profileId: row.profileId, draft: readDraft(row.proposal) };
};

const store = async (tx: Prisma.TransactionClient, profileId: string, draft: CvDraft): Promise<void> => {
  if (isEmptyDraft(draft)) await tx.profileImportDraft.deleteMany({ where: { profileId } });
  else await tx.profileImportDraft.update({ where: { profileId }, data: { proposal: draft } });
};

export const importDrafts = (db: Db): ImportDrafts => {
  /** Retire l'élément s'il est encore celui montré ; le rend, ou `null`. */
  const take = (actor: Actor, section: DraftSection, index: number, key: string): Promise<Item | null> =>
    db.$transaction(async (tx) => {
      const locked = await lockDraft(tx, actor);
      const item = locked?.draft[section][index];
      if (locked === null || item === undefined || draftItemKey(item) !== key) return null;
      await store(tx, locked.profileId, withoutItem(locked.draft, section, index));
      return item;
    });

  const putBack = async (actor: Actor, section: DraftSection, index: number, item: Item): Promise<void> => {
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (profile === null) return;
    const current = await db.profileImportDraft.findUnique({ where: { profileId: profile.id }, select: { proposal: true } });
    const draft = withItem(current === null ? EMPTY_DRAFT : readDraft(current.proposal), section, index, item);
    await db.profileImportDraft.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, proposal: draft }, update: { proposal: draft } });
  };

  const add = (actor: Actor, section: Exclude<DraftSection, "skills">, item: Item): Promise<SectionWriteResult> => {
    const sections = profileSections(db);
    if (section === "experiences") return sections.addExperience(actor, experienceInput(item as CvDraft["experiences"][number]));
    if (section === "educations") return sections.addEducation(actor, educationInput(item as CvDraft["educations"][number]));
    if (section === "certifications") return sections.addCertification(actor, certificationInput(item as CvDraft["certifications"][number]));
    return sections.setLanguage(actor, languageInput(item as CvDraft["languages"][number]));
  };

  return {
    async save(actor, draft) {
      const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
      if (profile === null) return false;
      if (isEmptyDraft(draft)) {
        await db.profileImportDraft.deleteMany({ where: { profileId: profile.id } });
        return true;
      }
      await db.profileImportDraft.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, proposal: draft }, update: { proposal: draft, createdAt: new Date() } });
      return true;
    },

    async get(actor) {
      const row = await db.profileImportDraft.findFirst({ where: { profile: { userId: actor.userId } }, select: { proposal: true } });
      return row === null ? null : readDraft(row.proposal);
    },

    async accept(actor, section, index, key) {
      const item = await take(actor, section, index, key);
      if (item === null) return "stale";
      const result = await add(actor, section, item);
      if (result.kind !== "added") await putBack(actor, section, index, item);
      return result.kind;
    },

    async acceptSkills(actor) {
      return db.$transaction(async (tx) => {
        const locked = await lockDraft(tx, actor);
        if (locked === null || locked.draft.skills.length === 0) return "stale";
        const current = await tx.freelanceSkill.findMany({ where: { profileId: locked.profileId }, select: { skill: { select: { label: true } } } });
        const merged = uniqueSkills([...current.map((s) => s.skill.label), ...locked.draft.skills]).slice(0, MAX_SKILLS);
        const skillIds = await ensureSkills(tx, merged.map((s) => s.label));
        await tx.freelanceSkill.createMany({ data: skillIds.map((skillId) => ({ profileId: locked.profileId, skillId })), skipDuplicates: true });
        await store(tx, locked.profileId, { ...locked.draft, skills: [] });
        return "added";
      });
    },

    async dismiss(actor, section, index, key) {
      return (await take(actor, section, index, key)) !== null;
    },

    async discard(actor) {
      await db.profileImportDraft.deleteMany({ where: { profile: { userId: actor.userId } } });
    },
  };
};
