/** Adresses prouvées : les URL du freelance, et la preuve qu'elles sont bien les siennes. */
export const proofsFr = {
  nav: "Adresses prouvées",
  title: "Adresses prouvées",
  lead: "Une citation par un moteur d'IA ne compte que si elle mène à une adresse dont vous avez prouvé la possession. Déclarez vos sites, puis posez l'une des trois preuves : nous la relisons, puis tous les trente jours.",
  listTitle: "Vos adresses",
  empty: "Aucune adresse déclarée pour l'instant.",
  status: {
    proven: (date: string, method: string) => `Prouvée le ${date} · ${method}`,
    waiting: "En attente de preuve",
    manual: "Non vérifiable automatiquement",
  },
  methods: {
    well_known_file: "fichier de vérification",
    meta_tag: "balise meta",
    dns_txt: "enregistrement DNS TXT",
    profile_token: "vérification manuelle",
  },
  failing: (since: string, until: string) =>
    `La preuve ne se relit plus depuis le ${since}. Rétablissez-la avant le ${until}, sinon l'adresse repassera en attente.`,
  manualNote:
    "LinkedIn et Malt : Proofseen n'y envoie aucune requête automatisée. Le lien est gardé comme lien déclaré ; il n'est pas compté comme adresse prouvée.",
  ways: {
    summary: "Prouver cette adresse : une des trois méthodes suffit",
    copyHint: "Un clic sélectionne toute la valeur, prête à copier.",
    wellKnownTitle: "Fichier à la racine du site",
    wellKnownScope: "prouve tout le domaine",
    wellKnown: (url: string) => `Publiez un fichier texte à l'adresse ${url}, qui contient exactement cette ligne :`,
    metaTitle: "Balise meta dans la page",
    metaScope: "prouve cette page seulement",
    meta: (page: string) => `Ajoutez cette balise dans le <head> de ${page} :`,
    dnsTitle: "Enregistrement DNS TXT",
    dnsScope: "prouve tout le domaine",
    dns: (host: string) => `Ajoutez un enregistrement TXT sur ${host} (nom « @ ») dont la valeur est :`,
    dnsDelay: "Un changement DNS peut mettre quelques heures à se propager.",
  },
  verify: "Vérifier maintenant",
  remove: "Retirer",
  removeLabel: (url: string) => `Retirer ${url}`,
  verifyLabel: (url: string) => `Vérifier ${url} maintenant`,
  addTitle: "Ajouter une adresse",
  addLabel: "Adresse de la page ou du site",
  addHint: (max: number) =>
    `En https, sur un nom de domaine public : votre site, votre dépôt, une page de profil. LinkedIn et Malt sont acceptés comme liens déclarés. ${max} adresses au plus.`,
  add: "Ajouter",
  unavailable: "La vérification des preuves n'est pas configurée sur ce serveur : vos adresses sont gardées, les consignes s'afficheront dès qu'elle le sera.",
  saved: "C'est enregistré.",
  proven: "Preuve trouvée : l'adresse est maintenant prouvée.",
  errors: {
    tooMany: "Trop de demandes en peu de temps : réessayez dans quelques minutes.",
    invalid: "Adresse refusée : il faut une adresse en https, sur un nom de domaine public, sans port ni identifiants.",
    duplicate: "Cette adresse est déjà dans votre liste.",
    limit: (max: number) => `Vous avez atteint ${max} adresses : retirez-en une pour en ajouter une autre.`,
    noProfile: "Créez d'abord votre profil : les adresses prouvées y sont rattachées.",
    notFound: "Cette adresse n'est pas dans votre liste.",
    absent:
      "Aucune preuve trouvée pour l'instant. Vérifiez que la valeur est recopiée à l'identique, que la page est publique en https, ou laissez le temps au DNS de se propager.",
    elsewhere: "Cette adresse est déjà prouvée par un autre profil. Si elle est à vous, écrivez-nous : nous vérifierons à la main.",
    manual: "Cette plateforme ne se vérifie pas automatiquement : aucune requête n'y est envoyée.",
    unavailable: "La vérification n'est pas disponible sur ce serveur pour le moment.",
  },
  profileLink: "Créer mon profil",
};

export type ProofsDictionary = typeof proofsFr;
