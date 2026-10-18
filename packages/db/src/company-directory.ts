import { z } from "zod";
import type { Db } from "./client";
import type { ClientKind } from "./generated/enums";
import type { Actor } from "./messaging";
import { companyResponse } from "./missions";
import { LISTED_COMPANY, LISTED_MISSION } from "./public-visibility";
import { foldText } from "./search-text";

/*
 * Annuaire des entreprises (C22) : seulement celles qui ont ouvert une page publique (C16), et jamais celles qu'un
 * opérateur a masquées ou dont plus aucun membre n'est actif (LISTED_COMPANY). Chaque carte ne porte que des faits :
 * ville déclarée, type d'entreprise, SIRET actif au répertoire (avec la date du contrôle), ancienneté sur Proofseen,
 * missions ouvertes, délai médian de réponse (à partir de trois décisions, comme sur la page de l'entreprise).
 *
 * Filtres : ville (sans accents ni casse), type d'entreprise, « recrute en ce moment » (au moins une mission ouverte),
 * SIRET actif. Ordre choisi et affiché : nom (A→Z), page ouverte le plus récemment, ou nombre de missions ouvertes.
 *
 * Volume borné : on lit au plus MAX_COMPANIES pages publiques, puis on filtre, compte et trie dans l'application ; le
 * délai de réponse n'est calculé que pour la page affichée.
 */

export const COMPANY_SORTS = ["name", "recent", "missions"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export const COMPANY_PAGE_SIZE = 24;
const MAX_COMPANIES = 2000;
const MAX_CITY_VALUES = 12;

const KINDS = ["startup", "scaleup", "grand_groupe", "eti", "pme", "secteur_public", "editeur_logiciel", "esn", "association"] as const satisfies readonly ClientKind[];

export const CompanySearchSchema = z.object({
  city: z.string().trim().max(120).default(""),
  kind: z.enum(KINDS).optional(),
  hiringOnly: z.boolean().default(false),
  registryActiveOnly: z.boolean().default(false),
  sort: z.enum(COMPANY_SORTS).default("name"),
  page: z.number().int().min(1).max(50).default(1),
});
export type CompanySearch = z.input<typeof CompanySearchSchema>;

export interface CompanyCard {
  readonly organisationId: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly kind: ClientKind;
  readonly registryActiveCheckedAt: Date | null;
  readonly memberSince: Date;
  readonly publicSince: Date;
  readonly openMissions: number;
  readonly response: { readonly medianDays: number; readonly decided: number } | null;
}

export interface CompanyFacets {
  readonly total: number;
  readonly cities: readonly { readonly key: string; readonly label: string; readonly count: number }[];
  readonly kinds: readonly { readonly kind: ClientKind; readonly count: number }[];
  readonly hiring: number;
  readonly registryActive: number;
}

export interface CompanyDirectoryPage {
  readonly items: readonly CompanyCard[];
  readonly hasMore: boolean;
  readonly facets: CompanyFacets;
}

export interface CompanyDirectory {
  page(search: CompanySearch, now?: Date): Promise<CompanyDirectoryPage>;
  /** Les entreprises que l'acteur suit, parmi celles-ci : pour les boutons « Suivre » de l'espace connecté. */
  followed(actor: Actor, organisationIds: readonly string[]): Promise<ReadonlySet<string>>;
  /** Les entreprises dont l'acteur est membre : on ne suit jamais la sienne. */
  memberOf(actor: Actor, organisationIds: readonly string[]): Promise<ReadonlySet<string>>;
}

interface Scanned extends Omit<CompanyCard, "response"> {
  readonly cityKey: string;
}

const scan = async (db: Db): Promise<readonly Scanned[]> => {
  const rows = await db.organisation.findMany({
    where: { publicSince: { not: null }, publicSlug: { not: null }, publicName: { not: null }, ...LISTED_COMPANY },
    orderBy: { publicSlug: "asc" },
    take: MAX_COMPANIES,
    select: {
      id: true,
      publicSlug: true,
      publicName: true,
      publicCity: true,
      kind: true,
      registryStatus: true,
      registryCheckedAt: true,
      createdAt: true,
      publicSince: true,
      _count: { select: { jobPosts: { where: { status: "open", publishedAt: { not: null }, ...LISTED_MISSION } } } },
    },
  });
  return rows.flatMap((r) =>
    r.publicSlug === null || r.publicName === null || r.publicSince === null
      ? []
      : [
          {
            organisationId: r.id,
            slug: r.publicSlug,
            name: r.publicName,
            city: r.publicCity,
            cityKey: r.publicCity === null ? "" : foldText(r.publicCity).trim(),
            kind: r.kind,
            registryActiveCheckedAt: r.registryStatus === "active" ? r.registryCheckedAt : null,
            memberSince: r.createdAt,
            publicSince: r.publicSince,
            openMissions: r._count.jobPosts,
          },
        ],
  );
};

type Filters = z.output<typeof CompanySearchSchema>;

const keep = (f: Filters, c: Scanned, skip?: "city" | "kind"): boolean =>
  (skip === "city" || f.city === "" || c.cityKey === foldText(f.city).trim()) &&
  (skip === "kind" || f.kind === undefined || c.kind === f.kind) &&
  (!f.hiringOnly || c.openMissions > 0) &&
  (!f.registryActiveOnly || c.registryActiveCheckedAt !== null);

const COMPARE: Readonly<Record<CompanySort, (a: Scanned, b: Scanned) => number>> = {
  name: (a, b) => a.name.localeCompare(b.name, "fr") || a.slug.localeCompare(b.slug),
  recent: (a, b) => b.publicSince.getTime() - a.publicSince.getTime() || a.slug.localeCompare(b.slug),
  missions: (a, b) => b.openMissions - a.openMissions || a.name.localeCompare(b.name, "fr") || a.slug.localeCompare(b.slug),
};

const cityFacet = (rows: readonly Scanned[]): CompanyFacets["cities"] => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    if (r.city === null || r.cityKey === "") continue;
    const current = counts.get(r.cityKey);
    counts.set(r.cityKey, { label: current?.label ?? r.city, count: (current?.count ?? 0) + 1 });
  }
  return [...counts]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, MAX_CITY_VALUES);
};

