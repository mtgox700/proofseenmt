import { ENGINE_INDEX, type EngineId } from "@proofseen/core";
import type { EngineFunnel, StageCount } from "@proofseen/stats";
import { day, pct } from "./format";

/*
 * Plan de correction du rapport client (OFFRE_PREVENTE « Plan de correction » : au plus 8 actions, classées, avec
 * effort, raison et endroit d'application).
 *
 * Règle qui gouverne tout ce fichier : **une action ne naît que d'un chiffre mesuré**. Aucune action générique, aucune
 * bonne pratique récitée, aucun gain annoncé. Le plan suit l'ordre du funnel parce qu'une étape tardive ne se corrige
 * pas avant celle qui la précède : travailler son classement quand aucune page n'est lue ne sert à rien.
 *
 * Symétrie volontaire : ce qui ne dépend pas du client (un moteur qui refuse de nommer des personnes) est **énoncé**
 * dans `notActionable` et n'est jamais transformé en action vendable.
 */

/** Étapes du funnel. E1 (indexation) se mesure hors moteurs, E2-E5 dans les réponses. */
export type Stage = "E1" | "E2" | "E3" | "E4" | "E5";
export type Effort = "faible" | "moyen" | "élevé";

/** Au-delà de cette part de refus, le moteur ne nomme pas de personnes : aucune action du client n'y change rien. */
export const REFUSAL_LIMIT = 0.2;
/** Une plateforme compte comme « lue par les moteurs » à partir de cette part des citations de la vague. */
export const DOMINANT_SOURCE_SHARE = 0.1;
/** Une étape passe quand elle conserve au moins cette fraction de l'étape qui la précède. */
export const STAGE_PASS_RATIO = 0.5;
/** Plafond contractuel du plan (OFFRE_PREVENTE). */
export const MAX_ACTIONS = 8;
/** Au plus deux plateformes proposées : au-delà, le plan devient une liste de courses. */
export const MAX_PLATFORM_ACTIONS = 2;

/** Ce que le client possède déjà, vérifié — jamais déclaratif. */
export interface Surface {
  readonly readableWithoutJs: boolean;
  readonly robotsTxt: boolean;
  readonly sitemap: boolean;
  readonly structuredData: boolean;
  /** Domaines où la présence du client a été vérifiée à la main. */
  readonly verifiedPlatforms: readonly string[];
}

/** E1, relevé hors moteurs (Search Console, Bing Webmaster). `null` en entrée = non mesuré. */
export interface IndexationFact {
  readonly pagesDeclared: number;
  readonly pagesIndexed: number;
  readonly checkedAt: string;
}

export interface PlanInput {
  readonly funnel: readonly EngineFunnel[];
  readonly indexation: IndexationFact | null;
  readonly surface: Surface;
  /** Part des citations par domaine de plateforme, mesurée sur la vague. */
  readonly sourceShare: Readonly<Record<string, number>>;
  /** Part des tirages où le moteur refuse de nommer une personne. */
  readonly refusalRate: Readonly<Record<string, number>>;
}

export interface Action {
  readonly id: string;
  readonly rank: number;
  readonly stage: Stage;
  readonly title: string;
  readonly why: string;
  readonly where: string;
  readonly effort: Effort;
  /** Le chiffre mesuré qui justifie l'action. Sans lui, l'action n'existe pas. */
  readonly evidence: string;
}

export interface CorrectionPlan {
  /** Première étape qui bloque, dans l'ordre du funnel. `null` = aucune étape ne bloque. */
  readonly blockingStage: Stage | null;
  readonly actions: readonly Action[];
  /** Actions retenues par les règles mais écartées par le plafond. */
  readonly dropped: number;
  /** Constats sur lesquels le client ne peut rien agir. */
  readonly notActionable: readonly string[];
}


/**
 * La première étape mesurée n'a pas d'étape précédente : elle ne bloque que si elle n'arrive jamais. Lui demander une
 * part des tirages n'aurait aucun sens — un profil légitime n'est retrouvé que sur une minorité des réponses.
 */
const never = (stage: StageCount): boolean => stage.successes === 0;
/** Les étapes suivantes bloquent quand elles n'aboutissent jamais, ou perdent plus de la moitié de la précédente. */
const loses = (stage: StageCount, previous: number): boolean => stage.successes === 0 || stage.successes < previous * STAGE_PASS_RATIO;

