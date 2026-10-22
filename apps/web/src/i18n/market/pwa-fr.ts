/** Application installable et notifications poussées (C20) : manifeste, page hors ligne, réglage par appareil. */
export const pwaFr = {
  manifest: {
    description: "Missions, messages et candidatures Proofseen, sur votre téléphone.",
    shortcuts: { messages: "Messages", missions: "Missions", notifications: "Notifications" },
  },
  offline: {
    title: "Hors ligne",
    lead: "Proofseen n'est pas joignable\u202f: vérifiez votre connexion. Rien de ce que vous avez envoyé n'est perdu, la page se recharge dès que le réseau revient.",
    retry: "Réessayer",
  },
  push: {
    title: "Notifications sur cet appareil",
    lead: "Une alerte sur ce téléphone ou cet ordinateur quand une entreprise vous écrit, qu'une candidature avance ou qu'un contrat change. L'alerte dit ce qui s'est passé, jamais le contenu d'un message.",
    toggle: "Recevoir les notifications sur cet appareil",
    on: "Cet appareil reçoit les notifications.",
    off: "Cet appareil ne reçoit pas les notifications.",
    enable: "Activer sur cet appareil",
    disable: "Désactiver sur cet appareil",
    working: "Un instant…",
    unsupported: "Ce navigateur ne reçoit pas les notifications de Proofseen.",
    iosHint: "Sur iPhone et iPad\u202f: ajoutez d'abord Proofseen à l'écran d'accueil (Partager, puis «\u202fSur l'écran d'accueil\u202f»), ouvrez-le depuis l'icône, puis revenez ici.",
    denied: "Les notifications sont bloquées pour Proofseen dans ce navigateur. Autorisez-les dans les réglages du site, puis réessayez.",
    failed: "L'activation n'a pas abouti. Réessayez dans un instant.",
    tooMany: "Trop de demandes d'affilée. Réessayez dans une minute.",
    suspended: "Votre compte est suspendu\u202f: aucune notification n'est envoyée.",
  },
  devices: (n: number): string => (n === 0 ? "Aucun appareil ne reçoit les notifications de votre compte." : `${n} appareil${n > 1 ? "s reçoivent" : " reçoit"} les notifications de votre compte.`),
  install: "Pour installer Proofseen\u202f: menu du navigateur, puis «\u202fInstaller l'application\u202f» ou «\u202fAjouter à l'écran d'accueil\u202f».",
};

export type PwaDictionary = typeof pwaFr;
export type PushTexts = PwaDictionary["push"];
