import { z } from "zod";
import type { Db } from "./client";
import { FEED_PAGE_SIZE } from "./community-input";
import { authorView } from "./community-speaker";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { assemblePosts, plainExcerpt, POST_SELECT, type PostView } from "./post-views";
import { LISTED_POST } from "./public-visibility";

/*
 * Lire la communauté (C22). Le fil est rangé par date de publication, la plus récente d'abord, et rien d'autre : pas
 * d'ordre par engagement, pas de score. L'écran le dit.
 *
 * - « Suivis » : les publications des profils et des entreprises que la personne suit, et les siennes (celles de son
 *   profil, celles de ses entreprises), y compris les siennes masquées, qu'elle voit avec le motif.
 * - « Découvrir » : les publications publiques récentes de tout Proofseen.
 * - Une publication « membres » ne se lit que connecté ; une page publique ne montre que des publications publiques.
 * Le contrôle d'accès est dans la requête : une publication qu'on ne peut pas lire est absente, jamais interdite.
 */

export type FeedTab = "following" | "discover";

export interface FeedPage {
  readonly items: readonly PostView[];
  /** À repasser pour la suite ; `null` quand il n'y en a plus. */
  readonly next: string | null;
}

/** Une publication publique, résumée, pour les pages publiques, le sitemap et llms.txt. */
export interface PostSnippet {
  readonly id: string;
  readonly excerpt: string;
  readonly authorName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PostFeed {
  feed(viewer: Actor, tab: FeedTab, cursor: string | null): Promise<FeedPage>;
  /** Une publication pour une personne connectée (ou `null` pour un visiteur, qui ne lit que les publiques). */
  get(viewer: Actor | null, id: string): Promise<PostView | null>;
  /** Les publications publiques récentes d'un profil (par sa référence) ou d'une entreprise (par l'adresse de sa page). */
  recentFor(owner: { readonly reference: string } | { readonly companySlug: string }, limit?: number): Promise<readonly PostSnippet[]>;
  /** Les publications publiques (hors partages), pour le sitemap et llms.txt, les plus récentes d'abord. */
  listPublic(limit?: number): Promise<readonly PostSnippet[]>;
}

export const MAX_SITEMAP_POSTS = 10_000;
export const RECENT_ON_PAGES = 5;

const Uuid = z.uuid();
const CursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() });

const encodeCursor = (row: { readonly createdAt: Date; readonly id: string }): string =>
  Buffer.from(JSON.stringify({ at: row.createdAt.toISOString(), id: row.id })).toString("base64url");

/** La borne d'une page suivante ; une borne illisible ramène au début, sans erreur. */
const afterCursor = (cursor: string | null): Prisma.PostWhereInput => {
  if (cursor === null || cursor.length > 200) return {};
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (!parsed.success) return {};
    const at = new Date(parsed.data.at);
    return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: parsed.data.id } }] };
  } catch {
    return {};
  }
};

/**
 * Les publications de la personne : son profil, ses entreprises, ce qu'elle a écrit ; jamais supprimées. Une publication
 * masquée par l'opérateur ne reste visible que de son auteur et des administrateurs de l'entreprise, pas de toute
 * l'équipe (relecture sécurité C22, B1).
 */
const mine = (viewer: Actor, organisationIds: readonly string[]): Prisma.PostWhereInput => ({
  deletedAt: null,
  OR: [
    { authorUserId: viewer.userId },
    { profile: { is: { userId: viewer.userId } } },
    ...(organisationIds.length === 0
      ? []
      : [
          {
            organisationId: { in: [...organisationIds] },
            OR: [{ moderatedAt: null }, { organisation: { is: { members: { some: { userId: viewer.userId, role: { in: ["owner" as const, "admin" as const] } } } } } }],
          },
        ]),
  ],
});

const ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];

const snippets = (rows: readonly Prisma.PostGetPayload<{ select: typeof POST_SELECT }>[], author: (row: (typeof rows)[number]) => string): readonly PostSnippet[] =>
  rows.map((row) => ({ id: row.id, excerpt: plainExcerpt(row.body), authorName: author(row), createdAt: row.createdAt, updatedAt: row.editedAt ?? row.createdAt }));

/** Le nom public du locuteur : jamais le nom d'un compte pseudonyme, qui parle sous sa référence. */
const nameOf = (row: Prisma.PostGetPayload<{ select: typeof POST_SELECT }>): string => authorView(row)?.name ?? "";

export const postFeed = (db: Db): PostFeed => ({
  async feed(viewer, tab, cursor) {
    const after = afterCursor(cursor);
    let where: Prisma.PostWhereInput;
    if (tab === "discover") {
      where = { AND: [after, { visibility: "public" }, LISTED_POST] };
    } else {
      const [profiles, companies, memberships] = await Promise.all([
        db.profileFollow.findMany({ where: { userId: viewer.userId }, select: { profileId: true } }),
        db.companyFollow.findMany({ where: { userId: viewer.userId }, select: { organisationId: true } }),
        db.membership.findMany({ where: { userId: viewer.userId }, select: { organisationId: true } }),
      ]);
      const followed: Prisma.PostWhereInput = {
        OR: [{ profileId: { in: profiles.map((p) => p.profileId) } }, { organisationId: { in: companies.map((c) => c.organisationId) } }],
      };
      where = { AND: [after, { OR: [{ AND: [LISTED_POST, followed] }, mine(viewer, memberships.map((m) => m.organisationId))] }] };
    }
    const rows = await db.post.findMany({ where, orderBy: ORDER, take: FEED_PAGE_SIZE + 1, select: POST_SELECT });
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const last = page.at(-1);
    return { items: await assemblePosts(db, viewer, page), next: rows.length > FEED_PAGE_SIZE && last !== undefined ? encodeCursor(last) : null };
  },

  async get(viewer, id) {
    if (!Uuid.safeParse(id).success) return null;
    let where: Prisma.PostWhereInput;
    if (viewer === null) {
      where = { AND: [{ id, visibility: "public" }, LISTED_POST] };
    } else {
      const memberships = await db.membership.findMany({ where: { userId: viewer.userId }, select: { organisationId: true } });
      where = { AND: [{ id }, { OR: [LISTED_POST, mine(viewer, memberships.map((m) => m.organisationId))] }] };
    }
    const row = await db.post.findFirst({ where, select: POST_SELECT });
    if (row === null) return null;
    return (await assemblePosts(db, viewer, [row]))[0] ?? null;
  },

  async recentFor(owner, limit = RECENT_ON_PAGES) {
    const take = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const whose: Prisma.PostWhereInput = "reference" in owner ? { profile: { is: { reference: owner.reference } } } : { organisation: { is: { publicSlug: owner.companySlug } } };
    const rows = await db.post.findMany({ where: { AND: [whose, { visibility: "public", sharedPostId: null }, LISTED_POST] }, orderBy: ORDER, take, select: POST_SELECT });
    return snippets(rows, nameOf);
  },

  async listPublic(limit = MAX_SITEMAP_POSTS) {
    const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_SITEMAP_POSTS);
    const rows = await db.post.findMany({ where: { AND: [{ visibility: "public", sharedPostId: null }, LISTED_POST] }, orderBy: ORDER, take, select: POST_SELECT });
    return snippets(rows, nameOf);
  },
});
