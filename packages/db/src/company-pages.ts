import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import { urlCarriesContact } from "./contact-urls";
import { isUniqueViolation } from "./errors";
import type { WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { companyResponse } from "./missions";
import { LISTED_COMPANY, LISTED_MISSION } from "./public-visibility";

/*
 * Pages publiques d'entreprise, seulement pour celles qui l'ont choisi. Une entreprise qui n'a rien activé n'a pas de
 * page : l'adresse répond « absente » et n'entre dans aucun sitemap. Les propriétaires et administrateurs activent,
 * modifient et désactivent la page ; l'adresse (le « slug ») est tirée du nom public une fois, puis ne change plus.
 *
 * La page ne montre que des faits : l'entreprise active au répertoire officiel (avec la date du contrôle), son
 * ancienneté sur Proofseen, ses missions ouvertes, son délai médian de réponse. Le texte de présentation est le sien,
 * sans coordonnées ; le site déclaré est un lien, pas un fait vérifié.
 */

const Uuid = z.uuid();
const MAX_MISSIONS = 50;
const MAX_SITEMAP_COMPANIES = 25_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_TRIES = 20;

const noContact = (value: string): boolean => !containsDirectContact(value);

const WebsiteSchema = z
  .string()
  .trim()
  .max(200)
  .transform((raw, ctx) => {
    try {
      const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || !url.hostname.includes(".")) throw new TypeError("adresse refusée");
      // Lue en entier, requête comprise : un site ne doit pas être un lien de messagerie, d'agenda ou un raccourci.
      if (urlCarriesContact(url.href)) {
        ctx.addIssue({ code: "custom", message: NO_CONTACT });
        return z.NEVER;
      }
      return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
    } catch {
      ctx.addIssue({ code: "custom", message: "adresse https attendue" });
      return z.NEVER;
    }
  })
  .pipe(z.string().max(200));

export const CompanyPublicInputSchema = z.object({
  publicName: z.string().trim().min(2).max(200).refine(noContact, { message: NO_CONTACT }),
  description: z.string().trim().max(1000).refine(noContact, { message: NO_CONTACT }).nullable().default(null),
  website: WebsiteSchema.nullable().default(null),
  city: z.string().trim().min(1).max(120).refine(noContact, { message: NO_CONTACT }).nullable().default(null),
});

export type CompanyPublicInput = z.input<typeof CompanyPublicInputSchema>;

export interface CompanyPublicSettings {
  readonly enabled: boolean;
  readonly slug: string | null;
  readonly publicName: string;
  readonly description: string | null;
  readonly website: string | null;
  readonly city: string | null;
  readonly canEdit: boolean;
}

export interface CompanyPageView {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly website: string | null;
  readonly city: string | null;
  readonly memberSince: Date;
  readonly registryActiveCheckedAt: Date | null;
  readonly response: { readonly medianDays: number; readonly decided: number } | null;
  readonly missions: readonly { readonly id: string; readonly title: string; readonly workMode: WorkMode; readonly city: string | null; readonly publishedAt: Date }[];
  readonly generatedAt: Date;
}

export type SavePublicResult = { readonly kind: "saved"; readonly slug: string } | { readonly kind: "forbidden" };

export interface CompanyPages {
  /** Les réglages de la page, pour les membres ; `null` pour les autres. */
  settings(actor: Actor, organisationId: string): Promise<CompanyPublicSettings | null>;
  /** Active ou met à jour la page (propriétaires et administrateurs). */
  publish(actor: Actor, organisationId: string, input: CompanyPublicInput, now: Date): Promise<SavePublicResult>;
  /** Retire la page ; l'adresse est gardée pour une réactivation. */
  unpublish(actor: Actor, organisationId: string): Promise<boolean>;
  page(slug: string, now?: Date): Promise<CompanyPageView | null>;
  listForSitemap(): Promise<readonly { readonly slug: string; readonly updatedAt: Date }[]>;
}

/** « Société Générale & Fils » → « societe-generale-fils ». */
export const companySlug = (name: string): string => {
  const base = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base === "" ? "entreprise" : base;
};

const isAdmin = async (db: Db, organisationId: string, userId: string): Promise<boolean> =>
  (await db.membership.count({ where: { organisationId, userId, role: { in: ["owner", "admin"] } } })) === 1;

