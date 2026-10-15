/** Ce que la personne voit des décisions d'un opérateur sur son compte et ses contenus (C19). */
export const standingFr = {
  noticeTitle: "Décision de Proofseen",
  targets: { profile: "Votre profil public est masqué", mission: "Une mission est masquée", company: "La page publique de l'entreprise est masquée" },
  since: (d: string) => `depuis le ${d}`,
  reason: "Motif",
  vigilanceRejected: "Votre attestation de vigilance URSSAF n'a pas pu être vérifiée : déclarez-en une nouvelle.",
  appealTitle: "Contester ou demander des précisions",
  appealHint: "Votre message arrive à l'équipe Proofseen avec votre compte. Pas de coordonnées : nous vous répondons par e-mail.",
  appealLabel: "Votre message",
  appealSend: "Envoyer",
  appealSent: "Message envoyé. L'équipe Proofseen vous répondra par e-mail.",
  appealError: "Message trop court ou trop long (5 à 2 000 caractères).",
  appealTooMany: "Trop de messages en peu de temps : réessayez plus tard.",
  suspendedTitle: "Votre compte est suspendu",
  exportData: "Télécharger mes données (RGPD)",
  suspendedLead: "Un opérateur de Proofseen a suspendu votre compte : votre espace n'est plus accessible et vos contenus publics sont masqués.",
};

export type StandingDictionary = typeof standingFr;
