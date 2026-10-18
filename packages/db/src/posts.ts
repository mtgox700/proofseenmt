import { z } from "zod";
import type { Db } from "./client";
import { linkProblem, MAX_POSTS_PER_DAY, POST_BODY_MAX, PostInputSchema, SHARE_COMMENT_MAX, textProblem, type PostInput, type TextProblem } from "./community-input";
import { notifyCommunity, postOwners } from "./community-notify";
import { resolveSpeaker, type SpeakerChoice } from "./community-speaker";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { LISTED_POST } from "./public-visibility";

/*
 * Écrire dans la communauté (C22) : publier, partager, modifier, supprimer.
 *
 * - On publie au nom de son profil publié ou d'une entreprise dont on est membre (`community-speaker.ts`).
 * - Le texte et le lien passent le filtre des coordonnées : refusés, pas seulement signalés, puisqu'ils sont publics.
 * - Dix publications au plus par personne sur 24 heures, partages compris, comptées sous verrou du compte : deux envois
 *   simultanés ne passent pas tous deux sous la limite.
 * - Une image est un fichier `post_image` de l'auteur, et seulement sous un profil nominatif ou une entreprise.
 * - Modifier ou supprimer : la personne qui a écrit, ou un propriétaire ou administrateur de l'entreprise au nom de qui
 *   elle a écrit. Supprimer vide le texte, retire le lien et l'image (dont le fichier est rendu pour être effacé du
 *   disque) ; la ligne part pour de bon 30 jours plus tard, ses commentaires et réactions avec elle.
 */

export type WriteProblem =
  | { readonly kind: "speaker" }
  | { readonly kind: "text"; readonly problem: TextProblem }
  | { readonly kind: "link"; readonly problem: "invalid" | "contact" }
  | { readonly kind: "image" }
  | { readonly kind: "limit" };

export type CreatePostResult = { readonly kind: "created"; readonly id: string } | WriteProblem;
export type SharePostResult = { readonly kind: "created"; readonly id: string } | { readonly kind: "absent" } | WriteProblem;
type ContentProblem = Extract<WriteProblem, { readonly kind: "text" | "link" }>;
export type EditPostResult = { readonly kind: "edited" } | { readonly kind: "absent" } | ContentProblem;
export interface RemovePostResult {
  readonly removed: boolean;
  /** Fichiers supprimés avec la publication : à effacer du disque. */
  readonly fileIds: readonly string[];
}

export interface Posts {
  create(actor: Actor, as: SpeakerChoice, input: PostInput, now: Date): Promise<CreatePostResult>;
  /** Reprend une publication publique, avec un commentaire facultatif ; un partage d'un partage reprend l'original. */
  share(actor: Actor, as: SpeakerChoice, postId: string, comment: string, now: Date): Promise<SharePostResult>;
  edit(actor: Actor, postId: string, input: Pick<PostInput, "body" | "linkUrl">, now: Date): Promise<EditPostResult>;
  remove(actor: Actor, postId: string, now: Date): Promise<RemovePostResult>;
}

const Uuid = z.uuid();
const DAY_MS = 86_400_000;

/** La personne a écrit cette publication, ou administre l'entreprise au nom de qui elle est écrite. */
export const MANAGEABLE_BY = (userId: string): Prisma.PostWhereInput => ({
  OR: [
    { authorUserId: userId },
    { profile: { is: { userId } } },
    { organisation: { is: { members: { some: { userId, role: { in: ["owner", "admin"] } } } } } },
  ],
});

/** Sous verrou du compte : publications des 24 dernières heures, partages et publications supprimées compris. */
const underDailyCap = async (tx: Prisma.TransactionClient, actor: Actor, now: Date): Promise<boolean> => {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
  const recent = await tx.post.count({ where: { authorUserId: actor.userId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } });
  return recent < MAX_POSTS_PER_DAY;
};

/** Le texte et le lien d'une publication, relus ; un problème, ou les valeurs à écrire. */
const checkContent = (body: string, rawLink: string | null): { readonly body: string; readonly linkUrl: string | null } | ContentProblem => {
  const text = textProblem(body, POST_BODY_MAX);
  if (text !== null) return { kind: "text", problem: text };
  if (rawLink === null) return { body, linkUrl: null };
  const link = linkProblem(rawLink);
  if (link !== null) return { kind: "link", problem: link };
  return { body, linkUrl: new URL(rawLink).toString() };
};

const isProblem = (value: object): value is ContentProblem => "kind" in value;

