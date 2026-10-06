import type { EngineFunnel, Interval, StageCount } from "@proofseen/stats";
import type { CorrectionPlan, IndexationFact, Stage } from "./plan";
import type { Comparison, FunnelStage } from "./comparison";
import { day, pct, points } from "./format";
import {
  b,
  c,
  definitions,
  documentTitle,
  heading,
  list,
  paragraph,
  table,
  toHtml,
  toMarkdown,
  type Block,
  type ReportDocument,
} from "./document";

/*
 * Le rapport que le client reçoit (OFFRE_PREVENTE, « Audit complet »). Écrit pour un freelance, pas pour nous : chaque
 * étape est nommée par la question qu'elle pose, chaque chiffre est donné en compte brut **et** en fourchette, et rien
 * n'est affirmé au-delà de ce qui a été compté.
 *
 * Le fond est décrit une fois, sous forme de blocs, puis rendu en Markdown et en HTML. Deux gabarits séparés auraient
 * fini par dire deux choses différentes — dans un document contractuel, c'est inacceptable.
 *
 * Deux propriétés tenues par construction :
 *  - aucun nom de tiers n'entre ici — la carte des sources ne reçoit que des domaines de plateforme ;
 *  - aucun rang ni aucune mission n'est promis, et ce qui ne dépend pas du client est énoncé à part.
 */

export interface WaveFacts {
  readonly id: string;
  readonly measuredAt: string;
  /** Modèle interrogé par moteur : un rapport sans version de modèle n'est pas reproductible. */
  readonly models: Readonly<Record<string, string>>;
  readonly draws: number;
  readonly manifestDigest: string;
}

export interface JobDescriptionRef {
  readonly id: string;
  readonly label: string;
  /** « client » est étiqueté « fournie par vous » dans le rapport (engagement de l'offre). */
  readonly provenance: "client" | "proofseen";
  readonly role: "target" | "control";
}

export interface ClientReportInput {
  readonly client: { readonly displayName: string; readonly reference: string };
  readonly wave: WaveFacts;
  readonly jobDescriptions: readonly JobDescriptionRef[];
  readonly funnel: readonly EngineFunnel[];
  readonly sourceShare: Readonly<Record<string, number>>;
  readonly indexation: IndexationFact | null;
  /**
   * Taux de récupération sur les offres **témoins**. Le rapport dit au client qu'y apparaître serait un mauvais
   * signe : il doit donc lui dire s'il y est apparu. `null` = non calculable (aucune offre témoin exploitable).
   */
  readonly controlRetrieval: Interval | null;
  /** Comparaison avec une mesure antérieure (re-mesure à 45 jours). Absente = première mesure. */
  readonly comparison?: Comparison | undefined;
  readonly plan: CorrectionPlan;
  /** Réserves de la vague, reprises telles quelles (moteurs non couverts, incidents…). */
  readonly caveats: readonly string[];
  /**
   * Vague simulée (`--dry-run`) : le moteur est un simulateur, les chiffres ne décrivent personne. Un rapport de
   * simulation doit être impossible à confondre avec un vrai — un opérateur pourrait sinon l'envoyer à un client
   * qui a payé.
   */
  readonly simulated: boolean;
}

/** Une part observée qui s'arrondit à 0,0 % ne doit pas s'afficher comme un zéro : elle a bien été comptée. */
const share = (value: number): string => (value > 0 && value * 100 < 0.05 ? `< ${pct(0.001)}` : pct(value));
const range = (interval: Interval | null): string => (interval === null ? "—" : `[${pct(interval.low)} ; ${pct(interval.high)}]`);
const cell = (stage: StageCount, draws: number): string => `${stage.successes} fois sur ${draws} · ${range(stage.interval)}`;

/** Chaque étape est nommée par la question qu'un recruteur se poserait, pas par son code interne. */
const QUESTION: Readonly<Record<Stage, string>> = {
  E1: "Vos pages sont-elles connues des moteurs ?",
  E2: "Vos pages sont-elles retrouvées pour ce genre d'offre ?",
  E3: "Êtes-vous nommé dans la réponse ?",
  E4: "Êtes-vous parmi les cinq premiers cités ?",
  E5: "La réponse renvoie-t-elle vers vous ?",
};

