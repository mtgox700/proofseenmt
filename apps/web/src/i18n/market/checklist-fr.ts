/** Liste de contrôle du profil : les faits qu'une IA doit pouvoir lire, faits ou manquants. Jamais une note. */
export const checklistFr = {
  title: "Ce que les IA peuvent lire de vous",
  lead: "Chaque ligne est un fait que les moteurs d'IA lisent sur votre page publique. Ce n'est pas une note : la liste dit seulement ce qui manque et où le compléter.",
  allDone: "Tous les faits sont en place.",
  missing: (count: number) => (count > 1 ? `${count} faits manquants` : "1 fait manquant"),
  seeAll: "Voir la liste complète",
  groups: { page: "Sur votre page", proof: "Ce qui le prouve" },
  done: "Fait",
  todo: "Manquant",
  fix: "Compléter",
  items: {
    published: {
      label: "Profil publié",
      why: "Une page privée n'existe pas pour les moteurs : rien de ce qui suit n'est lu tant qu'elle n'est pas publiée.",
    },
    headline: {
      label: "Titre",
      why: "C'est la phrase qu'une IA compare à la question d'un recruteur : votre métier et votre spécialité.",
    },
    summary: {
      label: (min: number) => `Résumé de ${min} caractères au moins`,
      why: "Le résumé donne aux moteurs de quoi décrire vos missions ; trop court, la page est jugée vide et n'est pas indexée.",
    },
    skills: {
      label: (min: number) => `${min} compétences au moins`,
      why: "Les compétences sont les mots que les questions contiennent : sans elles, votre page ne répond à aucune.",
    },
    city: {
      label: "Ville",
      why: "Beaucoup de demandes précisent une ville : sans elle, la page ne peut pas y répondre.",
    },
    workMode: {
      label: "Mode de travail",
      why: "Sur site, hybride ou à distance : une IA l'utilise pour écarter ou retenir une page.",
    },
    dailyRate: {
      label: "TJM",
      why: "Un tarif affiché permet de répondre aux demandes qui fixent un budget.",
    },
    availability: {
      label: "Disponibilité à jour",
      why: "Une date dépassée dit une chose fausse aux moteurs ; à jour, elle répond à « disponible quand ? ».",
    },
    provenAddress: {
      label: "Au moins une adresse prouvée",
      why: "Une citation ne compte comme la vôtre que si elle pointe vers une adresse dont vous avez prouvé la possession.",
    },
    siret: {
      label: "SIRET vérifié au répertoire",
      why: "Un établissement actif au répertoire officiel est un fait vérifiable affiché sur votre profil.",
    },
    vigilance: {
      label: "Attestation URSSAF vérifiée",
      why: "Une attestation de vigilance en cours de validité est affichée comme un fait daté sur votre profil.",
    },
  },
  notes: {
    too_short: "Le résumé est trop court.",
    too_few: "Pas encore assez de compétences.",
    date_passed: "La date de disponibilité est passée.",
    awaiting_check: "SIRET saisi, vérification au répertoire en attente.",
    registry_problem: "Le répertoire ne confirme pas ce SIRET pour votre raison sociale.",
    expired: "L'attestation a expiré : déclarez la nouvelle.",
    awaiting_operator: "Attestation déclarée, en attente de vérification par l'équipe.",
  },
};

export type ChecklistDictionary = typeof checklistFr;
