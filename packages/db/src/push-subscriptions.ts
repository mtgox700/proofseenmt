import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";

/*
 * Abonnements aux notifications poussées (C20) : un par appareil qui a accepté de les recevoir.
 *
 * Le serveur appellera l'adresse d'envoi de l'abonnement : elle doit donc appartenir à un service de notifications
 * connu (Google, Mozilla, Apple, Microsoft), en https, sans identifiants ni port. Une adresse quelconque ferait du
 * serveur un relais vers le réseau interne.
 *
 * L'adresse d'envoi est propre à un navigateur : si une autre personne s'y connecte et s'abonne, l'abonnement passe à
 * elle, et l'ancien compte ne reçoit plus rien sur cet appareil. Dix appareils au plus par compte : le onzième remplace
 * celui qui n'a plus servi depuis le plus longtemps.
 */

export const MAX_PUSH_SUBSCRIPTIONS = 10;

/** Les services de notifications des navigateurs : hôte exact, ou suffixe quand le service répartit ses serveurs. */
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"] as const;
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"] as const;

const MAX_ENDPOINT_LENGTH = 1024;
const MAX_LABEL_LENGTH = 60;

/** L'adresse d'envoi normalisée, si elle est celle d'un service de notifications connu ; `null` sinon. */
export const pushEndpoint = (raw: string): string | null => {
  if (raw.length > MAX_ENDPOINT_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "" || url.hash !== "") return null;
  const host = url.hostname.toLowerCase();
  const known = (PUSH_HOSTS as readonly string[]).includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
  if (!known || url.pathname.length < 2) return null;
  return url.href.length > MAX_ENDPOINT_LENGTH ? null : url.href;
};

/** Ce que rend `PushSubscription.toJSON()` dans le navigateur ; les autres champs sont ignorés. */
export const PushSubscriptionInputSchema = z.object({
  endpoint: z
    .string()
    .max(MAX_ENDPOINT_LENGTH)
    .transform((raw, ctx) => {
      const endpoint = pushEndpoint(raw);
      if (endpoint === null) {
        ctx.addIssue({ code: "custom", message: "service de notifications inconnu" });
        return z.NEVER;
      }
      return endpoint;
    }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{86,88}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{21,24}={0,2}$/),
  }),
});

export const PushEndpointSchema = z.object({ endpoint: PushSubscriptionInputSchema.shape.endpoint });

export type PushSubscriptionInput = z.output<typeof PushSubscriptionInputSchema>;

export type SubscribeResult = "subscribed" | "invalid" | "suspended" | "absent";

export interface PushSubscriptions {
  /** Enregistre (ou rafraîchit) l'abonnement de cet appareil pour l'acteur. `label` : « Chrome · Android », au plus. */
  subscribe(actor: Actor, input: unknown, label: string | null): Promise<SubscribeResult>;
  /** Retire l'abonnement de cet appareil, s'il est à l'acteur ; `false` sinon. */
  unsubscribe(actor: Actor, input: unknown): Promise<boolean>;
  /** Le nombre d'appareils abonnés de l'acteur. */
  count(actor: Actor): Promise<number>;
}

const Uuid = z.uuid();

const shortLabel = (label: string | null): string | null => {
  const trimmed = label?.trim() ?? "";
  return trimmed === "" ? null : trimmed.slice(0, MAX_LABEL_LENGTH);
};

const lastUse = (s: { readonly lastSuccessAt: Date | null; readonly createdAt: Date }): number => (s.lastSuccessAt ?? s.createdAt).getTime();

export const pushSubscriptions = (db: Db): PushSubscriptions => ({
  async subscribe(actor, input, label) {
    const parsed = PushSubscriptionInputSchema.safeParse(input);
    if (!parsed.success || !Uuid.safeParse(actor.userId).success) return "invalid";
    const { endpoint, keys } = parsed.data;
    return db.$transaction(async (tx): Promise<SubscribeResult> => {
      // Sous verrou du compte : deux appareils abonnés en même temps ne dépassent pas le plafond, et une suspension
      // posée en même temps passe avant ou après, jamais entre la vérification et l'écriture.
      const [user] = await tx.$queryRaw<{ suspendedAt: Date | null }[]>`
        SELECT "suspendedAt" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
      if (user === undefined) return "absent";
      if (user.suspendedAt !== null) return "suspended";
      // Cet appareil était abonné pour un autre compte : il ne recevra plus que celles de l'acteur.
      await tx.pushSubscription.deleteMany({ where: { endpoint, userId: { not: actor.userId } } });
      const mine = await tx.pushSubscription.findMany({ where: { userId: actor.userId }, select: { id: true, endpoint: true, lastSuccessAt: true, createdAt: true } });
      const others = mine.filter((s) => s.endpoint !== endpoint);
      const excess = others.length - (MAX_PUSH_SUBSCRIPTIONS - 1);
      if (excess > 0) {
        const oldest = [...others].sort((a, b) => lastUse(a) - lastUse(b)).slice(0, excess);
        await tx.pushSubscription.deleteMany({ where: { id: { in: oldest.map((s) => s.id) } } });
      }
      const data = { p256dh: keys.p256dh, auth: keys.auth, userAgent: shortLabel(label), failures: 0 };
      await tx.pushSubscription.upsert({ where: { endpoint }, create: { userId: actor.userId, endpoint, ...data }, update: data });
      return "subscribed";
    });
  },

  async unsubscribe(actor, input) {
    const parsed = PushEndpointSchema.safeParse(input);
    if (!parsed.success || !Uuid.safeParse(actor.userId).success) return false;
    const { count } = await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: actor.userId } });
    return count > 0;
  },

  count(actor) {
    if (!Uuid.safeParse(actor.userId).success) return Promise.resolve(0);
    return db.pushSubscription.count({ where: { userId: actor.userId } });
  },
});

/** Export RGPD : le service (hôte de l'adresse d'envoi), jamais l'adresse complète ni les clés de l'appareil. */
export const exportPushSubscriptions = async (db: Db, userId: string) => {
  const rows = await db.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { endpoint: true, userAgent: true, createdAt: true, lastSuccessAt: true, failures: true },
  });
  return rows.map(({ endpoint, ...rest }) => ({ service: new URL(endpoint).hostname, ...rest }));
};
