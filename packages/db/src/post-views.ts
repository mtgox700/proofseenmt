import type { Db } from "./client";
import { REACTION_KINDS } from "./community-input";
import { authorView, SPEAKER_SELECT, type AuthorView } from "./community-speaker";
import type { Prisma } from "./generated/client";
import type { PostReactionKind, PostVisibility } from "./generated/enums";
import type { Actor } from "./messaging";
import { MANAGEABLE_BY } from "./posts";
import { LISTED_COMMENT, LISTED_POST } from "./public-visibility";

/*
 * Ce qu'un écran ou une page montre d'une publication (C22). Les nombres de réactions, de commentaires et de partages
 * sont publics ; les impressions et les vues ne sont lues que par qui répond de la publication. Une image ne se montre
 * que sous un profil nominatif ou une entreprise. Aucun nom de compte : le locuteur est un profil ou une entreprise.
 */

export interface PostCounts {
  readonly reactions: Readonly<Record<PostReactionKind, number>>;
  readonly comments: number;
  readonly shares: number;
}

export interface PostAudience {
  readonly impressions: number;
  readonly views: number;
}

/** La publication d'origine d'un partage, telle qu'elle se montre à l'intérieur du partage. */
export interface SharedOriginal {
  readonly id: string;
  readonly author: AuthorView;
  readonly body: string;
  readonly linkUrl: string | null;
  readonly imageFileId: string | null;
  readonly createdAt: Date;
}

export interface PostView {
  readonly id: string;
  readonly author: AuthorView;
  readonly body: string;
  readonly linkUrl: string | null;
  readonly imageFileId: string | null;
  readonly visibility: PostVisibility;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  /** Un partage : l'original, ou `"unavailable"` s'il n'est plus visible ; `null` pour une publication. */
  readonly shared: SharedOriginal | "unavailable" | null;
  readonly counts: PostCounts;
  /** Pour la personne connectée seulement. */
  readonly myReaction: PostReactionKind | null;
  /** La personne connectée peut modifier ou supprimer cette publication. */
  readonly manageable: boolean;
  /** Le motif d'un masque posé par un opérateur, montré à qui répond de la publication. */
  readonly moderationReason: string | null;
  /** Impressions et vues, à qui répond de la publication seulement. */
  readonly audience: PostAudience | null;
  /** La personne connectée suit déjà ce locuteur, ou c'est elle-même (profil ou entreprise dont elle est membre). */
  readonly followingAuthor: boolean;
  readonly ownAuthor: boolean;
}

export const POST_SELECT = {
  id: true,
  authorUserId: true,
  body: true,
  linkUrl: true,
  imageFileId: true,
  visibility: true,
  createdAt: true,
  editedAt: true,
  moderationReason: true,
  sharedPostId: true,
  ...SPEAKER_SELECT,
} as const;

export type PostRow = Prisma.PostGetPayload<{ select: typeof POST_SELECT }>;

const emptyReactions = (): Record<PostReactionKind, number> => Object.fromEntries(REACTION_KINDS.map((k) => [k, 0])) as Record<PostReactionKind, number>;