/** Une adresse libre : le nom, puis le nom suivi d'un numéro. */
const freeSlug = async (db: Db, name: string): Promise<string> => {
  const base = companySlug(name);
  for (let i = 1; i <= MAX_SLUG_TRIES; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if ((await db.organisation.count({ where: { publicSlug: candidate } })) === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

export const companyPages = (db: Db): CompanyPages => ({
  async settings(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const membership = await db.membership.findUnique({
      where: { organisationId_userId: { organisationId, userId: actor.userId } },
      select: { role: true, organisation: { select: { name: true, publicSlug: true, publicName: true, publicDescription: true, publicWebsite: true, publicCity: true, publicSince: true } } },
    });
    if (membership === null) return null;
    const o = membership.organisation;
    return {
      enabled: o.publicSince !== null,
      slug: o.publicSlug,
      publicName: o.publicName ?? o.name,
      description: o.publicDescription,
      website: o.publicWebsite,
      city: o.publicCity,
      canEdit: membership.role === "owner" || membership.role === "admin",
    };
  },

  async publish(actor, organisationId, raw, now) {
    if (!Uuid.safeParse(organisationId).success) return { kind: "forbidden" };
    const input = CompanyPublicInputSchema.parse(raw);
    if (!(await isAdmin(db, organisationId, actor.userId))) return { kind: "forbidden" };
    const current = await db.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { publicSlug: true, publicSince: true } });
    const fields = { publicName: input.publicName, publicDescription: input.description === "" ? null : input.description, publicWebsite: input.website, publicCity: input.city, publicSince: current.publicSince ?? now };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = current.publicSlug ?? (await freeSlug(db, input.publicName));
      try {
        await db.organisation.update({ where: { id: organisationId }, data: { ...fields, publicSlug: slug } });
        return { kind: "saved", slug };
      } catch (error) {
        // Une autre entreprise a pris la même adresse entre la lecture et l'écriture : on en cherche une autre.
        if (!isUniqueViolation(error) || current.publicSlug !== null) throw error;
      }
    }
    throw new Error("aucune adresse libre pour la page de l'entreprise");
  },

  async unpublish(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return false;
    if (!(await isAdmin(db, organisationId, actor.userId))) return false;
    await db.organisation.update({ where: { id: organisationId }, data: { publicSince: null } });
    return true;
  },

  async page(slug, now = new Date()) {
    if (!SLUG.test(slug) || slug.length > 80) return null;
    const org = await db.organisation.findFirst({
      where: { publicSlug: slug, publicSince: { not: null }, ...LISTED_COMPANY },
      select: { id: true, publicName: true, publicDescription: true, publicWebsite: true, publicCity: true, createdAt: true, registryStatus: true, registryCheckedAt: true },
    });
    if (org === null || org.publicName === null) return null;
    const [missions, response] = await Promise.all([
      db.jobPost.findMany({
        where: { organisationId: org.id, status: "open", ...LISTED_MISSION, publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: MAX_MISSIONS,
        select: { id: true, title: true, workMode: true, city: true, publishedAt: true },
      }),
      companyResponse(db, org.id, now),
    ]);
    return {
      slug,
      name: org.publicName,
      description: org.publicDescription,
      website: org.publicWebsite,
      city: org.publicCity,
      memberSince: org.createdAt,
      registryActiveCheckedAt: org.registryStatus === "active" ? org.registryCheckedAt : null,
      response,
      missions: missions.flatMap((m) => (m.publishedAt === null ? [] : [{ ...m, publishedAt: m.publishedAt }])),
      generatedAt: now,
    };
  },

  async listForSitemap() {
    const rows = await db.organisation.findMany({
      where: { publicSince: { not: null }, publicSlug: { not: null }, publicName: { not: null }, ...LISTED_COMPANY },
      orderBy: { publicSlug: "asc" },
      take: MAX_SITEMAP_COMPANIES,
      select: { publicSlug: true, updatedAt: true },
    });
    return rows.flatMap((r) => (r.publicSlug === null ? [] : [{ slug: r.publicSlug, updatedAt: r.updatedAt }]));
  },
});
