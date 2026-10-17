import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { LANGUAGE_CODES, MAX_LANGUAGE_FILTERS } from "./profile-section-schemas";
import { skillKey } from "./skills";
import { dayDate, daysEnding, isDay, parisDay, retentionStart } from "./stat-days";

/*
 * Comptage de l'audience des profils, sans pistage (RGPD) : des totaux par profil et par jour, rien sur la personne qui
 * regarde. Un visiteur est reconnu le temps d'une journée par une empreinte (HMAC de son adresse et de son navigateur
 * sous une clé du jour, calculée par le site) : ni l'adresse ni le navigateur n'arrivent ici, et l'empreinte part dès le
 * lendemain. La base refuse d'ailleurs toute empreinte qui n'a pas la forme d'un HMAC tronqué.
 *
 * Le propriétaire du profil ne se compte pas lui-même ; un profil privé ne compte rien. Chaque écriture est une seule
 * instruction SQL, idempotente pour un même visiteur dans la journée : deux requêtes simultanées ne comptent qu'une fois.
 *
 * Un profil ne prend pas plus de MAX_SIGHTINGS_PER_PROFILE_DAY empreintes par jour (revue de sécurité vague 3, M4) :
 * au-delà, plus rien n'est compté pour lui ce jour-là. Un script qui ferait varier son empreinte ne remplit donc pas la
 * table, et le site limite en plus le débit d'écriture par adresse.
 */

export const APPEARANCE_SCOPES = ["search", "directory"] as const;
export type AppearanceScope = (typeof APPEARANCE_SCOPES)[number];

/** Filtres gardés par profil et par jour : les plus fréquents, vingt au plus. */
export const MAX_KEYWORDS_PER_DAY = 20;
/** Une page de résultats en montre cinquante au plus. */
const MAX_REFERENCES = 50;
/** Dix compétences, une ville et trois langues : les filtres que la recherche accepte. */
const MAX_SEARCH_KEYWORDS = 11 + MAX_LANGUAGE_FILTERS;
/** Empreintes gardées par profil et par jour, toutes portées confondues ; bien au-delà de l'audience d'un profil réel. */
export const MAX_SIGHTINGS_PER_PROFILE_DAY = 5_000;

const ViewerHashSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
const ReferenceSchema = z.string().regex(/^FR-[A-Z0-9]{5}$/);
const KEYWORD = /^[a-z0-9+#-]{1,60}$/;

export interface StatKeyword {
  readonly kind: "skill" | "city" | "language";
  readonly keyword: string;
}

/** Celui qui regarde, le temps d'une journée. */
export interface Sighting {
  /** Jour de Paris, « AAAA-MM-JJ ». */
  readonly day: string;
  /** Empreinte du jour, jamais l'adresse elle-même. */
  readonly viewerHash: string;
  /** Identifiant Clerk d'une personne connectée : son propre profil ne compte pas. */
  readonly viewerClerkId: string | null;
}

/**
 * Les filtres d'une recherche, sous leur forme normalisée, sans doublon. Une phrase libre n'en fait jamais partie. Une
 * langue compte par son code de la liste fermée, sans le niveau demandé.
 */
export const statKeywords = (filters: { readonly skills?: readonly string[]; readonly city?: string | null; readonly languages?: readonly string[] }): readonly StatKeyword[] => {
  const skills = [...new Set((filters.skills ?? []).map(skillKey))].filter((key) => KEYWORD.test(key));
  const city = filters.city === undefined || filters.city === null ? "" : skillKey(filters.city);
  const languages = [...new Set(filters.languages ?? [])].filter((code) => (LANGUAGE_CODES as readonly string[]).includes(code)).slice(0, MAX_LANGUAGE_FILTERS);
  return [
    ...skills.map((keyword) => ({ kind: "skill" as const, keyword })),
    ...(KEYWORD.test(city) ? [{ kind: "city" as const, keyword: city }] : []),
    ...languages.map((keyword) => ({ kind: "language" as const, keyword })),
  ].slice(0, MAX_SEARCH_KEYWORDS);
};

const validSighting = (s: Sighting): boolean => isDay(s.day) && ViewerHashSchema.safeParse(s.viewerHash).success;

const references = (raw: readonly string[]): string[] => [...new Set(raw)].filter((r) => ReferenceSchema.safeParse(r).success).slice(0, MAX_REFERENCES);

const COUNTS: Readonly<Record<"view" | AppearanceScope, readonly [number, number, number]>> = {
  view: [1, 0, 0],
  search: [0, 1, 0],
  directory: [0, 0, 1],
};

/**
 * Une instruction : les profils publiés visés (sauf celui de la personne connectée), l'empreinte notée pour chacun, et
 * le compteur du jour augmenté pour les seuls profils où elle est nouvelle. Rend le nombre de profils comptés.
 */
const count = async (db: Db | Prisma.TransactionClient, scope: "view" | AppearanceScope, refs: readonly string[], s: Sighting, cap: number): Promise<number> => {
  const [views, search, directory] = COUNTS[scope];
  const day = s.day;
  return db.$executeRaw`
    WITH target AS (
      SELECT p."id" FROM "FreelanceProfile" p JOIN "User" u ON u."id" = p."userId"
      WHERE p."reference" = ANY(${refs}::text[]) AND p."visibility" <> 'private'
        AND (${s.viewerClerkId}::text IS NULL OR u."clerkId" <> ${s.viewerClerkId}::text)
        AND (SELECT count(*) FROM "ProfileStatSeen" c WHERE c."day" = ${day}::date AND c."profileId" = p."id") < ${cap}
    ), fresh AS (
      INSERT INTO "ProfileStatSeen" ("day", "profileId", "scope", "viewerHash")
      SELECT ${day}::date, t."id", ${scope}, ${s.viewerHash} FROM target t
      ON CONFLICT DO NOTHING
      RETURNING "profileId"
    )
    INSERT INTO "ProfileStatDay" ("profileId", "day", "views", "searchAppearances", "directoryAppearances")
    SELECT f."profileId", ${day}::date, ${views}::int, ${search}::int, ${directory}::int FROM fresh f
    ON CONFLICT ("profileId", "day") DO UPDATE SET
      "views" = "ProfileStatDay"."views" + EXCLUDED."views",
      "searchAppearances" = "ProfileStatDay"."searchAppearances" + EXCLUDED."searchAppearances",
      "directoryAppearances" = "ProfileStatDay"."directoryAppearances" + EXCLUDED."directoryAppearances"`;
};

/**
 * Les filtres qui ont fait apparaître ces profils : un filtre ne compte qu'une fois par visiteur, profil et jour. Un
 * filtre nouveau du jour n'entre que si le profil en a moins de vingt ce jour-là (la purge quotidienne ne garde ensuite
 * que les vingt plus fréquents).
 */
const countKeywords = async (db: Db, refs: readonly string[], keywords: readonly StatKeyword[], s: Sighting, cap: number): Promise<number> => {
  if (keywords.length === 0) return 0;
  const day = s.day;
  const scopes = keywords.map((k) => `keyword:${k.kind}:${k.keyword}`);
  return db.$executeRaw`
    WITH target AS (
      SELECT p."id" FROM "FreelanceProfile" p JOIN "User" u ON u."id" = p."userId"
      WHERE p."reference" = ANY(${refs}::text[]) AND p."visibility" <> 'private'
        AND (${s.viewerClerkId}::text IS NULL OR u."clerkId" <> ${s.viewerClerkId}::text)
        AND (SELECT count(*) FROM "ProfileStatSeen" c WHERE c."day" = ${day}::date AND c."profileId" = p."id") < ${cap}
    ), fresh AS (
      INSERT INTO "ProfileStatSeen" ("day", "profileId", "scope", "viewerHash")
      SELECT ${day}::date, t."id", k.scope, ${s.viewerHash} FROM target t CROSS JOIN unnest(${scopes}::text[]) AS k(scope)
      ON CONFLICT DO NOTHING
      RETURNING "profileId", "scope"
    ), parsed AS (
      SELECT f."profileId", split_part(f."scope", ':', 2) AS kind, split_part(f."scope", ':', 3) AS keyword FROM fresh f
    )
    INSERT INTO "ProfileStatKeyword" ("profileId", "day", "kind", "keyword", "appearances")
    SELECT n."profileId", ${day}::date, n.kind::"StatKeywordKind", n.keyword, 1 FROM parsed n
    WHERE EXISTS (
        SELECT 1 FROM "ProfileStatKeyword" e
        WHERE e."profileId" = n."profileId" AND e."day" = ${day}::date AND e."kind"::text = n.kind AND e."keyword" = n.keyword)
      OR (SELECT count(*) FROM "ProfileStatKeyword" c WHERE c."profileId" = n."profileId" AND c."day" = ${day}::date) < ${MAX_KEYWORDS_PER_DAY}
    ON CONFLICT ("profileId", "day", "kind", "keyword") DO UPDATE SET "appearances" = "ProfileStatKeyword"."appearances" + 1`;
};

/** Un ajout à une liste d'entreprise, compté dans la transaction de l'ajout. */
export const countListAdd = async (tx: Prisma.TransactionClient, profileId: string, now: Date): Promise<void> => {
  await tx.$executeRaw`
    INSERT INTO "ProfileStatDay" ("profileId", "day", "listAdds") VALUES (${profileId}::uuid, ${parisDay(now)}::date, 1)
    ON CONFLICT ("profileId", "day") DO UPDATE SET "listAdds" = "ProfileStatDay"."listAdds" + 1`;
};

export interface AudienceStats {
  /** Une vue de la page publique. `true` si elle a compté (premier passage du visiteur ce jour-là). */
  recordView(reference: string, sighting: Sighting): Promise<boolean>;
  /** Des profils montrés par une page de résultats ; rend le nombre de profils comptés. */
  recordAppearances(scope: AppearanceScope, references: readonly string[], sighting: Sighting, keywords?: readonly StatKeyword[]): Promise<number>;
  /** Une recherche de freelances lancée par un membre de l'entreprise ; rien si l'acteur n'en est pas membre. */
  recordSearch(actor: Actor, organisationId: string, day: string): Promise<void>;
  /** Supprime les empreintes des jours passés ; rend le nombre de lignes supprimées. */
  purgeSightings(today: string): Promise<number>;
}

export interface AudienceStatsOptions {
  /** Plafond d'empreintes par profil et par jour ; MAX_SIGHTINGS_PER_PROFILE_DAY par défaut. */
  readonly maxSightingsPerProfileDay?: number;
}

export const audienceStats = (db: Db, options: AudienceStatsOptions = {}): AudienceStats => {
  const cap = options.maxSightingsPerProfileDay ?? MAX_SIGHTINGS_PER_PROFILE_DAY;
  return {
    async recordView(reference, sighting) {
      const refs = references([reference]);
      if (refs.length === 0 || !validSighting(sighting)) return false;
      return (await count(db, "view", refs, sighting, cap)) > 0;
    },

    async recordAppearances(scope, raw, sighting, keywords = []) {
      const refs = references(raw);
      if (refs.length === 0 || !validSighting(sighting) || !APPEARANCE_SCOPES.includes(scope)) return 0;
      const counted = await count(db, scope, refs, sighting, cap);
      // Les filtres ne viennent que de la recherche des entreprises : l'annuaire public n'en garde aucun.
      if (scope === "search") await countKeywords(db, refs, keywords.filter((k) => KEYWORD.test(k.keyword)).slice(0, MAX_SEARCH_KEYWORDS), sighting, cap);
      return counted;
    },

    async recordSearch(actor, organisationId, day) {
      if (!z.uuid().safeParse(organisationId).success || !isDay(day)) return;
      await db.$executeRaw`
        INSERT INTO "OrganisationStatDay" ("organisationId", "day", "searches")
        SELECT m."organisationId", ${day}::date, 1 FROM "Membership" m
        WHERE m."organisationId" = ${organisationId}::uuid AND m."userId" = ${actor.userId}::uuid
        ON CONFLICT ("organisationId", "day") DO UPDATE SET "searches" = "OrganisationStatDay"."searches" + 1`;
    },

    async purgeSightings(today) {
      if (!isDay(today)) return 0;
      const { count: removed } = await db.profileStatSeen.deleteMany({ where: { day: { lt: dayDate(today) } } });
      return removed;
    },
  };
};

/** Jours dont les filtres gardés sont ramenés aux vingt plus fréquents à chaque purge : hier et aujourd'hui. */
const TRIMMED_DAYS = 2;

/**
 * La purge quotidienne : compteurs au-delà de treize mois, empreintes des jours passés, et filtres en surnombre des
 * derniers jours (deux requêtes simultanées peuvent dépasser de peu la limite de vingt).
 */
export const purgeAudience = async (db: Db, now: Date): Promise<{ readonly stats: number; readonly sightings: number }> => {
  const today = parisDay(now);
  const cutoff = dayDate(retentionStart(today));
  const trimFrom = daysEnding(today, TRIMMED_DAYS)[0] ?? today;
  const [days, keywords, organisations, sightings, trimmed] = await Promise.all([
    db.profileStatDay.deleteMany({ where: { day: { lt: cutoff } } }),
    db.profileStatKeyword.deleteMany({ where: { day: { lt: cutoff } } }),
    db.organisationStatDay.deleteMany({ where: { day: { lt: cutoff } } }),
    db.profileStatSeen.deleteMany({ where: { day: { lt: dayDate(today) } } }),
    db.$executeRaw`
      DELETE FROM "ProfileStatKeyword" k USING (
        SELECT "profileId", "day", "kind", "keyword",
               row_number() OVER (PARTITION BY "profileId", "day" ORDER BY "appearances" DESC, "kind", "keyword") AS n
        FROM "ProfileStatKeyword" WHERE "day" >= ${trimFrom}::date
      ) extra
      WHERE extra.n > ${MAX_KEYWORDS_PER_DAY} AND k."profileId" = extra."profileId" AND k."day" = extra."day"
        AND k."kind" = extra."kind" AND k."keyword" = extra."keyword"`,
  ]);
  return { stats: days.count + keywords.count + organisations.count + trimmed, sightings: sightings.count };
};
