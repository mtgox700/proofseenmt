import { ManifestSchema, type EngineId, type JobDescription, type Manifest, type PromptTemplate } from "./schemas";

/*
 * Le protocole de mesure, figé dans le code.
 *
 * Jusqu'ici, les moteurs, les modèles et les quatre formulations de recruteur étaient **recopiés dans chaque
 * manifeste**. Rien n'empêchait alors deux clients de recevoir deux instruments différents — et deux rapports produits
 * avec des instruments différents ne se comparent pas, ni entre eux, ni à notre propre mesure de référence.
 *
 * L'instrument est donc défini une fois. Ce qui change d'un client à l'autre, ce sont ses offres ; rien d'autre.
 *
 * Toute modification de ce fichier change l'instrument : elle incrémente `PROTOCOL_VERSION` et rend les vagues
 * antérieures non comparables. Ce n'est pas une contrainte technique, c'est ce que veut dire « mesurer ».
 */

/** Incrémentée à chaque changement d'instrument. Une vague porte la version avec laquelle elle a été faite. */
export const PROTOCOL_VERSION = 1;

/**
 * Marque des champs qu'un squelette de dossier client laisse volontairement vides. Elle doit **faire échouer** les
 * contrôles : un squelette qui passerait les portails serait pire que pas de squelette, et un brief non rempli partirait
 * tel quel dans les formulations envoyées aux moteurs.
 */
export const PLACEHOLDER_MARKER = "À RENSEIGNER";
export const hasPlaceholder = (value: string): boolean => value.includes(PLACEHOLDER_MARKER);

/** Quatre façons dont un recruteur pose la question. Aucune ne nomme personne : seule l'offre entre dans le moteur. */
const PROMPTS: readonly PromptTemplate[] = [
  {
    id: "P1",
    version: 1,
    lang: "fr",
    text: "Voici une offre de mission :\n\n{{JD}}\n\nTrouve-moi les 5 meilleurs profils freelances pour cette mission. Pour chacun : son nom, un lien vers son profil et pourquoi il correspond.\n",
  },
  {
    id: "P2",
    version: 1,
    lang: "fr",
    text: "Je cherche {{BRIEF}}. Qui me recommandes-tu ? Donne-moi des noms avec un lien vers leur profil.\n",
  },
  {
    id: "P3",
    version: 1,
    lang: "en",
    text: "Here is a freelance job description:\n\n{{JD}}\n\nFind me the 5 best freelance profiles for this job. For each one: their name, a link to their profile and why they fit.\n",
  },
  {
    id: "P4",
    version: 1,
    lang: "fr",
    text: "Cherche sur LinkedIn, Malt et GitHub des profils de freelances qui correspondent à cette offre :\n\n{{JD}}\n\nDonne-moi les 5 meilleurs, avec leur nom et un lien vers leur profil.\n",
  },
];

export const AUDIT_PROTOCOL = {
  version: PROTOCOL_VERSION,
  engines: ["openai", "anthropic", "perplexity"],
  models: { openai: "gpt-5-mini", anthropic: "claude-sonnet-5", perplexity: "perplexity/sonar" },
  /** Cinq tirages par cellule : en deçà, l'intervalle est trop large pour dire quoi que ce soit. */
  drawsPerCell: 5,
  prompts: PROMPTS,
} as const satisfies { version: number; engines: readonly string[]; models: Record<string, string>; drawsPerCell: number; prompts: readonly PromptTemplate[] };

/**
 * Coût moyen observé sur la vague J0 : 15,79 $ pour 780 tirages, extraction comprise. C'est une **observation**, pas
 * un tarif : elle sert à proposer un plafond, jamais à promettre un montant.
 */
/** Forme d'un audit client (OFFRE_PREVENTE) : 3 offres choisies par le client, 1 témoin choisi par nous. */
/**
 * D'où chaque moteur mesuré tire son web.
 *
 * Écrit ici, à côté des moteurs, parce que c'est une **propriété de l'instrument** : elle dit quels relevés
 * d'indexation prouvent qu'une page pouvait être récupérée. Constat du 01/10 qui l'a rendue nécessaire — Google
 * indexait la page nominative pendant que Bing ne l'avait jamais crawlée. Sans cette table, « 1 page indexée » aurait
 * fait conclure « traitement délivré » sur trois moteurs dont **aucun** ne lit Google.
 *
 * C'est un état public qui bouge : OpenAI et Perplexity ont développé leurs propres robots en parallèle de Bing.
 * Elle est donc relue à chaque vague, pas gravée — et une correspondance douteuse se corrige ici, en un endroit.
 */
