import { z } from "zod";

/*
 * Identity Firewall (ARCHITECTURE_ANONYME §3). Two schemas that never meet: what the freelancer gives us, and what the
 * world may read. Nothing renders the private side — it is not a discipline, it is the type system plus `findLeaks`,
 * which re-reads every produced page. One hit fails the build.
 */

const isoDate = z.iso.date();

export const PrivateIdentitySchema = z.object({
  /** Public identifier of the profile: the only value shared by both sides. */
  profileId: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/),
  realName: z.string().min(2).max(120),
  email: z.email(),
  phone: z.string().min(6).max(30).nullable(),
  /** LinkedIn, GitHub, personal site… never published, never used as `sameAs`. */
  links: z.array(z.url()).max(20),
  legalId: z.string().min(4).max(40).nullable(),
  /** Publication is impossible without a recorded, revocable consent (CONFORMITE, RGPD). */
  consent: z.object({ givenAt: isoDate, scope: z.literal("public_pseudonymous_profile") }),
});
export type PrivateIdentity = z.infer<typeof PrivateIdentitySchema>;

export const LocalizedSchema = z.object({ fr: z.string().min(1).max(2_000), en: z.string().min(1).max(2_000) });

export const PublicProfileSchema = z.object({
  id: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/),
  /** Pseudonym shown everywhere: "Ayoub.H". Google allows a handle as `name` when it is the only identifier used. */
  handle: z.string().regex(/^[\p{L}][\p{L}\p{M}'-]*\.?[\p{L}]?$/u).max(40),
  headline: LocalizedSchema,
  seniority: z.string().min(1).max(40),
  /** An area, never a precise address. */
  area: z.string().min(2).max(80),
  skills: z.array(z.string().min(1).max(40)).min(1).max(20),
  sectors: z.array(z.string().min(1).max(60)).max(6),
  availability: z.object({ status: z.enum(["available", "available_from", "unavailable"]), from: isoDate.nullable().default(null), updatedAt: isoDate }),
  rate: z.object({ min: z.number().int().positive(), max: z.number().int().positive(), currency: z.literal("EUR"), unit: z.literal("day") }).nullable(),
  verifiedMissions: z.number().int().nonnegative(),
  summary: LocalizedSchema,
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/** Every private value, normalised for comparison: lowercase, no accents, no punctuation, no spaces. */
const normalise = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const needles = (identity: PrivateIdentity): { readonly field: string; readonly needle: string }[] => {
  const host = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };
  return [
    { field: "realName", needle: identity.realName },
    { field: "email", needle: identity.email },
    ...(identity.phone === null ? [] : [{ field: "phone", needle: identity.phone }]),
    ...(identity.legalId === null ? [] : [{ field: "legalId", needle: identity.legalId }]),
    // A link leaks as a whole URL, as a path ("/in/ayoub-hammoudi") or as "host + handle" in running text.
    ...identity.links.flatMap((url) => [
      { field: "link", needle: url },
      { field: "link", needle: `${host(url)}${new URL(url).pathname}` },
    ]),
  ].filter((n) => normalise(n.needle).length >= 6);
};

/**
 * Looks for the private identity inside any rendered text. Case, accents, spacing and punctuation are ignored, so
 * "AYOUB HAMMOUDI", "Ayoub-Hammoudi" and "ayoub hammoudi" are all caught. Returns the fields found, without duplicates.
 */
export const findLeaks = (identity: PrivateIdentity, rendered: string): string[] => {
  const haystack = normalise(rendered);
  const found = needles(identity)
    .filter(({ needle }) => haystack.includes(normalise(needle)))
    .map(({ field }) => field);
  return [...new Set(found)];
};

export class IdentityLeakError extends Error {
  constructor(public readonly fields: readonly string[]) {
    super(`fuite d'identité : ${fields.join(", ")} apparaît dans le contenu public (Identity Firewall)`);
    this.name = "IdentityLeakError";
  }
}

/**
 * The only way to obtain a `PublicProfile`: the draft is validated, then re-read against the private identity. The
 * private object is never copied into the result — only `profileId` is shared, and it is public by design.
 */
export const buildPublicProfile = (identity: PrivateIdentity, draft: unknown): PublicProfile => {
  const early = findLeaks(identity, JSON.stringify(draft)); // avant tout : un brouillon qui porte l'identité est refusé pour CETTE raison
  if (early.length > 0) throw new IdentityLeakError(early);
  const profile = PublicProfileSchema.parse(draft);
  if (profile.id !== identity.profileId) throw new Error(`profil ${profile.id} : l'identifiant ne correspond pas à l'identité privée`);
  const leaks = findLeaks(identity, JSON.stringify(profile));
  if (leaks.length > 0) throw new IdentityLeakError(leaks);
  return profile;
};

/** Last line of defence: every produced file is re-read against every private identity before anything is written. */
export const assertNoLeaks = (identities: readonly PrivateIdentity[], files: readonly { readonly path: string; readonly content: string }[]): void => {
  const hits = files.flatMap((file) =>
    identities.flatMap((identity) => findLeaks(identity, file.content).map((field) => `${file.path} → ${identity.profileId}.${field}`)),
  );
  if (hits.length > 0) throw new IdentityLeakError(hits);
};
