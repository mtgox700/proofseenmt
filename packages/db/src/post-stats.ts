import { z } from "zod";
import type { Sighting } from "./audience-stats";
import type { Db } from "./client";
import { dayDate, isDay, parisDay, retentionStart } from "./stat-days";
import { DELETED_POST_RETENTION_DAYS } from "./community-input";

/*
 * Audience des publications (C22), comptée comme celle des profils (C17), sans pistage : des totaux par publication et
 * par jour de Paris. Un visiteur est reconnu le temps d'une journée par une empreinte (HMAC du jour calculé par le
 * site) ; ni son adresse ni son navigateur n'arrivent ici, et la base refuse toute autre forme d'empreinte.
 *
 * - impression : la publication est montrée dans un fil ; vue : sa page est ouverte (dans l'espace ou en public) ;
 * - l'auteur ne se compte pas : la personne qui a écrit, le titulaire du profil, un membre de l'entreprise ;
 * - une publication supprimée ou masquée ne compte plus rien ;
 * - une instruction SQL par comptage, idempotente pour un même visiteur dans la journée ; au plus
 *   MAX_POST_SIGHTINGS_PER_DAY empreintes par publication et par jour (un script qui ferait varier son empreinte ne
 *   remplit pas la table).
 * Les robots et le préchargement sont écartés par le site avant d'arriver ici.
 */

export const MAX_POST_SIGHTINGS_PER_DAY = 5_000;
/** Une page de fil en montre vingt ; on n'en compte jamais plus de cinquante à la fois. */
const MAX_IDS = 50;

export type PostSightingScope = "impression" | "view";

const ViewerHashSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
const Uuid = z.uuid();

const COUNTS: Readonly<Record<PostSightingScope, readonly [number, number]>> = { impression: [1, 0], view: [0, 1] };

export interface PostStats {
  /** Rend le nombre de publications comptées (premier passage du visiteur ce jour-là). */
  record(scope: PostSightingScope, postIds: readonly string[], sighting: Sighting): Promise<number>;
}

export const postStats = (db: Db, options: { readonly maxSightingsPerDay?: number } = {}): PostStats => {
  const cap = options.maxSightingsPerDay ?? MAX_POST_SIGHTINGS_PER_DAY;
  return {
    async record(scope, rawIds, s) {
      const ids = [...new Set(rawIds)].filter((id) => Uuid.safeParse(id).success).slice(0, MAX_IDS);
      if (ids.length === 0 || !isDay(s.day) || !ViewerHashSchema.safeParse(s.viewerHash).success || !(scope in COUNTS)) return 0;
      const [impressions, views] = COUNTS[scope];
      return db.$executeRaw`
        WITH target AS (
          SELECT p."id" FROM "Post" p
          WHERE p."id" = ANY(${ids}::uuid[]) AND p."deletedAt" IS NULL AND p."moderatedAt" IS NULL
            AND (${s.viewerClerkId}::text IS NULL OR NOT EXISTS (
              SELECT 1 FROM "User" u
              WHERE u."clerkId" = ${s.viewerClerkId}::text AND (
                u."id" = p."authorUserId"
                OR EXISTS (SELECT 1 FROM "FreelanceProfile" f WHERE f."id" = p."profileId" AND f."userId" = u."id")
                OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."organisationId" = p."organisationId" AND m."userId" = u."id"))))
            AND (SELECT count(*) FROM "PostStatSeen" c WHERE c."day" = ${s.day}::date AND c."postId" = p."id") < ${cap}
        ), fresh AS (
          INSERT INTO "PostStatSeen" ("day", "postId", "scope", "viewerHash")
          SELECT ${s.day}::date, t."id", ${scope}, ${s.viewerHash} FROM target t
          ON CONFLICT DO NOTHING
          RETURNING "postId"
        )
        INSERT INTO "PostStatDay" ("postId", "day", "impressions", "views")
        SELECT f."postId", ${s.day}::date, ${impressions}::int, ${views}::int FROM fresh f
        ON CONFLICT ("postId", "day") DO UPDATE SET
          "impressions" = "PostStatDay"."impressions" + EXCLUDED."impressions",
          "views" = "PostStatDay"."views" + EXCLUDED."views"`;
    },
  };
};

/**
 * La purge quotidienne de la communauté : empreintes des jours passés, compteurs au-delà de treize mois, publications
 * supprimées depuis plus de trente jours (leurs commentaires, réactions et partages partent avec elles).
 */
export const purgeCommunity = async (db: Db, now: Date): Promise<{ readonly posts: number; readonly stats: number }> => {
  const today = parisDay(now);
  const [sightings, days, posts] = await Promise.all([
    db.postStatSeen.deleteMany({ where: { day: { lt: dayDate(today) } } }),
    db.postStatDay.deleteMany({ where: { day: { lt: dayDate(retentionStart(today)) } } }),
    db.post.deleteMany({ where: { deletedAt: { lt: new Date(now.getTime() - DELETED_POST_RETENTION_DAYS * 86_400_000) } } }),
  ]);
  return { posts: posts.count, stats: sightings.count + days.count };
};
