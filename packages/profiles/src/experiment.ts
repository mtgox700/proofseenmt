import type { PublicProfile } from "./identity";
import { contactPath, homePath, intentPath, namedPath, profilePath, LOCALES, type NamedIdentity } from "./render";
import { MIN_PROFILES_PER_INTENT, buildProfilesSite, isThin, type NamedArm, type SiteFile } from "./site";

/*
 * Three-arm test, pre-registered in PIVOT_ANONYME §5: A named, B pseudonymous with the SAME facts, C entry page.
 * This module produces the arms and, above all, the list of what still blocks the publication — the point being that
 * the founder never publishes a test that cannot answer the question.
 *
 * Known limitation, written down rather than hidden (PIVOT_ANONYME §11): A and B describe the same person, so the
 * pseudonymous arm is NOT anonymous during the experiment. The subject is the founder, who consents. Never a client.
 */

/** Days after publication at which the reduced Recruiter Simulator wave runs. */
export const MEASUREMENT_DAYS: readonly number[] = [30, 60];

export const THRESHOLDS = {
  /** Mechanism A is refuted if B is cited in less than this share of the draws where A is cited. */
  armBoverArmA: 1 / 3,
  /** Mechanism B is retained if the entry page is cited in at least this share of the draws on its target JDs. */
  armCcitationRate: 0.05,
} as const;

export interface ExperimentInput {
  readonly profiles: readonly PublicProfile[];
  readonly namedArm: NamedArm;
  /**
   * Slug of the entry page that plays arm C. Absent = **two-arm test**: A named vs B pseudonymous, on the subject's own
   * data only. Arm C needs at least three real profiles, so it waits for consenting freelancers.
   */
  readonly entrySlug?: string | undefined;
  /** ISO date on which the three arms go live — the same day for all three, by construction. */
  readonly publishedAt: string;
  readonly baseUrl: string;
  readonly contactEmail?: string | undefined;
  readonly indexNowKey?: string | undefined;
}

export interface ArmPlan {
  readonly arm: "A" | "B" | "C";
  readonly role: string;
  readonly treatment: string;
  readonly urls: readonly string[];
}

export interface ExperimentManifest {
  readonly version: 1;
  readonly publishedAt: string;
  readonly measurements: readonly { readonly day: number; readonly date: string }[];
  readonly arms: readonly ArmPlan[];
  readonly thresholds: typeof THRESHOLDS;
  readonly limitation: string;
  readonly contact: string;
}

export interface ExperimentPlan {
  readonly files: readonly SiteFile[];
  readonly manifest: ExperimentManifest;
  /** Empty means the test can be published as is. Anything listed makes the result uninterpretable. */
  readonly blockers: readonly string[];
}

const DAY_MS = 86_400_000;

const addDays = (isoDate: string, days: number): string => {
  const base = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base)) throw new Error(`date de publication invalide : ${isoDate}`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
};

const bothLocales = (path: (locale: "fr" | "en") => string, baseUrl: string): string[] =>
  LOCALES.map((locale) => `${baseUrl}${path(locale)}`);

const armsOf = (twin: PublicProfile, identity: NamedIdentity, entrySlug: string | undefined, baseUrl: string): ArmPlan[] => [
  {
    arm: "A",
    role: "Témoin haut",
    treatment: "Identité réelle, sameAs vers les profils externes",
    urls: bothLocales((locale) => namedPath(locale, identity.slug), baseUrl),
  },
  {
    arm: "B",
    role: "Le pivot",
    treatment: "Mêmes faits, pseudonyme et identifiant public, aucun sameAs, aucun lien externe",
    urls: bothLocales((locale) => profilePath(locale, twin.id), baseUrl),
  },
  ...(entrySlug === undefined
    ? []
    : [
        {
          arm: "C" as const,
          role: "Page d'entrée (mécanisme B)",
          treatment: "Page de catégorie listant des profils vérifiés, aucune personne nommée",
          urls: bothLocales((locale) => intentPath(locale, entrySlug), baseUrl),
        },
      ]),
];

