import type { Db } from "./client";

/*
 * Limiteur de débit partagé : le compteur vit en base, donc il tient sur plusieurs instances du site, ce que le compteur
 * en mémoire ne faisait pas (chaque instance avait le sien, et la limite réelle était multipliée par leur nombre).
 *
 * Fenêtre fixe : simple, et l'incrément est une seule instruction atomique — deux requêtes simultanées ne peuvent pas lire
 * la même valeur et passer toutes les deux. La clé est fournie déjà hachée par l'appelant (HMAC de l'IP) : aucune adresse
 * IP n'entre en base.
 */

export interface RateLimitRule {
  readonly windowMs: number;
  readonly max: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Début de la prochaine fenêtre : ce que l'on renvoie dans `Retry-After`. */
  readonly resetAt: Date;
}

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule, now: Date): Promise<RateLimitDecision>;
  /** Supprime les fenêtres terminées avant `before` ; rend le nombre de lignes supprimées. */
  purge(before: Date): Promise<number>;
}

const KEY = /^[A-Za-z0-9:_-]{1,200}$/;

export const rateLimiter = (db: Db): RateLimiter => ({
  async hit(key, rule, now) {
    if (!KEY.test(key)) throw new Error("clé de limitation invalide");
    if (!Number.isInteger(rule.windowMs) || rule.windowMs <= 0 || !Number.isInteger(rule.max) || rule.max <= 0) {
      throw new Error("règle de limitation invalide");
    }
    const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0]?.count ?? Number.POSITIVE_INFINITY);
    return {
      allowed: count <= rule.max,
      remaining: Math.max(0, rule.max - count),
      resetAt: new Date(windowStart.getTime() + rule.windowMs),
    };
  },

  async purge(before) {
    const { count } = await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: before } } });
    return count;
  },
});