export const ENGINE_INDEX: Readonly<Record<EngineId, readonly ("bing" | "brave" | "google" | "other")[]>> = {
  openai: ["bing", "other"],
  anthropic: ["brave"],
  perplexity: ["bing", "other"],
} as const;

/** Les index qui comptent pour le protocole courant. Google n'y est pas : aucun moteur mesuré ne s'en sert. */
export const RELEVANT_INDEXES: readonly ("bing" | "brave" | "google" | "other")[] = [
  ...new Set(AUDIT_PROTOCOL.engines.flatMap((engine) => ENGINE_INDEX[engine])),
];

export const AUDIT_TARGETS = 3;
export const AUDIT_CONTROLS = 1;

/**
 * Coût moyen constaté d'un tirage, **par moteur**.
 *
 * Il y avait ici une seule constante pour les trois. Elle ne pouvait pas être juste : entre Perplexity et Anthropic,
 * le coût réel va de 1 à 4. Une moyenne globale n'est exacte que si la composition de la vague ne change jamais — or
 * elle change dès qu'on mesure sur deux moteurs au lieu de trois, et l'annonce faite au client devient fausse.
 *
 * Chiffres relevés sur la vague `AUDIT-FR-ZK7M4` du 2026-10-02 : 240 tirages réels, 80 par moteur.
 * L'ancienne constante unique valait 0,0205 $ ; le coût réel moyen était de 0,0262 $, soit **28 % de plus**.
 */
export const OBSERVED_DRAW_USD: Readonly<Record<EngineId, number>> = {
  openai: 0.0229,
  anthropic: 0.0443,
  perplexity: 0.0114,
};

/**
 * Coût du pire cas pour un tirage, par moteur. C'est **cette** borne qui dimensionne le plafond dur.
 *
 * ⚠️ Elle a été relevée le 2026-10-02 après un constat : la borne d'Anthropic valait 0,12 $ et a été **dépassée 4 fois
 * sur 80** lors de la première vague réelle, avec un maximum à **0,1885 $** — 57 % au-dessus. Une borne dépassée n'est
 * pas une borne : le plafond aurait pu arrêter la vague en cours de route, et une vague tronquée porte moins de
 * tirages que son manifeste figé n'en déclare. La promesse « même instrument pour tous » tombe avec elle.
 *
 * Les bornes ci-dessous laissent une marge au-dessus du maximum réellement observé (0,0433 openai, 0,1885 anthropic,
 * 0,0124 perplexity). Elles restent des **hypothèses** : une réponse plus longue que tout ce qu'on a vu coûtera plus.
 */
export const WORST_CASE_DRAW_USD: Readonly<Record<EngineId, number>> = {
  openai: 0.08,
  anthropic: 0.25,
  perplexity: 0.03,
};

/** Coût estimé d'une extraction (Haiku, ~3k entrée / ~400 sortie) — HYPOTHÈSE, affinée après J0. */
export const EXTRACTOR_COST_ESTIMATE_USD = 0.006;

/**
 * Ce que la vague peut coûter au pire. C'est **cette** borne qui doit tenir sous le plafond : un plafond calculé sur
 * la moyenne laisse la vague s'arrêter en cours de route, et une vague tronquée n'est pas exploitable.
 */
export const worstCaseUsd = (manifest: Manifest): number => {
  const perDraw = manifest.engines.reduce((sum, engine) => sum + WORST_CASE_DRAW_USD[engine], 0) / manifest.engines.length;
  return drawsOf(manifest) * (perDraw + EXTRACTOR_COST_ESTIMATE_USD);
};
/** Marge au-dessus du pire cas : une vague qui s'arrête au plafond est incomplète, donc inexploitable. */
const COST_CAP_MARGIN = 1.15;

export const drawsOf = (manifest: Manifest): number =>
  manifest.jobDescriptions.length * manifest.prompts.length * manifest.engines.length * manifest.drawsPerCell;

/**
 * Coût attendu d'une vague, calculé **moteur par moteur**.
 *
 * Les tirages se répartissent également entre les moteurs du manifeste (`drawsOf` les multiplie par leur nombre),
 * donc chaque moteur en porte la même part. On somme ce que chacun coûte réellement plutôt que d'appliquer une
 * moyenne qui n'est vraie pour aucun d'eux.
 */
export const estimatedCostUsd = (manifest: Manifest): number => {
  const perEngine = drawsOf(manifest) / manifest.engines.length;
  return manifest.engines.reduce((sum, engine) => sum + perEngine * OBSERVED_DRAW_USD[engine], 0);
};