export const posts = (db: Db): Posts => ({
  async create(actor, as, raw, now) {
    const parsed = PostInputSchema.safeParse(raw);
    if (!parsed.success) return { kind: "text", problem: "long" };
    const input = parsed.data;
    const content = checkContent(input.body, input.linkUrl);
    if (isProblem(content)) return content;
    return db.$transaction(async (tx): Promise<CreatePostResult> => {
      const speaker = await resolveSpeaker(tx, actor, as);
      if (speaker === null) return { kind: "speaker" };
      if (input.imageFileId !== null) {
        if (!speaker.mayShowImage) return { kind: "image" };
        const file = await tx.storedFile.count({ where: { id: input.imageFileId, ownerId: actor.userId, kind: "post_image", postOf: { is: null } } });
        if (file === 0) return { kind: "image" };
      }
      if (!(await underDailyCap(tx, actor, now))) return { kind: "limit" };
      const created = await tx.post.create({
        data: {
          authorUserId: actor.userId,
          profileId: speaker.profileId,
          organisationId: speaker.organisationId,
          body: content.body,
          linkUrl: content.linkUrl,
          imageFileId: input.imageFileId,
          visibility: input.visibility,
          createdAt: now,
        },
        select: { id: true },
      });
      return { kind: "created", id: created.id };
    });
  },

  async share(actor, as, postId, rawComment, now) {
    if (!Uuid.safeParse(postId).success) return { kind: "absent" };
    const comment = rawComment.trim();
    const text = textProblem(comment, SHARE_COMMENT_MAX, true);
    if (text !== null) return { kind: "text", problem: text };
    return db.$transaction(async (tx): Promise<SharePostResult> => {
      const target = await tx.post.findFirst({ where: { AND: [{ id: postId, visibility: "public" }, LISTED_POST] }, select: { id: true, sharedPostId: true } });
      if (target === null) return { kind: "absent" };
      const originalId = target.sharedPostId ?? target.id;
      const original = await tx.post.findFirst({ where: { AND: [{ id: originalId, visibility: "public", sharedPostId: null }, LISTED_POST] }, select: { id: true } });
      if (original === null) return { kind: "absent" };
      const speaker = await resolveSpeaker(tx, actor, as);
      if (speaker === null) return { kind: "speaker" };
      if (!(await underDailyCap(tx, actor, now))) return { kind: "limit" };
      const created = await tx.post.create({
        data: { authorUserId: actor.userId, profileId: speaker.profileId, organisationId: speaker.organisationId, body: comment, sharedPostId: original.id, visibility: "public", createdAt: now },
        select: { id: true },
      });
      await notifyCommunity(tx, await postOwners(tx, original.id), actor.userId, "post_share", { postId: original.id });
      return { kind: "created", id: created.id };
    });
  },

  async edit(actor, postId, raw, now) {
    if (!Uuid.safeParse(postId).success) return { kind: "absent" };
    const parsed = PostInputSchema.pick({ body: true, linkUrl: true }).safeParse(raw);
    if (!parsed.success) return { kind: "text", problem: "long" };
    const existing = await db.post.findFirst({ where: { AND: [{ id: postId, deletedAt: null }, MANAGEABLE_BY(actor.userId)] }, select: { sharedPostId: true } });
    if (existing === null) return { kind: "absent" };
    // Un partage garde son seul commentaire, qui peut être vide ; une publication garde un texte et peut changer de lien.
    if (existing.sharedPostId !== null) {
      const text = textProblem(parsed.data.body, SHARE_COMMENT_MAX, true);
      if (text !== null) return { kind: "text", problem: text };
      const { count } = await db.post.updateMany({ where: { id: postId, deletedAt: null }, data: { body: parsed.data.body, editedAt: now } });
      return count === 1 ? { kind: "edited" } : { kind: "absent" };
    }
    const content = checkContent(parsed.data.body, parsed.data.linkUrl);
    if (isProblem(content)) return content;
    const { count } = await db.post.updateMany({ where: { id: postId, deletedAt: null }, data: { body: content.body, linkUrl: content.linkUrl, editedAt: now } });
    return count === 1 ? { kind: "edited" } : { kind: "absent" };
  },

  async remove(actor, postId, now) {
    if (!Uuid.safeParse(postId).success) return { removed: false, fileIds: [] };
    return db.$transaction(async (tx): Promise<RemovePostResult> => {
      const post = await tx.post.findFirst({ where: { AND: [{ id: postId, deletedAt: null }, MANAGEABLE_BY(actor.userId)] }, select: { id: true, imageFileId: true } });
      if (post === null) return { removed: false, fileIds: [] };
      await tx.post.update({ where: { id: post.id }, data: { deletedAt: now, body: "", linkUrl: null, imageFileId: null } });
      if (post.imageFileId === null) return { removed: true, fileIds: [] };
      await tx.storedFile.deleteMany({ where: { id: post.imageFileId, kind: "post_image" } });
      return { removed: true, fileIds: [post.imageFileId] };
    });
  },
});