/** Ordre du funnel pour un moteur : la première étape qui bloque est celle sur laquelle il faut travailler. */
const blockingStageOf = (engine: EngineFunnel): Stage | null => {
  if (never(engine.retrieved)) return "E2";
  if (loses(engine.named, engine.retrieved.successes)) return "E3";
  if (loses(engine.top5, engine.named.successes)) return "E4";
  if (loses(engine.cited, engine.top5.successes)) return "E5";
  return null;
};

const ORDER: readonly Stage[] = ["E1", "E2", "E3", "E4", "E5"];
const earliest = (stages: readonly Stage[]): Stage | null => ORDER.find((stage) => stages.includes(stage)) ?? null;

/** Total d'une étape sur tous les moteurs : le plan parle du profil, pas d'un moteur en particulier. */
const totals = (funnel: readonly EngineFunnel[], pick: (engine: EngineFunnel) => StageCount) => ({
  successes: funnel.reduce((sum, engine) => sum + pick(engine).successes, 0),
  draws: funnel.reduce((sum, engine) => sum + engine.draws, 0),
});

type Draft = Omit<Action, "rank">;

const indexationActions = (indexation: IndexationFact, surface: Surface): Draft[] => {
  const evidence = `${indexation.pagesIndexed} page(s) indexée(s) sur ${indexation.pagesDeclared} déclarée(s), relevé du ${day(indexation.checkedAt)}`;
  const drafts: Draft[] = [];
  if (!surface.readableWithoutJs) {
    drafts.push({
      id: "E1-lisible",
      stage: "E1",
      title: "Rendre vos pages lisibles sans JavaScript",
      why: "Les robots des IA ne lancent pas le JavaScript : sur une page construite dans le navigateur, ils ne lisent rien. Il n'y a donc aucun texte à retrouver dans la suite du parcours.",
      where: "Une page statique par profil, servie telle quelle par votre hébergeur.",
      effort: "moyen",
      evidence,
    });
  }
  if (!surface.robotsTxt || !surface.sitemap) {
    drafts.push({
      id: "E1-declarer",
      stage: "E1",
      title: "Déclarer le site aux moteurs",
      why: "Sans fichier robots.txt ni plan de site, les moteurs n'ont aucune liste des pages à venir chercher, et les robots d'IA n'y sont pas explicitement autorisés.",
      where: "robots.txt et sitemap.xml à la racine du domaine, puis dépôt du plan de site dans Search Console et Bing Webmaster.",
      effort: "faible",
      evidence,
    });
  }
  if (!surface.structuredData) {
    drafts.push({
      id: "E1-structure",
      stage: "E1",
      title: "Décrire la page en données structurées",
      why: "Les données structurées disent explicitement de qui parle la page. Elles doivent décrire ce qui est visible à l'écran, sans rien ajouter.",
      where: "Un bloc JSON-LD ProfilePage/Person sur chaque page de profil.",
      effort: "faible",
      evidence,
    });
  }
  if (drafts.length === 0) {
    drafts.push({
      id: "E1-demander",
      stage: "E1",
      title: "Demander l'indexation des pages du profil",
      why: "Les pages sont lisibles et déclarées, mais pas encore indexées : l'indexation n'est pas automatique et demande de quelques jours à deux semaines.",
      where: "Search Console, Inspection de l'URL, Demander l'indexation — pour chaque page de profil.",
      effort: "faible",
      evidence,
    });
  }
  return drafts;
};

const FUNNEL_DRAFTS: Readonly<Record<Exclude<Stage, "E1">, Omit<Draft, "evidence" | "stage">>> = {
  E2: {
    id: "E2-vocabulaire",
    title: "Aligner le vocabulaire de votre profil sur celui des offres visées",
    why: "Vos pages sont indexées mais elles ne remontent pas sur ces offres : les mots par lesquels les recruteurs décrivent la mission n'apparaissent pas dans votre profil, ou pas sous la même forme.",
    where: "Titre, résumé et liste de compétences de votre page de profil, avec les termes exacts des offres — uniquement ceux que vous pratiquez réellement.",
    effort: "faible",
  },
  E3: {
    id: "E3-identite",
    title: "Lever l'ambiguïté sur votre identité",
    why: "Vos pages sont retrouvées mais personne n'est nommé à partir d'elles : le moteur ne rattache pas la page à une personne identifiable de façon stable.",
    where: "Un nom d'affichage unique, une seule page de référence par personne, et des liens vers vos autres profils publics depuis cette page.",
    effort: "moyen",
  },
  E4: {
    id: "E4-preuves",
    title: "Ajouter des preuves vérifiables et différenciantes",
    why: "Vous êtes nommé mais jamais dans les cinq premiers : les profils qui passent devant portent des éléments vérifiables que le vôtre ne porte pas encore.",
    where: "Missions datées et vérifiables, contributions publiques, écrits techniques — sur la page de profil. Aucun fait que vous ne pouvez prouver.",
    effort: "élevé",
  },
  E5: {
    id: "E5-citable",
    title: "Offrir une page stable et citable",
    why: "Vous êtes nommé dans le texte mais la réponse ne renvoie pas vers vous : le moteur n'a pas d'adresse stable à donner. Reste que citer une source est une décision du moteur, pas une conséquence mécanique de vos pages.",
    where: "Une adresse durable par profil, sans redirection ni paramètre, référencée depuis vos autres profils publics.",
    effort: "faible",
  },
};

