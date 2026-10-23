/**
 * Preuves : le registre du freelance (ce qui est vérifié, ce qui attend un client), puis ses adresses et la preuve
 * qu'elles sont bien les siennes.
 */
export const proofsFr = {
  nav: "Preuves",
  title: "Preuves",
  lead: "Ce que votre page publique montre comme vérifié, ce qui attend la réponse d'un client, puis vos adresses. Rien ne devient vérifié sur votre seule déclaration\u202f: un client confirme une mission, un paiement passe par Proofseen, vous prouvez qu'une adresse est à vous.",
  /** Le résumé du rail de la page publique, en tête de l'accueil et de cette page : les mêmes comptes. */
  standing: {
    title: "Ce qui est poinçonné sur votre page publique",
    detail: "Le détail, ligne par ligne, avec la date et la source de chaque fait",
    publicPage: "Voir ma page publique",
    unpublished: "Votre profil n'est pas publié\u202f: aucune page publique ne montre encore vos faits.",
    hidden: "Votre page publique n'est pas servie en ce moment\u202f: rien n'y paraît.",
    publish: "Publier mon profil",
  },
  register: {
    title: "Ce qui est vérifié",
    notePublished: "Ces lignes paraissent sur votre page publique, chacune avec sa date, sa source et qui l'a vérifiée.",
    notePrivate: "Votre profil n'est pas publié\u202f: ces lignes paraîtront sur votre page publique dès que vous le publierez.",
    pseudonymous: "Publiée sous votre référence, votre page compte vos adresses prouvées sans les montrer.",
    empty: "Rien n'est encore vérifié. Une mission le devient quand votre client la confirme ou quand elle est payée sur Proofseen, une adresse quand vous prouvez qu'elle est à vous.",
    missions: "Missions vérifiées",
    addresses: "Adresses prouvées",
    facts: "Autres faits vérifiés",
  },
  trial: {
    title: "À l'essai",
    lead: "Vos demandes de confirmation, la plus proche de son échéance d'abord. Tant que le client n'a pas répondu, rien n'est publié.",
    closed: "Demandes closes",
    confirmedHere: (d: string) => `Confirmée le ${d}\u202f: la mission est en tête de cette page`,
    confirmedUndated: "Confirmée\u202f: la mission est en tête de cette page",
  },
  /** L'accueil : ce qui attend la réponse d'un client. */
  waiting: {
    title: "En attente d'un client",
    more: (n: number) => (n === 1 ? "Et 1 autre demande en attente." : `Et ${n} autres demandes en attente.`),
    link: "Voir vos demandes",
  },
  listTitle: "Vos adresses",
  listLead: "Une citation par un moteur d'IA ne compte que si elle mène à une adresse dont vous avez prouvé la possession. Déclarez vos sites, puis posez l'une des trois preuves\u202f: nous la relisons, puis tous les trente jours.",
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
    "LinkedIn et Malt\u202f: Proofseen n'y envoie aucune requête automatisée. Le lien est gardé comme lien déclaré\u202f; il n'est pas compté comme adresse prouvée.",
  ways: {
    summary: "Prouver cette adresse\u202f: une des trois méthodes suffit",
    copyHint: "Un clic sélectionne toute la valeur, prête à copier.",
    wellKnownTitle: "Fichier à la racine du site",
    wellKnownScope: "prouve tout le domaine",
    wellKnown: (url: string) => `Publiez un fichier texte à l'adresse ${url}, qui contient exactement cette ligne\u202f:`,
    metaTitle: "Balise meta dans la page",
    metaScope: "prouve cette page seulement",
    meta: (page: string) => `Ajoutez cette balise dans le <head> de ${page}\u202f:`,
    dnsTitle: "Enregistrement DNS TXT",
    dnsScope: "prouve tout le domaine",
    dns: (host: string) => `Ajoutez un enregistrement TXT sur ${host} (nom «\u202f@\u202f») dont la valeur est\u202f:`,
    dnsDelay: "Un changement DNS peut mettre quelques heures à se propager.",
  },
  verify: "Vérifier maintenant",
  remove: "Retirer",
  removeLabel: (url: string) => `Retirer ${url}`,
  verifyLabel: (url: string) => `Vérifier ${url} maintenant`,
  addTitle: "Ajouter une adresse",
  addLabel: "Adresse de la page ou du site",
  addHint: (max: number) =>
    `En https, sur un nom de domaine public\u202f: votre site, votre dépôt, une page de profil. LinkedIn et Malt sont acceptés comme liens déclarés. ${max} adresses au plus.`,
  add: "Ajouter",
  unavailable: "La vérification des preuves n'est pas configurée sur ce serveur\u202f: vos adresses sont gardées, les consignes s'afficheront dès qu'elle le sera.",
  saved: "C'est enregistré.",
  proven: "Preuve trouvée\u202f: l'adresse est maintenant prouvée.",
  errors: {
    tooMany: "Trop de demandes en peu de temps\u202f: réessayez dans quelques minutes.",
    invalid: "Adresse refusée\u202f: il faut une adresse en https, sur un nom de domaine public, sans port ni identifiants.",
    duplicate: "Cette adresse est déjà dans votre liste.",
    limit: (max: number) => `Vous avez atteint ${max} adresses\u202f: retirez-en une pour en ajouter une autre.`,
    noProfile: "Créez d'abord votre profil\u202f: les adresses prouvées y sont rattachées.",
    notFound: "Cette adresse n'est pas dans votre liste.",
    absent:
      "Aucune preuve trouvée pour l'instant. Vérifiez que la valeur est recopiée à l'identique, que la page est publique en https, ou laissez le temps au DNS de se propager.",
    elsewhere: "Cette adresse est déjà prouvée par un autre profil. Si elle est à vous, écrivez-nous\u202f: nous vérifierons à la main.",
    manual: "Cette plateforme ne se vérifie pas automatiquement\u202f: aucune requête n'y est envoyée.",
    unavailable: "La vérification n'est pas disponible sur ce serveur pour le moment.",
  },
  profileLink: "Créer mon profil",
};

export type ProofsDictionary = typeof proofsFr;
