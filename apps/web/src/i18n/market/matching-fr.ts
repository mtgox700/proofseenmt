import type { MatchCriterion } from "@proofseen/db";

/**
 * Explained matching (C22): "Missions pour vous" and "Profils qui correspondent". Every suggestion says why it is
 * proposed, the ordering rule is written on screen, and no percentage or score exists anywhere.
 */
export const matchingFr = {
  criteria: {
    skills: "Compétences",
    job_title: "Métier",
    city: "Ville",
    work_mode: "Mode de travail",
    rate: "TJM",
    availability: "Disponibilité",
    languages: "Langues",
    proven_address: "Adresse prouvée",
    verified_missions: "Missions vérifiées",
    registry_active: "SIRET actif",
    vigilance_valid: "Attestation URSSAF",
    company_registry: "Entreprise active au répertoire",
  } satisfies Record<MatchCriterion, string>,
  reasons: {
    skills: (n: number, list: string) => `${n === 1 ? "1 compétence en commun" : `${n} compétences en commun`} (${list})`,
    more: (n: number) => `et ${n} autre${n > 1 ? "s" : ""}`,
    jobTitle: (labels: string) => `même métier (${labels})`,
    city: (city: string) => `même ville (${city})`,
    workMode: (mode: string) => `mode de travail qui convient (${mode})`,
    rateBudget: "TJM dans le budget",
    rateOverlap: "fourchettes de TJM qui se recouvrent",
    rateClose: "TJM proche (moins d'un cinquième d'écart)",
    availableNow: "disponible",
    availableFrom: (date: string) => `disponible dès le ${date}`,
    languages: (list: string) => `langues en commun (${list})`,
    provenAddress: "adresse en ligne prouvée",
    verifiedMissions: (n: number) => (n === 1 ? "1 mission vérifiée" : `${n} missions vérifiées`),
    registryActive: "SIRET actif au répertoire",
    vigilanceValid: "attestation URSSAF vérifiée",
    companyRegistry: "entreprise active au répertoire",
  },
  missing: "Ne remplit pas\u202f:",
  forYou: {
    title: "Missions pour vous",
    lead: "Des missions ouvertes qui partagent au moins une compétence avec votre profil, rapprochées sur des faits. Chacune dit pourquoi elle est là.",
    rule: "Ordre\u202f: nombre de critères remplis parmi ceux que vous comptez, puis nombre de compétences en commun, puis la mission publiée le plus récemment.",
    seeAll: "Toutes les missions pour vous",
    noProfile: "Créez votre profil pour voir des missions qui vous correspondent.",
    empty: "Aucune mission ouverte ne partage de compétence avec votre profil pour l'instant.",
    capped: (n: number) => `Seules les ${n} missions les plus récentes qui partagent une compétence ont été comparées.`,
    considered: (n: number) => (n === 1 ? "1 mission comparée." : `${n} missions comparées.`),
    apply: "Postuler",
  },
  filters: {
    title: "Critères",
    counted: "Critères comptés pour l'ordre",
    required: "Critères exigés",
    requiredHint: "Une mission qui ne remplit pas un critère exigé n'est pas proposée\u202f; un critère sans objet (la ville d'une mission en télétravail) ne l'écarte pas.",
    apply: "Appliquer",
    reset: "Tout réinitialiser",
  },
  forMission: {
    title: "Profils qui correspondent",
    lead: "Des profils publiés qui partagent au moins une compétence avec la mission, rapprochés sur des faits. Ce n'est ni une note ni un classement des personnes\u202f: chaque critère est affiché.",
    rule: "Ordre\u202f: nombre de critères remplis, puis nombre de compétences en commun, puis le profil mis à jour le plus récemment.",
    empty: "Aucun profil publié ne partage de compétence avec cette mission pour l'instant.",
    invite: "Inviter à postuler",
    invited: "Déjà invité",
    addTo: "Ajouter à la liste",
    add: "Ajouter",
    noList: "Créer une liste",
    listNotice: { added: "Profil ajouté à la liste.", already: "Ce profil est déjà dans la liste.", limit: "La liste est pleine.", absent: "Liste introuvable." },
  },
};

export type MatchingDictionary = typeof matchingFr;
