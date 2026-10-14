import {
  assertJdFreeOfIdentity,
  IdentitySchema,
  JobDescriptionSchema,
  OwnedUrlSchema,
  PLACEHOLDER_MARKER,
  type Identity,
  type JobDescription,
} from "@proofseen/core";

/*
 * Ce qu'on mesure, construit à partir du profil tel qu'il est en base au moment de mesurer.
 *
 * L'identité suit la règle de la CLI (`identityFor`) : une seule variante de nom, celle que la personne a donnée — en
 * inventer ferait compter des correspondances qui ne la désignent pas forcément. Seules les adresses **prouvées**
 * entrent : une citation n'est reconnue comme la sienne que par elles.
 *
 * La question posée aux moteurs vient de ce que le profil annonce (titre, compétences, ville, mode de travail), jamais
 * de qui il est : l'offre est contrôlée par `assertJdFreeOfIdentity`, comme une offre d'audit. Un titre qui contient le
 * nom de la personne est écarté plutôt que de laisser le moteur la retrouver parce qu'on la lui a soufflée.
 */

export interface MeasuredProfile {
  readonly reference: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly city: string | null;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly skills: readonly string[];
  readonly verifiedUrls: readonly { readonly url: string; readonly proofMethod: string; readonly verifiedAt: Date }[];
}

export type SubjectRefusal = "no_proven_url" | "nothing_to_ask" | "identity_in_profile";

export interface Subject {
  readonly identity: Identity;
  readonly jobDescription: JobDescription;
}

const MAX_STACK = 30;
const MAX_SKILL_LENGTH = 40;
const BRIEF_SKILLS = 3;
const BRIEF_MAX = 300;
const MODE_LABEL: Readonly<Record<MeasuredProfile["workMode"], string>> = { onsite: "sur site", hybrid: "en hybride", remote: "à distance" };

const clean = (value: string | null): string => (value ?? "").replace(/\s+/g, " ").trim();

const usableSkills = (skills: readonly string[]): string[] =>
  [...new Set(skills.map((skill) => clean(skill)).filter((skill) => skill.length > 0 && skill.length <= MAX_SKILL_LENGTH))].slice(0, MAX_STACK);

/** L'identité mesurée ; `null` sans aucune adresse prouvée utilisable (https, preuve datée). */
export const identityOf = (profile: MeasuredProfile): Identity | null => {
  const ownedUrls = profile.verifiedUrls.flatMap((owned) => {
    const parsed = OwnedUrlSchema.safeParse({ url: owned.url, proofMethod: owned.proofMethod, verifiedAt: owned.verifiedAt.toISOString() });
    return parsed.success ? [parsed.data] : [];
  });
  if (ownedUrls.length === 0) return null;
  const name = clean(profile.displayName);
  return IdentitySchema.parse({
    id: profile.reference,
    displayName: name.length >= 2 ? name.slice(0, 120) : profile.reference,
    nameVariants: [name.length >= 2 ? name.slice(0, 120) : profile.reference],
    // Une ville absente ne se devine pas : le marqueur ne correspond à aucun texte, il ne fabrique aucun rapprochement.
    city: clean(profile.city).slice(0, 80) || PLACEHOLDER_MARKER,
    stack: usableSkills(profile.skills),
    ownedUrls: ownedUrls.slice(0, 20),
  });
};

const textOf = (headline: string, skills: readonly string[], profile: MeasuredProfile): string => {
  const city = clean(profile.city);
  return [
    headline === "" ? "Mission freelance." : `Mission freelance : ${headline}.`,
    skills.length === 0 ? null : `Compétences attendues : ${skills.join(", ")}.`,
    `Lieu : ${city === "" ? "France" : city}, ${MODE_LABEL[profile.workMode]}.`,
    "Profil recherché : un ou une freelance expérimenté(e) sur ce périmètre, disponible pour démarrer une mission.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
};

const briefOf = (headline: string, skills: readonly string[], profile: MeasuredProfile): string => {
  const city = clean(profile.city);
  const what = headline === "" ? "un ou une freelance" : `un ou une freelance « ${headline} »`;
  const stack = skills.length === 0 ? "" : ` (${skills.slice(0, BRIEF_SKILLS).join(", ")})`;
  const where = city === "" ? "" : ` à ${city}`;
  return `${what}${stack}${where}, ${MODE_LABEL[profile.workMode]}`.slice(0, BRIEF_MAX);
};

const offerFor = (headline: string, skills: readonly string[], profile: MeasuredProfile, identity: Identity): JobDescription | null => {
  const jd = JobDescriptionSchema.parse({
    id: "T01",
    lang: "fr",
    role: "target",
    // L'offre décrit ce que le freelance dit chercher : elle vient de lui, comme une offre fournie par un client.
    source: "client",
    text: textOf(headline, skills, profile),
    brief: briefOf(headline, skills, profile),
  });
  try {
    assertJdFreeOfIdentity(jd.text, identity);
    if (jd.brief !== undefined) assertJdFreeOfIdentity(jd.brief, identity);
    return jd;
  } catch {
    return null;
  }
};

/** Identité et offre de la mesure, ou la raison pour laquelle on ne peut pas mesurer sans fausser le résultat. */
export const subjectOf = (profile: MeasuredProfile): Subject | { readonly refusal: SubjectRefusal } => {
  const identity = identityOf(profile);
  if (identity === null) return { refusal: "no_proven_url" };
  const headline = clean(profile.headline).slice(0, 200);
  const skills = usableSkills(profile.skills).slice(0, 12);
  if (headline === "" && skills.length === 0) return { refusal: "nothing_to_ask" };
  // Le titre d'abord ; s'il nomme la personne, les seules compétences.
  const jobDescription = offerFor(headline, skills, profile, identity) ?? (skills.length > 0 ? offerFor("", skills, profile, identity) : null);
  return jobDescription === null ? { refusal: "identity_in_profile" } : { identity, jobDescription };
};