/** Everything that would make the measurement unreadable, stated before publication rather than discovered after. */
const blockersOf = (input: ExperimentInput, twin: PublicProfile | undefined, files: readonly SiteFile[]): string[] => {
  const blockers: string[] = [];
  if (twin === undefined) {
    blockers.push(`bras B : aucun profil ${input.namedArm.profileId} dans le lot — les bras A et B doivent porter les mêmes faits`);
    return blockers;
  }
  if (isThin(twin)) {
    blockers.push(`bras B : le profil ${twin.id} est trop mince, il serait publié en noindex et ne pourrait pas être cité`);
  }
  if (input.namedArm.identity.sameAs.length === 0) {
    blockers.push("bras A : aucun sameAs — le témoin haut perd précisément le signal qu'il doit apporter");
  }
  const entrySlug = input.entrySlug;
  if (entrySlug === undefined) return blockers; // test à 2 bras : pas de page d'entrée à vérifier.
  const entryFile = `${intentPath("fr", entrySlug).replace(/^\//, "")}index.html`;
  if (!files.some((file) => file.path === entryFile)) {
    const sharing = input.profiles.filter((p) => p.area.toLowerCase().includes(entrySlug.split("-").at(-1) ?? "")).length;
    blockers.push(
      `bras C : la page d'entrée « ${entrySlug} » n'est pas générée — il faut ${MIN_PROFILES_PER_INTENT} profils partageant compétence et zone (${sharing} candidat(s) sur la zone)`,
    );
  }
  if (!files.some((file) => file.path === "sitemap.xml")) blockers.push("aucun sitemap : les bras ne seraient pas soumissibles");
  return blockers;
};

/** Ce qu'un test à 2 bras ne dit pas : on l'écrit dans le manifeste plutôt que de le laisser deviner. */
export const TWO_ARM_LIMITATION =
  "Test à 2 bras : seul le mécanisme A (fiche individuelle) est mesuré. Le mécanisme B (page d'entrée) n'est ni " +
  "retenu ni réfuté — il demande au moins trois profils réels et consentants, qui n'existent pas encore.";

export const LIMITATION =
  "Les bras A et B décrivent la même personne : pendant l'expérience, le bras pseudonyme n'est pas anonyme. " +
  "Le sujet est le founder, qui y consent. Ce test mesure la mécanique de citation, pas la robustesse de l'anonymat. " +
  "Jamais sur un profil client (PIVOT_ANONYME §11).";

/** Pure: profiles and arms in, files plus the pre-registration record out. Publishes nothing. */
export const planExperiment = (input: ExperimentInput): ExperimentPlan => {
  const twin = input.profiles.find((p) => p.id === input.namedArm.profileId);
  const files = twin === undefined
    ? buildProfilesSite(input.profiles, { baseUrl: input.baseUrl, contactEmail: input.contactEmail, indexNowKey: input.indexNowKey })
    : buildProfilesSite(input.profiles, { baseUrl: input.baseUrl, namedArm: input.namedArm, contactEmail: input.contactEmail, indexNowKey: input.indexNowKey });
  const manifest: ExperimentManifest = {
    version: 1,
    publishedAt: input.publishedAt,
    measurements: MEASUREMENT_DAYS.map((day) => ({ day, date: addDays(input.publishedAt, day) })),
    arms: twin === undefined ? [] : armsOf(twin, input.namedArm.identity, input.entrySlug, input.baseUrl),
    thresholds: THRESHOLDS,
    limitation: input.entrySlug === undefined ? `${LIMITATION} ${TWO_ARM_LIMITATION}` : LIMITATION,
    contact: `${input.baseUrl}${contactPath("fr")}`,
  };
  return { files, manifest, blockers: blockersOf(input, twin, files) };
};

/** The manifest stays off the site on purpose: publishing it would announce the experiment to the engines measured. */
export const MANIFEST_IS_PRIVATE = `Le manifeste n'est pas publié. Il reste hors du dossier du site, à côté des mesures. Accueil : ${homePath("fr")}`;
