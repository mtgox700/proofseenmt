import { IdentitySchema, type Identity } from "@proofseen/core";
import type { ExperimentManifest, NamedIdentity, PublicProfile } from "@proofseen/profiles";
import type { Arm, ArmDraw, ThreeArmVerdict } from "@proofseen/stats";
import type { ArmRecord, StoredDraw } from "./records";

/*
 * Glue between the three-arm test and the Recruiter Simulator (PIVOT_ANONYME §5): each arm becomes an identity the
 * wave can recognise, and the wave's per-arm records become the verdict's input.
 */

export const ARM_IDS: Readonly<Record<Arm, string>> = { A: "arm-A", B: "arm-B", C: "arm-C" };

/**
 * One identity per arm, built from the experiment manifest so the URLs cannot drift from what was published.
 * `verifiedAt` is the date the founder proved Proofseen owns the domain: without it, no URL may count as ours.
 */
export const armIdentities = (manifest: ExperimentManifest, twin: PublicProfile, named: NamedIdentity, verifiedAt: string): Identity[] => {
  const urlsOf = (arm: Arm): string[] => [...(manifest.arms.find((a) => a.arm === arm)?.urls ?? [])];
  // The proof is dated by day; the identity schema stores an instant: midnight UTC of that day.
  const owned = (arm: Arm) => urlsOf(arm).map((url) => ({ url, proofMethod: "well_known_file" as const, verifiedAt: `${verifiedAt}T00:00:00Z` }));
  const city = twin.area.split("/")[0]!.trim();
  const stack = [...twin.skills];
  // Le bras C est facultatif (test à 2 bras) ; A et B, eux, sont le cœur de la comparaison.
  if (urlsOf("A").length === 0 || urlsOf("B").length === 0) {
    throw new Error("le manifeste du test ne porte pas les URL des bras A et B : régler d'abord les bloquants de `experiment`");
  }
  return [
    { id: ARM_IDS.A, displayName: named.displayName, nameVariants: [named.displayName], city, stack, ownedUrls: owned("A") },
    // The pseudonymous arm is recognised by its handle and its public identifier, never by the real name.
    { id: ARM_IDS.B, displayName: twin.handle, nameVariants: [twin.handle, twin.id], city, stack, ownedUrls: owned("B") },
    // The entry page names nobody: it counts when its URL is cited. Its title only fills the required name slot.
    ...(urlsOf("C").length === 0
      ? []
      : [{ id: ARM_IDS.C, displayName: "Page d'entrée", nameVariants: ["Proofseen page d'entrée"], city, stack, ownedUrls: owned("C") }]),
  ].map((identity) => IdentitySchema.parse(identity));
};

const armOf = (armId: string): Arm | null => (Object.entries(ARM_IDS).find(([, id]) => id === armId)?.[0] as Arm | undefined) ?? null;

/**
 * Verdict input from a wave: errored draws are excluded (never counted as "not cited"), a draw seen twice after a
 * resume keeps its last record, and "cited" follows the definitions fixed in stats/threearm.ts.
 */
export const armDrawsFrom = (draws: readonly StoredDraw[], records: readonly ArmRecord[]): ArmDraw[] => {
  const ok = new Map(draws.filter((d) => d.status === "ok").map((d) => [d.id, d]));
  const latest = new Map(records.map((r) => [`${r.drawId}|${r.armId}`, r]));
  return [...latest.values()].flatMap((record) => {
    const draw = ok.get(record.drawId);
    const arm = armOf(record.armId);
    if (draw === undefined || arm === null) return [];
    const cited = arm === "C" ? record.cited : record.type === "certain";
    return [{ drawId: record.drawId, arm, cited, jdRole: draw.jdRole }];
  });
};

const pct = (value: number): string => `${(value * 100).toFixed(1)} %`;
const LABEL = {
  refuted: "RÉFUTÉ",
  not_refuted: "non réfuté",
  inconclusive: "non concluant",
  retained: "RETENU",
  not_retained: "non retenu",
  not_tested: "NON TESTÉ (bras C non publié)",
} as const;

/** Délivrance : dire « non relevé » plutôt que laisser croire que l'absence d'alerte vaut vérification. */
const DELIVERY = {
  yes: "oui — toutes les pages des bras joués étaient indexées",
  partial: "PARTIELLEMENT — certains bras n'étaient pas indexés",
  no: "NON — aucune page n'était indexée",
  unknown: "NON RELEVÉ — l'indexation n'a pas été vérifiée pour cette vague",
} as const;

