/*
 * Lot 3 de l'espace connecté : la frappe vraie et ce qui attend une entreprise. L'accusé d'une décision reprend mot pour
 * mot le cartouche et la trace que la mission porte sur le profil public (PROOF_LABELS de packages/hub, tenu par
 * apps/web/test/confirm-desk.test.ts) : l'entreprise voit exactement la marque qu'elle vient de frapper.
 */
export const confirmDeskFr = {
  ack: {
    label: "Décision enregistrée",
    confirmedTitle: (role: string) => `Mission «\u202f${role}\u202f» confirmée`,
    refusedTitle: (role: string) => `Mission «\u202f${role}\u202f» refusée`,
    seal: {
      company: (d: string) => `Confirmée par le client le ${d}`,
      contact: (d: string) => `Confirmée par un contact chez le client le ${d}`,
    },
    source: "Source",
    by: "Vérifié par",
    sourceValue: "Confirmation du client",
    byValue: { company: "Le client, depuis son compte", contact: "Un contact chez le client, par lien signé" },
    sealLead: "La mission porte désormais cette marque sur le profil du freelance, avec cette date\u202f:",
    published: (ref: string) => `Elle s'affiche sur la page publique de ${ref} tant que ce profil est publié.`,
    refusedOn: (d: string) => `Refusée le ${d}\u202f: rien n'est publié.`,
    contactDone: "Vous n'avez rien d'autre à faire.",
  },
  pending: {
    title: "En attente de votre réponse",
    state: "En attente",
    count: (n: number): string => (n <= 1 ? `${n} demande` : `${n} demandes`),
    none: "Aucune demande en attente.",
    noneElse: "Aucune autre demande en attente.",
  },
  todo: {
    title: "À traiter",
    lead: (organisation: string) => `Pour ${organisation}, compté à l'ouverture de cette page.`,
    confirmations: (n: number): string => (n <= 1 ? "confirmation de mission en attente" : "confirmations de mission en attente"),
    soonest: (d: string) => `La première expire le ${d}`,
    toSign: (n: number): string => (n <= 1 ? "contrat qui attend votre signature" : "contrats qui attendent votre signature"),
    toPay: (n: number): string => (n <= 1 ? "contrat à payer sous séquestre" : "contrats à payer sous séquestre"),
    unread: (n: number): string => (n <= 1 ? "candidature que personne n'a encore ouverte" : "candidatures que personne n'a encore ouvertes"),
    adminsOnly: (organisation: string) => `Chez ${organisation}, confirmer une mission, signer et payer un contrat reviennent aux administrateurs.`,
  },
};

export type ConfirmDeskDictionary = typeof confirmDeskFr;
