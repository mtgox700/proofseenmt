import type { NextStepKey } from "@/lib/next-steps";

/** Ce que propose un écran vide de l'espace connecté (C23) : que faire ensuite, chaque fois avec son lien. */
export const nextStepsFr = {
  title: "Que faire maintenant",
  steps: {
    publish_profile: "Publier votre profil\u202f: les étapes sont sur votre accueil",
    follow_companies: "Suivre des entreprises",
    find_freelancers: "Trouver des freelances à suivre",
    discover: "Lire les publications récentes",
    write_post: "Écrire la première publication",
    post_mission: "Publier une mission",
    mission_alert: "Créer une alerte de missions",
    browse_missions: "Parcourir toutes les missions ouvertes",
    clear_filters: "Retirer les filtres",
    invite_clients: "Inviter une entreprise cliente",
    invite_freelancers: "Inviter les freelances avec qui vous travaillez",
  } satisfies Readonly<Record<NextStepKey, string>>,
};

export type NextStepsDictionary = typeof nextStepsFr;