/** A dry-run wave uses a simulated engine that only knows the main identity: its numbers mean nothing. */
export const renderVerdict = (waveId: string, day: number, date: string, verdict: ThreeArmVerdict, simulated: boolean): string => {
  const row = (arm: Arm, label: string): string => {
    const r = verdict.rates[arm];
    return r.interval === null
      ? `| ${arm} — ${label} | ${r.cited}/${r.n} | — | — |`
      : `| ${arm} — ${label} | ${r.cited}/${r.n} | ${pct(r.interval.p)} | ${pct(r.interval.low)} – ${pct(r.interval.high)} |`;
  };
  return [
    `# Test à 3 bras — vague ${waveId}, J+${day}${simulated ? " — SIMULATION" : ""}`,
    "",
    ...(simulated
      ? ["> ⚠ **SIMULATION (vague --dry-run) : ces chiffres n'ont aucune valeur.** Le moteur simulé ne connaît que l'identité principale ; ce rapport vérifie la chaîne, il ne décide rien.", ""]
      : []),
    `> Généré le ${date}. Règles pré-enregistrées (PIVOT_ANONYME §5), appliquées mécaniquement. ${simulated ? "**Aucune décision : simulation.**" : verdict.final ? "**Décision finale.**" : "**Point d'étape : aucune décision avant J+60.**"}`,
    "",
    "| Bras | Citations / tirages | Taux | IC 95 % (Wilson) |",
    "|---|---|---|---|",
    row("A", "nominatif (reconnu avec certitude)"),
    row("B", "pseudonyme (reconnu avec certitude)"),
    row("C", "page d'entrée (URL citée, JD cibles)"),
    "",
    `- Tirages valides : **${verdict.draws}** (tirages en erreur exclus).`,
    `- B parmi les tirages qui citent A : **${verdict.bGivenA.cited}/${verdict.bGivenA.n}**${verdict.bGivenA.share === null ? "" : ` (${pct(verdict.bGivenA.share)})`}.`,
    "",
    "## Verdict",
    "",
    `- **Mécanisme A** (fiche pseudonyme individuelle) : **${LABEL[verdict.mechanismA]}**`,
    `- **Mécanisme B** (page d'entrée) : **${LABEL[verdict.mechanismB]}**`,
    `- Les trois bras échouent : **${verdict.allFailed ? "oui — voie « se faire citer » close pour P0" : "non"}**`,
    // Sans cette ligne, un lecteur presse lirait « non » sans savoir si c'est parce que les chiffres parlent ou parce
    // que les pages n'étaient pas dans l'index. Les deux « non » n'ont rien à voir.
    `- Traitement délivré aux moteurs (pages indexées) : **${DELIVERY[verdict.delivered]}**`,
    "",
    ...(verdict.delivered === "unknown"
      ? [
          "> ⚠ **L'indexation n'a pas été relevée pour cette vague.** Un bras dont les pages ne sont pas dans l'index ne peut pas être cité : son zéro ne dit rien de l'hypothèse. Tant que ce relevé manque, **aucune voie ne peut être déclarée close**.",
          "",
        ]
      : verdict.delivered === "yes"
        ? []
        : [
            verdict.delivered === "no"
              ? "> ⚠ **Aucune page n'était indexée au moment de la mesure.** Le traitement n'a atteint aucun moteur : ces chiffres ne mesurent pas l'hypothèse, ils mesurent l'indexation. **Aucune conclusion n'est tirée de ces zéros.**"
              : "> ⚠ **Une partie des pages n'était pas indexée au moment de la mesure.** Le traitement n'a pas atteint les moteurs pour ces bras : leurs chiffres ne mesurent pas l'hypothèse, ils mesurent l'indexation. **Aucune conclusion n'est tirée de leur zéro.**",
            "",
          ]),
    "## Raisons",
    "",
    ...verdict.reasons.map((reason) => `- ${reason}`),
    "",
    "## Ce que ce rapport ne dit pas",
    "",
    "- Une citation n'est pas une mission : ce test mesure la **mécanique de citation**, pas la conversion.",
    "- Les bras A et B désignent la même personne : le bras pseudonyme **n'est pas anonyme** pendant le test (PIVOT_ANONYME §11).",
    "- Un résultat vaut pour ces moteurs, ces JD et ces dates ; il ne se généralise pas sans nouvelle mesure.",
    "- Un bras absent de l'index n'a pas été testé : son zéro mesure l'indexation, pas la citation.",
    "",
  ].join("\n");
};
