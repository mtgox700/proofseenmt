import { CONTACT_NOTE, ORDERING_NOTE, PublicProfileSchema, searchProfiles, type PublicProfile, type SearchCriteria } from "@proofseen/profiles";
import { z } from "zod";

/*
 * What an assistant may ask Proofseen (ARCHITECTURE_ANONYME §2, contrainte 7). Read-only, pseudonymous, and free of any
 * score: the connector returns what a visitor reads on the page plus the URL, in a published order. Every answer ends
 * with the contact route, because the whole point is that the company reaches the freelancer through Proofseen.
 */

export const CatalogueSchema = z.object({
  version: z.literal(1),
  contact: z.url(),
  profiles: z.array(PublicProfileSchema.extend({ url: z.url() })),
});
export type Catalogue = z.infer<typeof CatalogueSchema>;

export const searchInput = {
  skills: z.array(z.string().min(1)).max(10).optional().describe("Compétences exigées, toutes présentes (ex. TypeScript, Kafka)"),
  area: z.string().min(2).max(80).optional().describe("Zone recherchée (ex. Paris, Lyon, remote)"),
  availableOnly: z.boolean().optional().describe("Ne garder que les profils disponibles"),
  maxRate: z.number().int().positive().optional().describe("Budget maximum par jour, en euros"),
  limit: z.number().int().min(1).max(50).optional().describe("Nombre de profils à renvoyer (20 par défaut)"),
};

export interface ToolResult {
  readonly content: { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean | undefined;
  /** The MCP protocol allows extra fields; the SDK types require the index signature. */
  readonly [key: string]: unknown;
}

const asText = (payload: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

const publicView = (profile: PublicProfile & { url: string }) => ({
  id: profile.id,
  handle: profile.handle,
  headline: profile.headline.fr,
  seniority: profile.seniority,
  area: profile.area,
  skills: profile.skills,
  sectors: profile.sectors,
  availability: profile.availability,
  dayRateEur: profile.rate === null ? null : { min: profile.rate.min, max: profile.rate.max },
  verifiedMissions: profile.verifiedMissions,
  // Le détail des missions est ce qu'un assistant peut réellement citer ; un compteur ne cite rien.
  missions: profile.missions.map((m) => ({
    clientKind: m.clientKind,
    role: m.role.fr,
    durationMonths: m.durationMonths,
    achievements: m.achievements.map((a) => a.fr),
    stack: m.stack,
    verifiedAt: m.verifiedAt,
    evidence: m.evidence,
  })),
  summary: profile.summary.fr,
  url: profile.url,
});

/** Search: deterministic filters, published ordering, no score — and the contact route in every answer. */
export const searchTool = (catalogue: Catalogue, args: SearchCriteria & { readonly limit?: number | undefined }): ToolResult => {
  const results = searchProfiles(catalogue.profiles, args, args.limit ?? 20);
  // The catalogue already carries the published absolute URL; the query layer only knows relative paths.
  const withUrl = results.map((result) => catalogue.profiles.find((p) => p.id === result.id)!);
  return asText({
    matched: withUrl.length,
    ordering: ORDERING_NOTE.fr,
    contact: catalogue.contact,
    note: CONTACT_NOTE.fr,
    profiles: withUrl.map(publicView),
  });
};

/** One profile by its public identifier. An unknown id is an explicit error, never an empty answer. */
export const getProfileTool = (catalogue: Catalogue, id: string): ToolResult => {
  const profile = catalogue.profiles.find((p) => p.id.toUpperCase() === id.toUpperCase().trim());
  if (profile === undefined) {
    return { content: [{ type: "text", text: `Aucun profil ${id} dans le catalogue Proofseen.` }], isError: true };
  }
  return asText({ profile: publicView(profile), contact: catalogue.contact, note: CONTACT_NOTE.fr });
};

/** How to reach a freelancer: always through Proofseen, and the connector says why. */
export const contactTool = (catalogue: Catalogue, id: string | undefined): ToolResult =>
  asText({
    contact: catalogue.contact,
    profileId: id ?? null,
    howItWorks: [
      "La demande est transmise au freelance par Proofseen.",
      "Le freelance reste anonyme tant qu'il n'a pas accepté.",
      "L'identité réelle est communiquée avant tout engagement, une fois l'accord donné.",
    ],
    note: CONTACT_NOTE.fr,
  });