const funnelAction = (stage: Exclude<Stage, "E1">, evidence: string): Draft => ({ ...FUNNEL_DRAFTS[stage], stage, evidence });

/** Nom lisible des index, pour une consigne qu'on peut suivre sans connaître le protocole. */
const INDEX_LABEL: Readonly<Record<string, string>> = {
  bing: "Bing (Bing Webmaster Tools, puis IndexNow)",
  brave: "Brave (search.brave.com/submit-url)",
  google: "Google (Search Console)",
  // Les robots propres à ces moteurs n'ont aucun formulaire : ils suivent des liens. C'est la seule consigne utile.
  other: "leurs propres robots, qui suivent les liens : faites pointer vos profils publics vers votre site",
};

const ENGINE_LABEL: Readonly<Record<string, string>> = { openai: "OpenAI", anthropic: "Anthropic", perplexity: "Perplexity" };

/** « OpenAI », « OpenAI et Perplexity », « OpenAI, Anthropic et Perplexity » : une phrase se lit, une liste brute non. */
const enumerate = (engines: readonly EngineFunnel[]): string => {
  const names = engines.map((engine) => ENGINE_LABEL[engine.engine] ?? engine.engine);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
};

interface RetrievalSplit {
  readonly found: readonly EngineFunnel[];
  readonly missing: readonly EngineFunnel[];
}

/**
 * Récupération **partagée** entre moteurs : certains retrouvent le profil, d'autres jamais.
 *
 * Constat qui l'a fait naître, sur la première vague client réelle (`AUDIT-FR-ZK7M4`, 02/10) : Anthropic retrouvait le
 * sujet 5 fois sur 60, OpenAI et Perplexity 0 fois sur 60 chacun. Le plan lui recommandait pourtant « d'aligner le
 * vocabulaire de son profil sur celui des offres ». Les données disaient le contraire : **les mêmes pages, sur les
 * mêmes offres, le même jour**, étaient retrouvées par un moteur et pas par les autres. Les mots ne peuvent pas être
 * la cause d'un écart entre moteurs qui lisent les mêmes mots — et une vérification terme à terme l'a confirmé :
 * chaque compétence qu'il pratique et que les offres emploient figurait déjà sur son site.
 *
 * Ce qui diffère entre moteurs, c'est l'index dont chacun tire son web. C'est donc l'action qu'on propose, et
 * l'action « vocabulaire » n'est pas émise : un client qui la suivrait travaillerait sur la mauvaise cause.
 */
const retrievalSplit = (funnel: readonly EngineFunnel[]): RetrievalSplit | null => {
  const found = funnel.filter((engine) => engine.retrieved.successes > 0);
  const missing = funnel.filter((engine) => engine.retrieved.successes === 0);
  return found.length > 0 && missing.length > 0 ? { found, missing } : null;
};

const indexAction = (split: RetrievalSplit): Draft => {
  const indexes = [...new Set(split.missing.flatMap((engine) => ENGINE_INDEX[engine.engine as EngineId] ?? ["other"]))];
  const verb = split.missing.length > 1 ? "cherchent" : "cherche";
  const named = indexes.filter((index) => index !== "other");
  return {
    id: "E2-index-moteur",
    stage: "E2",
    title: `Faire indexer vos pages là où ${enumerate(split.missing)} ${verb}`,
    why: `Vos pages sont retrouvées par ${enumerate(split.found)}, jamais par ${enumerate(split.missing)}, sur les mêmes offres et le même jour. Vos mots fonctionnent : ce qui manque, c'est votre présence dans l'index que ${split.missing.length > 1 ? "lisent ces moteurs" : "lit ce moteur"}.`,
    where: [
      ...(named.length > 0 ? [`Ajouter votre site et demander son indexation dans ${named.map((index) => INDEX_LABEL[index] ?? index).join(" et ")}.`] : []),
      ...(indexes.includes("other") ? ["Ces moteurs ont aussi leurs propres robots, qui n'ont aucun formulaire et suivent les liens : faites pointer vos profils publics vers votre site."] : []),
    ].join(" "),
    effort: "faible",
    evidence: [...split.found, ...split.missing].map((engine) => `${engine.engine} ${engine.retrieved.successes}/${engine.draws}`).join(" · "),
  };
};

