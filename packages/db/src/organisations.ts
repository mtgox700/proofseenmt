import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import type { ClientKind, MemberRole } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Entreprises et leurs membres. Celui qui crée l'entreprise en est propriétaire ; propriétaires et administrateurs
 * ajoutent et retirent des membres. Un membre retiré perd l'accès sur-le-champ : toutes les autorisations des autres
 * modules passent par l'appartenance, lue à chaque requête, jamais mise en cache.
 *
 * Il reste toujours au moins un propriétaire : une entreprise sans propriétaire ne pourrait plus être administrée.
 */

const Uuid = z.uuid();

export const OrganisationInputSchema = z.object({
  // Affiché sur chaque mission publique : un nom de domaine y est permis, un moyen de joindre quelqu'un non.
  name: z.string().trim().min(2).max(200).refine((name) => !containsDirectContact(name), { message: NO_CONTACT }),
  kind: z.enum(["startup", "scaleup", "grand_groupe", "eti", "pme", "secteur_public", "editeur_logiciel", "esn", "association"]),
  /** SIRET : 14 chiffres. Sa vérification auprès de l'INSEE viendra avec les contrôles de conformité (C6). */
  siret: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{14}$/))
    .nullable()
    .default(null),
});

export type OrganisationInput = z.input<typeof OrganisationInputSchema>;

export interface OrganisationRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ClientKind;
  readonly siret: string | null;
  readonly role: MemberRole;
}

export interface Organisations {
  create(actor: Actor, input: OrganisationInput): Promise<OrganisationRecord>;
  listMine(actor: Actor): Promise<readonly OrganisationRecord[]>;
  /** Ajoute un utilisateur déjà inscrit, par son adresse. `false` si l'acteur n'administre pas ou si l'adresse est inconnue. */
  addMember(actor: Actor, organisationId: string, email: string, role: Exclude<MemberRole, "owner">): Promise<boolean>;
  /** Retire un membre. Refusé s'il s'agit du dernier propriétaire. */
  removeMember(actor: Actor, organisationId: string, userId: string): Promise<boolean>;
}

const ADMINS: readonly MemberRole[] = ["owner", "admin"];

const isAdmin = async (db: Db, organisationId: string, userId: string): Promise<boolean> =>
  (await db.membership.count({ where: { organisationId, userId, role: { in: [...ADMINS] } } })) === 1;

export const organisations = (db: Db): Organisations => ({
  async create(actor, raw) {
    const input = OrganisationInputSchema.parse(raw);
    const org = await db.organisation.create({
      data: { ...input, members: { create: { userId: actor.userId, role: "owner" } } },
      select: { id: true, name: true, kind: true, siret: true },
    });
    return { ...org, role: "owner" };
  },

  async listMine(actor) {
    const rows = await db.membership.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "asc" },
      select: { role: true, organisation: { select: { id: true, name: true, kind: true, siret: true } } },
    });
    return rows.map((row) => ({ ...row.organisation, role: row.role }));
  },

  async addMember(actor, organisationId, email, role) {
    if (!Uuid.safeParse(organisationId).success) return false;
    if (!(await isAdmin(db, organisationId, actor.userId))) return false;
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (user === null) return false;
    await db.membership.upsert({
      where: { organisationId_userId: { organisationId, userId: user.id } },
      create: { organisationId, userId: user.id, role },
      // Ajouter quelqu'un qui est déjà propriétaire ne le rétrograde pas.
      update: {},
    });
    return true;
  },

  async removeMember(actor, organisationId, userId) {
    if (!Uuid.safeParse(organisationId).success || !Uuid.safeParse(userId).success) return false;
    if (actor.userId !== userId && !(await isAdmin(db, organisationId, actor.userId))) return false;
    return db.$transaction(async (tx) => {
      const target = await tx.membership.findUnique({ where: { organisationId_userId: { organisationId, userId } }, select: { role: true } });
      if (target === null) return false;
      if (target.role === "owner" && (await tx.membership.count({ where: { organisationId, role: "owner" } })) === 1) return false;
      await tx.membership.delete({ where: { organisationId_userId: { organisationId, userId } } });
      return true;
    });
  },
});