const kindFacet = (rows: readonly Scanned[]): CompanyFacets["kinds"] =>
  KINDS.map((kind) => ({ kind, count: rows.filter((r) => r.kind === kind).length })).filter((k) => k.count > 0);

const Uuid = z.uuid();
const uuids = (ids: readonly string[]): string[] => ids.filter((id) => Uuid.safeParse(id).success);

export interface CompanyDirectoryOptions {
  /**
   * Durée pendant laquelle la lecture des pages publiques est reprise telle quelle. Elle ne dépend pas des filtres,
   * appliqués ensuite en mémoire : l'annuaire public, sans compte, ne relit pas 2000 entreprises à chaque adresse
   * différente (relecture sécurité C22, recherche B2). Zéro, par défaut : chaque appel relit la base.
   */
  readonly scanCacheMs?: number;
}

const scans = new WeakMap<Db, { readonly at: number; readonly value: Promise<readonly Scanned[]> }>();

const cachedScan = (db: Db, cacheMs: number, now: number): Promise<readonly Scanned[]> => {
  if (cacheMs <= 0) return scan(db);
  const known = scans.get(db);
  if (known !== undefined && now - known.at < cacheMs) return known.value;
  const value = scan(db);
  scans.set(db, { at: now, value });
  // Une lecture en échec n'est pas gardée : la suivante réessaie.
  value.catch(() => scans.delete(db));
  return value;
};

export const companyDirectory = (db: Db, options: CompanyDirectoryOptions = {}): CompanyDirectory => ({
  async page(search, now = new Date()) {
    const f = CompanySearchSchema.parse(search);
    const all = await cachedScan(db, options.scanCacheMs ?? 0, Date.now());
    const matching = all.filter((c) => keep(f, c)).sort(COMPARE[f.sort]);
    const start = (f.page - 1) * COMPANY_PAGE_SIZE;
    const shown = matching.slice(start, start + COMPANY_PAGE_SIZE);
    const responses = await Promise.all(shown.map((c) => companyResponse(db, c.organisationId, now)));
    const items = shown.map(({ cityKey: _key, ...c }, i) => ({ ...c, response: responses[i] ?? null }));
    return {
      items,
      hasMore: matching.length > start + COMPANY_PAGE_SIZE,
      facets: {
        total: matching.length,
        cities: cityFacet(all.filter((c) => keep(f, c, "city"))),
        kinds: kindFacet(all.filter((c) => keep(f, c, "kind"))),
        hiring: matching.filter((c) => c.openMissions > 0).length,
        registryActive: matching.filter((c) => c.registryActiveCheckedAt !== null).length,
      },
    };
  },

  async followed(actor, organisationIds) {
    const ids = uuids(organisationIds);
    if (ids.length === 0) return new Set();
    const rows = await db.companyFollow.findMany({ where: { userId: actor.userId, organisationId: { in: ids } }, select: { organisationId: true } });
    return new Set(rows.map((r) => r.organisationId));
  },

  async memberOf(actor, organisationIds) {
    const ids = uuids(organisationIds);
    if (ids.length === 0) return new Set();
    const rows = await db.membership.findMany({ where: { userId: actor.userId, organisationId: { in: ids } }, select: { organisationId: true } });
    return new Set(rows.map((r) => r.organisationId));
  },
});