const platformActions = (input: PlanInput): Draft[] =>
  Object.entries(input.sourceShare)
    .filter(([domain, share]) => share >= DOMINANT_SOURCE_SHARE && !input.surface.verifiedPlatforms.includes(domain))
    .sort(([a, shareA], [b, shareB]) => shareB - shareA || a.localeCompare(b))
    .slice(0, MAX_PLATFORM_ACTIONS)
    .map(([domain, share]) => ({
      id: `source-${domain}`,
      // Une plateforme citée agit sur la récupération : c'est par elle que le moteur arrive à une personne.
      stage: "E2" as const,
      title: `Être présent et à jour sur ${domain}`,
      why: "Les réponses mesurées s'appuient massivement sur cette plateforme pour ce type d'offre. Y être absent, c'est être absent de la source que le moteur lit.",
      where: `Votre profil public sur ${domain}, avec les mêmes faits que votre page de référence.`,
      effort: "moyen",
      evidence: `${pct(share)} des citations de la vague pointent vers ${domain}`,
    }));

const stageCount = (engine: EngineFunnel, stage: Exclude<Stage, "E1">): StageCount =>
  stage === "E2" ? engine.retrieved : stage === "E3" ? engine.named : stage === "E4" ? engine.top5 : engine.cited;

/**
 * Plan de correction : les actions de l'étape qui bloque d'abord, puis celles des étapes suivantes qui bloquent aussi,
 * jamais celles des étapes déjà franchies. Le plafond de 8 écarte les dernières et le compte est rendu au client.
 */
export const correctionPlan = (input: PlanInput): CorrectionPlan => {
  if (input.funnel.length === 0) throw new Error("plan impossible : aucun moteur mesuré dans cette vague");

  const notActionable: string[] = [];
  for (const [engine, rate] of Object.entries(input.refusalRate)) {
    if (rate < REFUSAL_LIMIT) continue;
    notActionable.push(
      `Sur ${engine}, le moteur refuse de nommer une personne dans ${pct(rate)} des réponses mesurées. Aucune action de votre côté ne change ce comportement : ce n'est pas un défaut de votre profil.`,
    );
  }
  if (input.indexation === null) {
    notActionable.push("L'indexation (étape 1) n'a pas été mesurée pour cette vague : ce rapport ne se prononce pas sur elle.");
  }

  const indexation = input.indexation;
  const indexationBlocks = indexation !== null && indexation.pagesIndexed === 0;
  const engineStages = input.funnel.map(blockingStageOf).filter((stage): stage is Stage => stage !== null);
  const blockingStage = indexationBlocks ? "E1" : earliest(engineStages);

  const drafts: Draft[] = [];
  if (indexationBlocks) {
    // Rien de ce qui suit E1 n'est corrigeable tant qu'aucune page n'est lue : on ne propose aucune étape ultérieure.
    drafts.push(...indexationActions(indexation, input.surface));
  } else if (blockingStage !== null) {
    const from = ORDER.indexOf(blockingStage);
    const stages = ORDER.filter((stage): stage is Exclude<Stage, "E1"> => stage !== "E1" && ORDER.indexOf(stage) >= from);
    const split = retrievalSplit(input.funnel);
    for (const stage of stages) {
      if (!engineStages.includes(stage)) continue;
      // Un écart de récupération entre moteurs désigne l'index, pas le vocabulaire : voir `retrievalSplit`.
      if (stage === "E2" && split !== null) {
        drafts.push(indexAction(split));
        continue;
      }
      const measured = totals(input.funnel, (engine) => stageCount(engine, stage));
      drafts.push(funnelAction(stage, `${measured.successes} tirage(s) sur ${measured.draws} franchissent cette étape`));
    }
  }
  // Les plateformes citées ne dépendent pas de l'étape qui bloque : être absent de la source que le moteur lit reste
  // vrai — et souvent plus rapide à corriger — même quand les pages du client ne sont pas encore indexées.
  if (blockingStage !== null) drafts.push(...platformActions(input));

  return {
    blockingStage,
    actions: drafts.slice(0, MAX_ACTIONS).map((draft, index) => ({ ...draft, rank: index + 1 })),
    dropped: Math.max(0, drafts.length - MAX_ACTIONS),
    notActionable,
  };
};
