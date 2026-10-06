import type { Db } from "./client";
import type { WorkMode } from "./generated/enums";
import { publicName } from "./public-profiles";
import { skillKey } from "./skills";

/*
 * Pages métiers (une par compétence) : les missions ouvertes et les profils publiés qui la portent. Une page n'existe
 * que si du contenu réel la remplit — au moins MIN_REAL_ITEMS éléments, missions et profils confondus. En deçà, ce
 * serait une page vide générée pour le référencement : elle répond « absente », et n'entre pas dans le sitemap.
 *
 * L'ordre des profils est celui de leur dernière mise à jour de disponibilité : un fait daté, jamais un classement.
 */

export const MIN_REAL_ITEMS = 2;
const MAX_ITEMS = 20;

export interface SkillPage {
  readonly key: string;
  readonly label: string;
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: WorkMode; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
}

export interface SkillPages {
  page(key: string): Promise<SkillPage | null>;
  listForSitemap(): Promise<readonly { readonly key: string }[]>;
}

const KEY = /^[a-z0-9+#-]{1,60}$/;

export const skillPages = (db: Db): SkillPages => ({
  async page(raw) {
    const key = skillKey(raw);
    if (!KEY.test(key) || key !== raw) return null;
    const skill = await db.skill.findUnique({ where: { key }, select: { id: true, label: true } });
    if (skill === null) return null;
    const [jobs, people] = await Promise.all([
      db.jobPost.findMany({
        where: { status: "open", skills: { some: { skillId: skill.id } } },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: MAX_ITEMS,
        select: { id: true, title: true, workMode: true, city: true, organisation: { select: { name: true } } },
      }),
      db.freelanceProfile.findMany({
        where: { visibility: { not: "private" }, slug: { not: null }, skills: { some: { skillId: skill.id } } },
        orderBy: [{ availabilityAt: "desc" }, { id: "desc" }],
        take: MAX_ITEMS,
        select: { slug: true, reference: true, visibility: true, headline: true, city: true, user: { select: { displayName: true } } },
      }),
    ]);
    const missions = jobs.map((j) => ({ id: j.id, title: j.title, organisationName: j.organisation.name, workMode: j.workMode, city: j.city }));
    const profiles = people.flatMap((p) =>
      p.slug === null || p.headline === null || p.city === null
        ? []
        : [{ slug: p.slug, reference: p.reference, displayName: publicName(p.visibility, p.user.displayName), headline: p.headline, city: p.city }],
    );
    if (missions.length + profiles.length < MIN_REAL_ITEMS) return null;
    return { key, label: skill.label, missions, profiles };
  },

  async listForSitemap() {
    const skills = await db.skill.findMany({
      select: {
        key: true,
        _count: {
          select: {
            jobPosts: { where: { jobPost: { status: "open" } } },
            freelancers: { where: { profile: { visibility: { not: "private" }, slug: { not: null } } } },
          },
        },
      },
      take: 5000,
    });
    return skills.filter((s) => s._count.jobPosts + s._count.freelancers >= MIN_REAL_ITEMS).map((s) => ({ key: s.key }));
  },
});