const header = (input: ClientReportInput): Block[] => [
  heading(1, "Votre visibilité dans les réponses des IA — ", input.client.displayName, input.simulated ? " — SIMULATION" : ""),
  ...(input.simulated
    ? [
        paragraph(
          b("⚠ SIMULATION — ce rapport ne doit pas être remis à un client."),
          " La vague a été produite par un moteur simulé (", c("--dry-run"), ") : aucune IA n'a été interrogée, et les chiffres ci-dessous ne décrivent personne. Ce document sert à vérifier la chaîne de production, il ne mesure rien.",
        ),
      ]
    : []),
  paragraph("Référence : ", c(input.client.reference), " · Mesure du ", b(day(input.wave.measuredAt)), " · Vague ", c(input.wave.id)),
  table(
    ["Élément", "Valeur"],
    [
      ["Réponses analysées", [b(String(input.wave.draws))]],
      ...Object.entries(input.wave.models)
        .sort(([a], [z]) => a.localeCompare(z))
        .map(([engine, model]) => [`Modèle interrogé — ${engine}`, [c(model)]] as const),
      ["Empreinte du protocole figé", [c(input.wave.manifestDigest)]],
    ],
  ),
  paragraph(
    "Le protocole est figé ",
    b("avant"),
    " la mesure : les offres, les formulations et le nombre de tirages ne changent pas en cours de route. Son empreinte ci-dessus permet de vérifier qu'il n'a pas été retouché après coup.",
  ),
];

const jobs = (input: ClientReportInput): Block[] => [
  heading(2, "Les offres sur lesquelles vous avez été mesuré"),
  table(
    ["Offre", "Origine", "Rôle"],
    input.jobDescriptions.map((jd) => [
      jd.label,
      jd.provenance === "client" ? "fournie par vous" : "choisie par Proofseen",
      jd.role === "target" ? "cible" : "témoin",
    ]),
  ),
  paragraph(
    "Les offres ",
    b("témoins"),
    " ne vous correspondent pas : elles servent à vérifier que les moteurs ne citent pas n'importe qui au hasard. Y apparaître serait un mauvais signe, pas un bon.",
  ),
  // Le dire sans donner le chiffre reviendrait à énoncer un critère sans jamais l'appliquer devant le client.
  input.controlRetrieval === null
    ? paragraph("Votre profil n'a pas pu être compté sur les offres témoins : ce contrôle n'a rien donné pour cette vague.")
    : input.controlRetrieval.p === 0
      ? paragraph("Sur ces offres témoins, vous n'avez été retrouvé ", b("aucune fois"), ` — fourchette ${range(input.controlRetrieval)}. C'est le résultat attendu.`)
      : paragraph(
          "⚠ Sur ces offres témoins, vous avez été retrouvé dans ",
          b(pct(input.controlRetrieval.p)),
          ` des réponses — fourchette ${range(input.controlRetrieval)}. Les moteurs vous proposent donc aussi sur des missions qui ne vous correspondent pas : les taux ci-dessous sont à lire avec cette réserve.`,
        ),
];

