/*
 * La prochaine action d'un client, décidée sur des faits.
 *
 * Deux surfaces vont afficher cet état — la CLI de l'opérateur et l'espace client — et elles doivent être d'accord.
 * Pas « afficher la même phrase » : *être d'accord sur l'état*. Si le tableau de bord dit « à livrer » quand l'espace
 * client dit « livré », l'un des deux mentira à quelqu'un qui a payé.
 *
 * Ce fichier ne produit donc aucune phrase. Il rend une valeur que chaque surface formule à sa façon — et un défaut
 * déjà présent disparaît au passage : `client-status` décidait de la suite en relisant son propre affichage
 * (`!surface.startsWith("ok")`). Renommer une colonne y changeait la logique, sans qu'un test le voie.
 *
 * L'ordre suit celui où la chaîne refuse d'avancer, pas l'ordre du bon sens : c'est celui-là qui est vrai.
 */

/** Ce qui est établi sur un client, sans jugement ni mise en forme. */
export interface ClientFacts {
  /** Faux quand l'identité n'a pas pu être lue. Rien ne peut alors être affirmé sur ce client. */
  readonly identityReadable: boolean;
  /** Au moins un champ reste sur le marqueur « à renseigner ». */
  readonly hasPlaceholders: boolean;
  readonly ownedUrls: number;
  readonly verifiedUrls: number;
  /**
   * Trace du contrôle de surface. `unreadable` est distinct de `missing` : afficher « absent » pour un fichier
   * corrompu fait croire à une étape jamais faite, et masque le fait qu'il y a quelque chose à réparer.
   */
  readonly surface: "missing" | "unreadable" | "blocked" | "fresh";
  /**
   * Manifeste de la vague. `unreadable` ne vaut surtout pas `missing` : `missing` mène à `build_wave`, qui écrirait
   * par-dessus — y compris par-dessus un manifeste déjà figé, c'est-à-dire par-dessus l'instrument avec lequel un
   * client payant a été mesuré.
   */
  readonly manifest: "missing" | "unreadable" | "draft" | "frozen";
  readonly measured: boolean;
  readonly reportDelivered: boolean;
}

export type NextAction =
  | { readonly kind: "unreadable" }
  | { readonly kind: "fill_identity" }
  | { readonly kind: "prove_possession" }
  | { readonly kind: "check_surface"; readonly reason: "missing" | "unreadable" | "blocked" }
  | { readonly kind: "build_wave" }
  | { readonly kind: "repair_manifest" }
  | { readonly kind: "freeze_manifest" }
  | { readonly kind: "measure" }
  | { readonly kind: "deliver_report" }
  | { readonly kind: "done" };

/**
 * La prochaine action, ou `done`.
 *
 * Un rapport remis clôt le cycle : on ne réclame plus rien, même si le contrôle de surface s'est périmé depuis.
 * Re-mesurer serait un nouveau cycle, pas la fin de celui-ci — et relancer un client livré est un défaut qu'il voit.
 */
export const nextAction = (facts: ClientFacts): NextAction => {
  if (!facts.identityReadable) return { kind: "unreadable" };
  if (facts.reportDelivered) return { kind: "done" };
  if (facts.hasPlaceholders) return { kind: "fill_identity" };
  if (facts.verifiedUrls === 0) return { kind: "prove_possession" };
  // Une trace illisible se refait sans risque : le contrôle est idempotent, il ne détruit rien d'irremplaçable.
  if (facts.surface !== "fresh") return { kind: "check_surface", reason: facts.surface };
  if (facts.manifest === "missing") return { kind: "build_wave" };
  // Un manifeste illisible, lui, se répare ou se supprime à la main. Le remonter automatiquement écraserait un
  // `frozenAt` qu'on ne peut plus lire — et rien ne dit qu'il n'a pas déjà servi à mesurer.
  if (facts.manifest === "unreadable") return { kind: "repair_manifest" };
  if (facts.manifest === "draft") return { kind: "freeze_manifest" };
  if (!facts.measured) return { kind: "measure" };
  return { kind: "deliver_report" };
};

/**
 * Qui doit agir. L'espace client n'a pas à afficher « figer le manifeste » : ce n'est pas son travail, et le lui
 * montrer transforme une étape interne en attente inexpliquée.
 */
export const actor = (action: NextAction): "client" | "proofseen" =>
  action.kind === "fill_identity" || action.kind === "prove_possession" ? "client" : "proofseen";

/** Une action bloquée par le client : Proofseen ne peut rien faire avancer tant qu'elle n'est pas faite. */
export const waitingOnClient = (action: NextAction): boolean => actor(action) === "client";
