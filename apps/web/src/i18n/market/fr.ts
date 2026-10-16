import { accountFr } from "./account-fr";
import { articlesFr } from "./articles-fr";
import { billingFr } from "./billing-fr";
import { confirmationsFr } from "./confirmations-fr";
import { dealsFr } from "./deals-fr";
import { liveFr } from "./live-fr";
import { insightsFr } from "./insights-fr";
import { missionsFr } from "./missions-fr";
import { missionsSpaceFr } from "./missions-space-fr";
import { operatorFr } from "./operator-fr";
import { profileFr } from "./profile-fr";
import { proofsFr } from "./proofs-fr";
import { pwaFr } from "./pwa-fr";
import { searchFr } from "./search-fr";
import { settingsFr } from "./settings-fr";
import { standingFr } from "./standing-fr";
import { teamFr } from "./team-fr";
import { visibilityFr } from "./visibility-fr";

/*
 * Textes de l'espace connecté de la marketplace (missions, messages, devis, contrats, factures, entreprise). Séparés du
 * dictionnaire du site, qui décrit l'offre publique : chaque fichier reste lisible, et les deux langues ont exactement
 * les mêmes clés (le type de l'anglais est celui-ci).
 */

const kinds = {
  startup: "Start-up",
  scaleup: "Scale-up",
  grand_groupe: "Grand groupe",
  eti: "ETI",
  pme: "PME",
  secteur_public: "Secteur public",
  editeur_logiciel: "Éditeur de logiciel",
  esn: "ESN",
  association: "Association",
};

export const marketFr = {
  account: accountFr,
  articles: articlesFr,
  billing: billingFr,
  confirmations: confirmationsFr,
  deals: dealsFr,
  live: liveFr,
  insights: insightsFr,
  missions: missionsFr,
  missionsSpace: missionsSpaceFr,
  operator: operatorFr,
  profile: profileFr,
  proofs: proofsFr,
  pwa: pwaFr,
  search: searchFr,
  settings: settingsFr,
  standing: standingFr,
  team: teamFr,
  visibility: visibilityFr,
  nav: {
    messages: "Messages",
    missions: "Missions",
    company: "Entreprise",
  },
  notConfigured: "La base de données n'est pas configurée sur ce serveur : cet espace ne peut pas s'afficher.",
  company: {
    createTitle: "Créez votre entreprise",
    createLead: "Son nom apparaît sur vos missions publiques et dans vos échanges. Le SIRET peut attendre : il sera demandé avant le premier contrat.",
    name: "Nom de l'entreprise",
    nameHint: "Tel qu'il doit apparaître aux freelances. Pas d'adresse e-mail ni de numéro de téléphone.",
    kind: "Type d'entreprise",
    siret: "SIRET (facultatif)",
    siretHint: "14 chiffres. Il sera vérifié au répertoire officiel.",
    create: "Créer l'entreprise",
    kinds,
    roles: { owner: "Propriétaire", admin: "Administrateur", member: "Membre" },
    errors: {
      invalid: "Vérifiez le nom (2 caractères au moins, sans coordonnées) et le SIRET (14 chiffres).",
      tooMany: "Trop de créations en peu de temps : réessayez plus tard.",
      siret: "Ce SIRET est déjà celui d'une entreprise inscrite. Si c'est la vôtre, demandez à son propriétaire de vous ajouter.",
    },
  },
  inbox: {
    title: "Messages",
    lead: "Chaque échange passe par Proofseen. Le freelance est désigné par sa référence jusqu'au contrat ; il accepte ou refuse chaque prise de contact.",
    empty: "Aucun échange pour l'instant.",
    emptyCompany: "Ouvrez un profil public et écrivez au freelance, ou publiez une mission : les candidatures ouvrent un échange.",
    emptyFreelance: "Quand une entreprise vous écrit, ou quand vous postulez à une mission, l'échange apparaît ici.",
    you: "Vous",
    about: "Mission",
    direct: "Prise de contact directe",
    status: { pending: "En attente", accepted: "Accepté", declined: "Refusé", closed: "Clos" },
  },
  thread: {
    back: "Tous les messages",
    older: "Messages plus anciens",
    waitingCompany: "Votre message est transmis. Le freelance accepte ou refuse ; vous pourrez écrire de nouveau s'il accepte.",
    decideLead: "Cette entreprise souhaite échanger avec vous. Si vous acceptez, vous pourrez discuter de la mission ; votre identité légale ne lui sera communiquée qu'au contrat.",
    accept: "Accepter l'échange",
    decline: "Refuser",
    declined: "Cet échange a été refusé.",
    closed: "Cet échange est clos.",
    reply: "Votre message",
    replyHint: "Pas de coordonnées avant un paiement sécurisé : elles seraient refusées.",
    send: "Envoyer",
    close: "Clore l'échange",
    closeHint: "Définitif : plus aucun message ne pourra être envoyé.",
    contactBlocked: "Message refusé : il contient des coordonnées. Elles s'échangent une fois la mission payée sous séquestre.",
    tooMany: "Trop d'envois en peu de temps : réessayez dans une minute.",
    invalid: "Le message est vide ou trop long.",
    notAllowed: "Ce message ne peut pas être envoyé dans l'état actuel de l'échange.",
    flagged: "Coordonnées masquées par Proofseen",
  },
  contact: {
    title: (reference: string) => `Écrire à ${reference}`,
    lead: "Décrivez la mission : objectif, durée, démarrage, budget. Le freelance accepte ou refuse ; vous serez prévenu.",
    body: "Votre message",
    send: "Envoyer",
    noOrganisation: "Créez d'abord votre entreprise : c'est elle qui écrit au freelance.",
    notCompany: "Seul un compte entreprise peut écrire à un freelance.",
    existing: "Vous échangez déjà avec ce freelance : votre message n'a pas été envoyé, voici l'échange en cours.",
    limit: "Limite de prises de contact atteinte pour aujourd'hui, ou ce freelance a trop de demandes en attente. Réessayez plus tard.",
    contactBlocked: "Un premier message ne peut pas contenir de coordonnées : décrivez la mission, le reste suivra sur Proofseen.",
    invalid: "Le message est vide ou trop long.",
    tooMany: "Trop d'envois en peu de temps : réessayez dans une minute.",
  },
};

export type MarketDictionary = typeof marketFr;