const funnelSection = (input: ClientReportInput): Block[] => {
  const blocks: Block[] = [
    heading(2, "Où vous en êtes, étape par étape"),
    paragraph(
      "Chaque cellule donne le ",
      b("compte brut"),
      " puis la ",
      b("fourchette"),
      " dans laquelle se situe le taux réel. Une fourchette large veut dire « trop peu de tirages pour trancher », pas « mauvais résultat ».",
    ),
    input.indexation === null
      ? paragraph(b(QUESTION.E1), " — non mesuré pour cette vague.")
      : paragraph(
          b(QUESTION.E1),
          " — ",
          b(`${input.indexation.pagesIndexed} page(s) indexée(s)`),
          ` sur ${input.indexation.pagesDeclared} déclarée(s), relevé du ${day(input.indexation.checkedAt)}.`,
        ),
    table(
      ["Moteur", "Réponses", QUESTION.E2, QUESTION.E3, QUESTION.E4, QUESTION.E5],
      input.funnel.map((engine) => [
        engine.engine,
        String(engine.draws),
        cell(engine.retrieved, engine.draws),
        cell(engine.named, engine.draws),
        cell(engine.top5, engine.draws),
        cell(engine.cited, engine.draws),
      ]),
    ),
  ];
  const blocking = input.plan.blockingStage;
  blocks.push(
    blocking === null
      ? paragraph(
          b("Aucune étape ne bloque"),
          " sur cette mesure : votre profil franchit chaque étape sur au moins un moteur. Il n'y a donc pas de correction à vous proposer — ce qui ne dit rien de ce qui se passera sur une autre offre ou à une autre date.",
        )
      : paragraph(
          b(`L'étape qui bloque : ${blocking} — ${QUESTION[blocking]}`),
          " C'est par là qu'il faut commencer : corriger une étape plus tardive ne produit rien tant que celle-ci ne passe pas.",
        ),
  );
  return blocks;
};

const sources = (input: ClientReportInput): Block[] => [
  heading(2, "Ce que les IA lisent pour ce genre d'offre"),
  paragraph(
    "Part des sources citées dans les réponses analysées. Nous ne conservons que des ",
    b("domaines"),
    " : ni les noms ni les profils des personnes citées à votre place n'apparaissent ici, et nous ne vous les communiquerons pas.",
  ),
  table(
    ["Source", "Part des citations"],
    Object.entries(input.sourceShare)
      .sort(([a, partA], [z, partZ]) => partZ - partA || a.localeCompare(z))
      .map(([domain, part]) => [[c(domain)], share(part)]),
  ),
];

const COMPARED: Readonly<Record<FunnelStage, string>> = {
  retrieved: "Vos pages retrouvées",
  named: "Vous êtes nommé",
  top5: "Vous êtes dans les cinq premiers",
  cited: "La réponse renvoie vers vous",
};


/**
 * Ce qui a changé entre deux mesures — et ce qu'on a le droit d'en conclure.
 *
 * Entre deux mesures, deux choses ont pu bouger : le profil du client, et les moteurs. Annoncer un écart sans le dire
 * reviendrait à vendre comme un résultat ce qui peut être une dérive. Le verdict est donc donné avant les chiffres,
 * et il se tait quand les chiffres ne permettent rien.
 */
const comparisonSection = (comparison: Comparison): Block[] => {
  const drift = comparison.controlDrift;
  const verdict =
    comparison.verdict === "attributable"
      ? [
          paragraph(
            b("Vos chiffres ont bougé, ceux des offres témoins non."),
            " L'écart vient donc de ce qui a changé sur vos surfaces, et non d'un changement des moteurs. Il reste que nous mesurons une tendance : rien ne garantit qu'elle se maintienne.",
          ),
        ]
      : comparison.verdict === "confounded"
        ? [
            paragraph(
              b("⚠ Les moteurs ont changé entre les deux mesures."),
              ` Le taux des offres témoins — celles qui ne vous correspondent ni avant ni après — a bougé de ${points(drift?.delta ?? 0)}. Une partie de l'écart ci-dessous ne vient donc pas de vous, et nous ne savons pas dire laquelle. Nous ne nous en attribuons pas le mérite.`,
            ),
          ]
        : comparison.verdict === "flat"
          ? [paragraph(b("Rien n'a bougé de façon lisible"), " entre les deux mesures. Ce n'est pas un échec de votre part : l'indexation et la reprise par les moteurs prennent souvent plus de temps.")]
          : [
              paragraph(
                b("La dérive des moteurs n'a pas pu être mesurée"),
                " sur cette comparaison : les offres témoins n'ont rien donné. Nous ne pouvons donc attribuer aucun écart, ni à vous ni aux moteurs.",
              ),
            ];

  return [
    heading(2, "Ce qui a changé depuis la mesure précédente"),
    ...verdict,
    table(
      ["Étape", "Avant", "Après", "Écart"],
      comparison.stages.map((stage) => [
        COMPARED[stage.stage],
        `${stage.before.successes} / ${stage.before.draws}`,
        `${stage.after.successes} / ${stage.after.draws}`,
        points(stage.delta),
      ]),
    ),
    paragraph(
      "L'écart est donné en ",
      b("points de pourcentage"),
      ", pas en nombre de citations : deux mesures peuvent ne pas porter le même nombre de réponses.",
    ),
  ];
};

