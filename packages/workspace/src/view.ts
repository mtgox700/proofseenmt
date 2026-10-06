import { actor, nextAction, type ClientFacts, type NextAction } from "./next-action";

/*
 * L'état d'un client, en un objet.
 *
 * Trois consommateurs le liront : le tableau de bord de l'opérateur, l'espace client, et l'export qui sert de données
 * réelles au front. Chacun en affichera autre chose. Aucun ne doit le recalculer.
 *
 * Deux règles portées par le type lui-même :
 *
 *  - **Ce qui n'a pas pu être lu est nommé.** Une case vide et une case illisible ne sont pas la même chose ; confondre
 *    les deux fait afficher « aucune URL prouvée » à un client qui en a prouvé deux, parce qu'un fichier était corrompu.
 *  - **Rien de sensible ne passe.** Cette vue part vers un navigateur. Elle ne porte donc ni le secret de possession, ni
 *    les jetons, ni le texte des offres, ni une réponse de moteur — c'est-à-dire rien qui, indexé, nommerait un tiers ou
 *    permettrait de rejouer une preuve.
 */

export interface ClientViewInput {
  readonly reference: string;
  /** `null` quand l'identité n'a pas pu être lue : on n'invente pas un nom pour remplir une colonne. */
  readonly displayName: string | null;
  readonly facts: ClientFacts;
  /** Date du dernier contrôle de surface, `YYYY-MM-DD`, ou `null` s'il n'y en a pas eu de lisible. */
  readonly surfaceCheckedAt: string | null;
  readonly waveId: string | null;
  /** Noms des rapports remis. Les noms, pas les chemins : un chemin de disque n'a rien à faire dans un navigateur. */
  readonly reportFiles: readonly string[];
  /** Ce qui n'a pas pu être lu, nommé fichier par fichier. */
  readonly unreadable: readonly string[];
}

export interface ClientView extends ClientViewInput {
  readonly action: NextAction;
  /** Qui doit agir. L'espace client n'affiche en « à faire » que ce qui lui revient. */
  readonly actor: "client" | "proofseen";
  /** Vrai quand le cycle est clos : un rapport a été remis. */
  readonly complete: boolean;
}

export const buildClientView = (input: ClientViewInput): ClientView => {
  const action = nextAction(input.facts);
  return { ...input, action, actor: actor(action), complete: action.kind === "done" };
};

/** Tri d'affichage : ce qui attend le client d'abord, puis ce qui attend Proofseen, les dossiers clos en dernier. */
export const byUrgency = (a: ClientView, b: ClientView): number => {
  const rank = (view: ClientView): number => (view.complete ? 2 : view.actor === "client" ? 0 : 1);
  return rank(a) - rank(b) || a.reference.localeCompare(b.reference);
};

/** Le résumé, compté une seule fois, pour qu'aucune surface ne le recompte à sa façon. */
export const summarise = (views: readonly ClientView[]): { readonly total: number; readonly complete: number; readonly waitingOnClient: number } => ({
  total: views.length,
  complete: views.filter((view) => view.complete).length,
  waitingOnClient: views.filter((view) => !view.complete && view.actor === "client").length,
});
