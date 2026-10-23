/*
 * Le menu de l'espace en sections de base (CONNECTED_PLAN §2.5) : peu d'entrées, chacune une étape du dossier, et
 * les pages d'une même section en onglets. Aucun nom de personne, d'entreprise ou de mission ici.
 */
export const workspaceNavFr = {
  /** Le nom accessible de la rangée d'onglets : la section qu'elle détaille. */
  tabsLabel: (section: string) => `${section}, pages de la section`,
  sections: {
    home: "Accueil",
    profile: "Profil",
    proofs: "Preuves",
    visibility: "Visibilité IA",
    missions: "Missions",
    search: "Recherche",
    confirmations: "Confirmations",
    messages: "Messages",
    contracts: "Contrats",
    money: "Argent",
    team: "Équipe",
    network: "Réseau",
    account: "Compte",
    backOffice: "Back-office",
    articles: "Articles",
    directory: "Annuaire",
  },
  tabs: {
    applications: "Candidatures",
    forYou: "Pour vous",
    saved: "Enregistrées",
    board: "Toutes les missions",
    search: "Recherche",
    lists: "Listes",
    invoices: "Factures",
    billing: "Facturation",
    billingAndPayout: "Facturation et versement",
    feed: "Fil",
    companies: "Entreprises",
    invitations: "Invitations",
    following: "Abonnements",
    alerts: "Alertes",
    settings: "Réglages",
  },
};

export type WorkspaceNavDictionary = typeof workspaceNavFr;