const planSection = (plan: CorrectionPlan): Block[] => {
  if (plan.actions.length === 0) return [];
  const blocks: Block[] = [
    heading(2, "Plan de correction"),
    paragraph(
      `${plan.actions.length} action(s), dans l'ordre où les faire. Chacune vient d'un chiffre de votre mesure : nous ne proposons pas de bonne pratique générale.`,
    ),
  ];
  for (const action of plan.actions) {
    blocks.push(
      heading(3, `${action.rank}. ${action.title}`),
      definitions([
        { term: [b("Pourquoi")], detail: action.why },
        { term: [b("Où l'appliquer")], detail: action.where },
        { term: [b("Effort")], detail: action.effort },
        { term: [b("Ce qui le montre")], detail: action.evidence },
      ]),
    );
  }
  if (plan.dropped > 0) {
    blocks.push(paragraph(`${plan.dropped} action(s) supplémentaire(s) ont été écartées pour tenir la limite de huit annoncée dans l'offre.`));
  }
  return blocks;
};

const notActionable = (plan: CorrectionPlan): Block[] =>
  plan.notActionable.length === 0 ? [] : [heading(2, "Ce qui ne dépend pas de vous"), list(plan.notActionable)];

const limits = (input: ClientReportInput): Block[] => [
  heading(2, "Ce que ce rapport ne dit pas"),
  list([
    [
      b("Aucun rang, aucune apparition, aucun contact et aucune mission ne vous sont promis."),
      " Ce rapport compte ce qui a été observé à une date donnée ; il ne prédit pas la suite.",
    ],
    [
      "Les réponses ont été obtenues ",
      b("par API"),
      ", sur de nombreux tirages. Les ",
      b("applications"),
      " grand public (ChatGPT, Claude, Perplexity) ajoutent leurs propres réglages — historique, localisation, version du modèle — et peuvent donner un autre résultat le même jour.",
    ],
    "Être cité est une propriété du couple (vous, ce moteur), à cette date. Un résultat ne se transporte ni à un autre moteur ni à un autre mois sans nouvelle mesure.",
    "Nous observons les réponses et nous les comptons. Nous ne connaissons pas le fonctionnement interne de ces systèmes et nous ne prétendons pas le connaître.",
    ...input.caveats,
  ]),
];

/** Le rapport comme document : c'est lui le fond, les deux rendus n'en sont que la forme. */
export const buildClientReport = (input: ClientReportInput): ReportDocument => {
  if (input.wave.draws === 0) throw new Error("rapport impossible : la vague ne porte aucun tirage");
  return [
    ...header(input),
    ...jobs(input),
    ...funnelSection(input),
    ...(input.comparison === undefined ? [] : comparisonSection(input.comparison)),
    ...sources(input),
    ...planSection(input.plan),
    ...notActionable(input.plan),
    ...limits(input),
  ];
};

/** Rapport client en Markdown. Une vague sans tirage ne produit pas de rapport : elle produit une erreur. */
export const renderClientReport = (input: ClientReportInput): string => toMarkdown(buildClientReport(input));

/** Le même rapport en page autonome : le client l'ouvre hors ligne, l'imprime, le garde. */
export const renderClientReportHtml = (input: ClientReportInput): string => {
  const document = buildClientReport(input);
  return toHtml(document, { lang: "fr", title: documentTitle(document) });
};
