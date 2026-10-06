import type { PublicProfile } from "./identity";

/*
 * Re-identification risk (ARCHITECTURE_ANONYME §4). A pseudonym hides the name, not the person: a rare enough
 * combination of public attributes points at one human. We charge points for each singularising signal, explain every
 * point charged, and propose a generalisation. Weights are HYPOTHESES, to recalibrate on real profiles.
 */

export interface RiskReason {
  readonly signal: string;
  readonly points: number;
  readonly detail: string;
}

export interface RiskReport {
  readonly score: number;
  readonly blocking: boolean;
  readonly reasons: readonly RiskReason[];
  readonly suggestions: readonly string[];
}

/** Above this score, publication is refused until the profile is generalised. HYPOTHÈSE. */
export const RISK_BLOCK = 60;

/** A well-known employer in running text is the strongest de-anonymiser: "5 ans chez Stripe" identifies a small pool. */
const EMPLOYER = /\b(?:ex[- ]|chez |at |anciennement )\s?([A-ZÉÈÀ][\w&.-]{2,})/g;
const SCHOOL = /\b(?:promotion|promo|diplômé|graduated|alumni)\b|\b(?:l'X|Polytechnique|ENS|Centrale|HEC|42|Epitech|ESPRIT)\b/i;
const EXACT_DATES = /\b(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}\b/gi;
/** A city small enough that "one senior freelance" is nearly unique. HYPOTHÈSE: large metro areas are safe. */
const LARGE_AREAS = ["paris", "lyon", "marseille", "toulouse", "bordeaux", "lille", "nantes", "remote", "télétravail", "france", "île-de-france", "ile-de-france"];
const RARE_SKILLS = ["cobol", "openvms", "zig", "erlang", "elixir", "ada", "fortran", "smalltalk", "haskell", "ocaml", "prolog"];

/** Missions are scanned like the rest: that is where a client name or an exact date would slip in. */
const missionText = (p: PublicProfile): string =>
  p.missions.map((m) => `${m.role.fr} ${m.role.en} ${m.achievements.map((a) => `${a.fr} ${a.en}`).join(" ")} ${m.stack.join(" ")}`).join(" ");

const textOf = (p: PublicProfile): string =>
  `${p.summary.fr} ${p.summary.en} ${p.headline.fr} ${p.headline.en} ${p.sectors.join(" ")} ${missionText(p)}`;

const employerReasons = (text: string): RiskReason[] => {
  const found = [...text.matchAll(EMPLOYER)].map((m) => m[1]!);
  return found.length === 0
    ? []
    : [{ signal: "employeur nommé", points: 30 * Math.min(found.length, 2), detail: `employeur(s) cité(s) : ${[...new Set(found)].join(", ")}` }];
};

const areaReason = (area: string): RiskReason[] => {
  const normalised = area.toLowerCase();
  return LARGE_AREAS.some((a) => normalised.includes(a))
    ? []
    : [{ signal: "zone géographique étroite", points: 20, detail: `« ${area} » désigne un bassin trop petit` }];
};

const skillsReason = (skills: readonly string[], missionStacks: readonly string[]): RiskReason[] => {
  // A rare technology singularises whether it sits in the skills list or inside a mission's stack.
  const rare = [...new Set([...skills, ...missionStacks])].filter((s) => RARE_SKILLS.includes(s.toLowerCase()));
  const reasons: RiskReason[] = [];
  if (rare.length > 0) reasons.push({ signal: "compétences rares", points: 12 * Math.min(rare.length, 3), detail: `combinaison peu commune : ${rare.join(", ")}` });
  if (skills.length > 12) reasons.push({ signal: "liste de compétences très longue", points: 10, detail: `${skills.length} compétences : la combinaison devient une empreinte` });
  return reasons;
};

const sectorsReason = (sectors: readonly string[]): RiskReason[] =>
  sectors.length >= 2 && sectors.every((s) => s.split(/\s+/).length >= 2)
    ? [{ signal: "secteurs très spécifiques", points: 10, detail: `secteurs cumulés : ${sectors.join(" + ")}` }]
    : [];

const datesReason = (text: string): RiskReason[] => {
  const dates = [...text.matchAll(EXACT_DATES)].map((m) => m[0]);
  return dates.length === 0 ? [] : [{ signal: "dates exactes", points: 10, detail: `dates publiées : ${[...new Set(dates)].join(", ")}` }];
};

const schoolReason = (text: string): RiskReason[] =>
  SCHOOL.test(text) ? [{ signal: "école ou promotion", points: 15, detail: "l'école et l'année de promotion réduisent fortement le nombre de candidats" }] : [];

const seniorityReason = (seniority: string): RiskReason[] =>
  /^\d+\s*(ans|years)/i.test(seniority.trim()) ? [{ signal: "séniorité au chiffre près", points: 5, detail: `« ${seniority} » : préférer une tranche` }] : [];

const SUGGESTIONS: Readonly<Record<string, string>> = {
  "employeur nommé": "remplacer le nom de l'employeur par sa catégorie (« scale-up internationale », « grand groupe bancaire »)",
  "zone géographique étroite": "élargir à la région ou au bassin d'emploi (« Nouvelle-Aquitaine », « remote France »)",
  "compétences rares": "ne garder que les compétences demandées par les missions visées, retirer les technologies confidentielles",
  "liste de compétences très longue": "se limiter aux 8 à 10 compétences réellement vendues",
  "secteurs très spécifiques": "généraliser les secteurs (« industrie », « finance »)",
  "dates exactes": "remplacer les dates par une durée (« 5+ ans »)",
  "école ou promotion": "retirer l'école et l'année de promotion",
  "séniorité au chiffre près": "publier une tranche (« 5 à 10 ans »)",
};

/** Deterministic: same profile, same score. Nothing random, nothing time-dependent. */
export const reidentificationRisk = (profile: PublicProfile): RiskReport => {
  const text = textOf(profile);
  const reasons = [
    ...employerReasons(text),
    ...schoolReason(text),
    ...areaReason(profile.area),
    ...skillsReason(profile.skills, profile.missions.flatMap((m) => m.stack)),
    ...sectorsReason(profile.sectors),
    ...datesReason(text),
    ...seniorityReason(profile.seniority),
  ];
  const score = Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0));
  const suggestions = [...new Set(reasons.map((r) => SUGGESTIONS[r.signal]).filter((s): s is string => s !== undefined))];
  return { score, blocking: score >= RISK_BLOCK, reasons, suggestions };
};