/** Le texte brut d'un Markdown simple, sur une ligne, pour un extrait (sitemap, llms.txt, sections des pages publiques). */
export const plainExcerpt = (body: string, max = 160): string => {
  const text = body.replace(/[#*_`>~[\]()!|]/g, " ").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

interface ViewerContext {
  readonly reactions: ReadonlyMap<string, PostReactionKind>;
  readonly manageable: ReadonlySet<string>;
  readonly audience: ReadonlyMap<string, PostAudience>;
  readonly followedProfiles: ReadonlySet<string>;
  readonly followedOrganisations: ReadonlySet<string>;
  readonly ownProfiles: ReadonlySet<string>;
  readonly ownOrganisations: ReadonlySet<string>;
}

const NO_VIEWER: ViewerContext = {
  reactions: new Map(),
  manageable: new Set(),
  audience: new Map(),
  followedProfiles: new Set(),
  followedOrganisations: new Set(),
  ownProfiles: new Set(),
  ownOrganisations: new Set(),
};

const viewerContext = async (db: Db, viewer: Actor, rows: readonly PostRow[]): Promise<ViewerContext> => {
  const ids = rows.map((r) => r.id);
  const [reactions, manageable, profileFollows, companyFollows, memberships, profile] = await Promise.all([
    db.postReaction.findMany({ where: { userId: viewer.userId, postId: { in: ids } }, select: { postId: true, kind: true } }),
    db.post.findMany({ where: { AND: [{ id: { in: ids } }, MANAGEABLE_BY(viewer.userId)] }, select: { id: true } }),
    db.profileFollow.findMany({ where: { userId: viewer.userId }, select: { profileId: true } }),
    db.companyFollow.findMany({ where: { userId: viewer.userId }, select: { organisationId: true } }),
    db.membership.findMany({ where: { userId: viewer.userId }, select: { organisationId: true } }),
    db.freelanceProfile.findUnique({ where: { userId: viewer.userId }, select: { id: true } }),
  ]);
  const managed = manageable.map((m) => m.id);
  const sums = managed.length === 0 ? [] : await db.postStatDay.groupBy({ by: ["postId"], where: { postId: { in: managed } }, _sum: { impressions: true, views: true } });
  return {
    reactions: new Map(reactions.map((r) => [r.postId, r.kind])),
    manageable: new Set(managed),
    audience: new Map(managed.map((id) => {
      const sum = sums.find((s) => s.postId === id)?._sum;
      return [id, { impressions: sum?.impressions ?? 0, views: sum?.views ?? 0 }];
    })),
    followedProfiles: new Set(profileFollows.map((f) => f.profileId)),
    followedOrganisations: new Set(companyFollows.map((f) => f.organisationId)),
    ownProfiles: new Set(profile === null ? [] : [profile.id]),
    ownOrganisations: new Set(memberships.map((m) => m.organisationId)),
  };
};

const countsOf = async (db: Db, ids: readonly string[]): Promise<ReadonlyMap<string, PostCounts>> => {
  const [reactions, comments, shares] = await Promise.all([
    db.postReaction.groupBy({ by: ["postId", "kind"], where: { postId: { in: [...ids] } }, _count: { _all: true } }),
    db.postComment.groupBy({ by: ["postId"], where: { AND: [{ postId: { in: [...ids] } }, LISTED_COMMENT] }, _count: { _all: true } }),
    db.post.groupBy({ by: ["sharedPostId"], where: { AND: [{ sharedPostId: { in: [...ids] }, visibility: "public" }, LISTED_POST] }, _count: { _all: true } }),
  ]);
  return new Map(ids.map((id) => {
    const byKind = emptyReactions();
    for (const r of reactions) if (r.postId === id) byKind[r.kind] = r._count._all;
    return [id, { reactions: byKind, comments: comments.find((c) => c.postId === id)?._count._all ?? 0, shares: shares.find((s) => s.sharedPostId === id)?._count._all ?? 0 }];
  }));
};

const originalsOf = async (db: Db, rows: readonly PostRow[]): Promise<ReadonlyMap<string, SharedOriginal>> => {
  const ids = [...new Set(rows.flatMap((r) => (r.sharedPostId === null ? [] : [r.sharedPostId])))];
  if (ids.length === 0) return new Map();
  const found = await db.post.findMany({ where: { AND: [{ id: { in: ids }, visibility: "public" }, LISTED_POST] }, select: POST_SELECT });
  return new Map(found.flatMap((o) => {
    const author = authorView(o);
    return author === null ? [] : [[o.id, { id: o.id, author, body: o.body, linkUrl: o.linkUrl, imageFileId: author.mayShowImage ? o.imageFileId : null, createdAt: o.createdAt }]];
  }));
};

/** Les vues de ces publications, dans leur ordre, pour `viewer` (ou un visiteur anonyme, `null`). */
export const assemblePosts = async (db: Db, viewer: Actor | null, rows: readonly PostRow[]): Promise<readonly PostView[]> => {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [counts, originals, context] = await Promise.all([countsOf(db, ids), originalsOf(db, rows), viewer === null ? NO_VIEWER : viewerContext(db, viewer, rows)]);
  return rows.flatMap((row): PostView[] => {
    const author = authorView(row);
    if (author === null) return [];
    const manageable = context.manageable.has(row.id);
    const ownAuthor = (author.profileId !== null && context.ownProfiles.has(author.profileId)) || (author.organisationId !== null && context.ownOrganisations.has(author.organisationId));
    const following = (author.profileId !== null && context.followedProfiles.has(author.profileId)) || (author.organisationId !== null && context.followedOrganisations.has(author.organisationId));
    return [{
      id: row.id,
      author,
      body: row.body,
      linkUrl: row.linkUrl,
      imageFileId: author.mayShowImage ? row.imageFileId : null,
      visibility: row.visibility,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      shared: row.sharedPostId === null ? null : (originals.get(row.sharedPostId) ?? "unavailable"),
      counts: counts.get(row.id) ?? { reactions: emptyReactions(), comments: 0, shares: 0 },
      myReaction: context.reactions.get(row.id) ?? null,
      manageable,
      moderationReason: manageable ? row.moderationReason : null,
      audience: context.audience.get(row.id) ?? null,
      followingAuthor: following,
      ownAuthor,
    }];
  });
};
