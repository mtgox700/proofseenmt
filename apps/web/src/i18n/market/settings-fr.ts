/*
 * Réglages du compte (C17) : langue des e-mails, notifications, compte de connexion, entreprise, export et effacement.
 */

export const settingsFr = {
  nav: "Réglages",
  title: "Réglages du compte",
  lead: "Votre langue, vos e-mails, votre connexion et vos données.",
  saved: { language: "Langue des e-mails enregistrée.", organisation: "Entreprise changée : l'espace agit désormais pour elle." },
  errors: {
    invalid: "Ce choix n'est pas possible.",
    throttled: "Trop de changements en peu de temps : réessayez dans quelques minutes.",
  },
  language: {
    title: "Langue des e-mails",
    lead: "Proofseen vous écrit dans cette langue. La langue des pages se change en haut de l'écran.",
    label: "Langue",
    options: { fr: "Français", en: "English" },
    save: "Enregistrer",
  },
  notifications: {
    title: "E-mails et alertes",
    lead: "Choisissez les e-mails que vous recevez et les alertes de missions.",
    link: "Régler les e-mails et les alertes",
  },
  account: {
    title: "Connexion",
    lead: "Adresse e-mail, mot de passe et sessions ouvertes, gérés par notre service de connexion.",
  },
  organisation: {
    title: "Entreprise",
    lead: "Vous êtes membre de plusieurs entreprises : choisissez celle pour laquelle vous agissez. Le choix est gardé sur cet appareil.",
    label: "Vous agissez pour",
    save: "Changer d'entreprise",
  },
  data: {
    title: "Vos données",
    lead: "Un fichier JSON avec tout ce que la base contient sur vous : profil, candidatures, messages, contrats, listes, préférences.",
    export: "Exporter mes données",
  },
  erase: {
    title: "Supprimer mon compte",
    lead: "Votre profil, vos messages, vos candidatures et votre compte de connexion sont effacés. Les contrats, paiements et factures restent, détachés de vous, le temps que la loi l'impose.",
    blocked: "La suppression est refusée tant qu'un contrat est en cours ou que de l'argent est bloqué : l'autre partie resterait sans recours.",
    confirmLabel: (word: string) => `Pour confirmer, tapez ${word}`,
    submit: "Supprimer définitivement mon compte",
    pending: "Suppression en cours…",
    mismatch: (word: string) => `Tapez exactement ${word} pour confirmer.`,
    outcomes: {
      busy: "Suppression refusée : un contrat est en cours, ou de l'argent est encore bloqué. Terminez-le (ou attendez le versement), puis recommencez.",
      throttled: "Trop de tentatives : réessayez dans une heure.",
      signed_out: "Votre session a expiré : reconnectez-vous, puis recommencez.",
      failed: "La suppression n'a pas abouti. Réessayez ; si cela se répète, écrivez-nous.",
    },
    done: "Votre compte est supprimé.",
  },
};

export type SettingsDictionary = typeof settingsFr;