export interface AuditManifestInput {
  readonly waveId: string;
  /** Les offres du client, plus au moins une offre témoin choisie par nous. */
  readonly jobDescriptions: readonly JobDescription[];
  /** Plafond imposé par l'opérateur. Absent, il est calculé pour couvrir la vague entière. */
  readonly costCapUsd?: number;
}

/**
 * Manifeste d'un audit client. Il n'est **pas figé** : figer est un acte délibéré, qui déclare que le protocole ne
 * bougera plus, et il n'a pas à se produire comme effet de bord d'une génération de fichier.
 */
export const buildAuditManifest = (input: AuditManifestInput): Manifest => {
  const targets = input.jobDescriptions.filter((jd) => jd.role === "target");
  const controls = input.jobDescriptions.filter((jd) => jd.role === "control");
  if (targets.length === 0) throw new Error("vague impossible : aucune offre cible");
  if (controls.length === 0) {
    throw new Error("vague impossible : aucune offre témoin — sans elle, rien ne dit si le moteur cite au hasard");
  }

  const draft = {
    version: 1 as const,
    waveId: input.waveId,
    frozenAt: null,
    engines: [...AUDIT_PROTOCOL.engines],
    models: { ...AUDIT_PROTOCOL.models },
    drawsPerCell: AUDIT_PROTOCOL.drawsPerCell,
    costCapUsd: input.costCapUsd ?? 1,
    jobDescriptions: [...input.jobDescriptions],
    prompts: AUDIT_PROTOCOL.prompts.map((prompt) => ({ ...prompt })),
  };
  // Le plafond se calcule sur le manifeste complet, et sur le PIRE cas : c'est la borne que le préflight vérifie.
  const costCapUsd = input.costCapUsd ?? Math.ceil(worstCaseUsd(ManifestSchema.parse(draft)) * COST_CAP_MARGIN);
  return ManifestSchema.parse({ ...draft, costCapUsd });
};

export interface FollowUpInput {
  /** La vague qui fait foi : c'est à elle que la nouvelle sera comparée. */
  readonly reference: Manifest;
  readonly waveId: string;
}

export interface FollowUp {
  readonly manifest: Manifest;
  /**
   * Ce qui, dans la référence, ne correspond plus au protocole courant. Ces écarts sont **conservés** — la référence
   * fait foi — mais ils sont nommés, parce qu'ils bornent ce que la comparaison pourra dire.
   */
  readonly divergences: readonly string[];
}

/**
 * Re-mesure d'une vague antérieure. Une re-mesure ne vaut que si elle est **identique à sa référence sauf son
 * identifiant** : offres, formulations, moteurs, modèles et tirages sont repris mot pour mot. Reconstruire depuis le
 * protocole courant serait plus simple et faux — un modèle ou une formulation qui a bougé entre-temps transformerait
 * une comparaison en illusion de comparaison.
 */
export const followUpManifest = ({ reference, waveId }: FollowUpInput): FollowUp => {
  if (reference.waveId === waveId) throw new Error(`la re-mesure ne peut pas porter le même identifiant que sa référence (${waveId})`);
  if (reference.frozenAt === null) {
    throw new Error(`la vague ${reference.waveId} n'a jamais été figée : elle ne prouve pas ce qui a été mesuré, et ne peut servir de référence`);
  }

  const divergences: string[] = [];
  for (const engine of reference.engines) {
    const current = (AUDIT_PROTOCOL.models as Record<string, string | undefined>)[engine];
    const used = reference.models[engine as keyof typeof reference.models];
    if (current === undefined) divergences.push(`le moteur ${engine} de la référence ne fait plus partie du protocole courant`);
    else if (used !== undefined && used !== current) divergences.push(`modèle ${engine} : la référence a mesuré avec ${used}, le protocole courant utilise ${current}`);
  }
  for (const engine of AUDIT_PROTOCOL.engines) {
    if (!reference.engines.includes(engine as (typeof reference.engines)[number])) {
      divergences.push(`le protocole courant mesure ${engine}, que la référence n'a pas mesuré : la comparaison portera sur moins de moteurs`);
    }
  }
  for (const prompt of reference.prompts) {
    const current = AUDIT_PROTOCOL.prompts.find((candidate) => candidate.id === prompt.id);
    if (current === undefined) divergences.push(`la formulation ${prompt.id} de la référence n'existe plus dans le protocole courant`);
    else if (current.text.trim() !== prompt.text.trim()) divergences.push(`la formulation ${prompt.id} a changé depuis la référence`);
  }

  // Tout vient de la référence, sauf l'identifiant et le gel : la nouvelle vague se fige à son tour, délibérément.
  const manifest = ManifestSchema.parse({ ...reference, waveId, frozenAt: null });
  return { manifest, divergences };
};
