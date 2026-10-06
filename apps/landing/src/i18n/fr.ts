import type { Dictionary } from "./types";

/** Copy sourced from foundations/MARQUE.md §4-§8 and presale/OFFRE_PREVENTE.md. No figure without a source, no promise of result. */
export const fr: Dictionary = {
  meta: {
    title: "Proofseen — Quand un recruteur cherche avec l'IA, êtes-vous trouvé ?",
    description:
      "Proofseen mesure si un freelance tech apparaît quand un recruteur cherche des profils avec ChatGPT, Claude ou Perplexity, explique pourquoi, aide à corriger honnêtement et re-mesure.",
  },
  nav: { method: "Méthode", offers: "Offres", companies: "Entreprises", charter: "Charte", otherLang: "English", skip: "Aller au contenu" },
  hero: {
    eyebrow: "Êtes-vous retenu ?",
    title: "Quand un recruteur cherche avec l'IA, êtes-vous trouvé ?",
    lead: "Nous posons aux IA d'OpenAI, d'Anthropic et de Perplexity les questions de vos recruteurs, des dizaines de fois. Vous voyez où vous apparaissez, pourquoi, et quoi corriger.",
    cta: "Découvrir la méthode",
    secondary: "Voir les offres",
    note: "Aucune triche. Aucun résultat garanti. Mesure par API : les applications grand public peuvent différer.",
    sim: {
      label: "Une mesure, en direct",
      tag: "Simulation · données fictives",
      engine: "Moteur A · recherche web",
      recruiter: "Recruteur",
      prompt: "Je cherche un·e dev fullstack TypeScript freelance, dispo en octobre, Paris ou remote. Donne-moi les 5 meilleurs profils.",
      answer: "Top 5 proposé par l'IA",
      you: "Vous",
      outside: "Vous : hors du top 5 sur cette réponse",
      run: "Réponse",
      tally: "Chaque point est une réponse. Vert : vous êtes dans le top 5.",
      estimate: "Présent dans le top 5",
      summary: "Simulation fictive : sur {n} réponses, vous apparaissez {hits} fois dans le top 5, soit {p} % (intervalle de confiance de {lo} à {hi} %).",
    },
  },
  problem: {
    kicker: "Le constat",
    title: "Le recrutement a changé de moteur de recherche.",
    steps: [
      { title: "Le recruteur demande à l'IA", text: "Il colle son offre dans un assistant et demande des profils, ou lui fait écrire la requête qu'il lancera sur Google, LinkedIn ou GitHub." },
      { title: "L'IA lit ce qui est public", text: "Elle s'appuie sur ce qu'un moteur de recherche indexe et sur les sources qu'elle peut citer : site, GitHub, profils publics, articles." },
      { title: "Vous, vous ne savez rien", text: "Aucune plateforme ne vous dit si vous êtes trouvé, ni pourquoi. Proofseen rend ce moment mesurable." },
    ],
  },
  method: {
    kicker: "La méthode",
    title: "Mesurer, expliquer, corriger, prouver.",
    steps: [
      { title: "Mesurer", text: "Des formulations de recruteur, envoyées plusieurs fois à chaque moteur, parce qu'une IA ne répond jamais deux fois de la même manière." },
      { title: "Expliquer", text: "Un parcours en cinq étapes montre où vous décrochez : indexé, récupéré, nommé, dans le top 5, cité comme source." },
      { title: "Corriger", text: "Des actions honnêtes et priorisées : un site lisible par les IA, des profils réécrits avec des faits vrais, des preuves publiées." },
      { title: "Prouver", text: "La même mesure, refaite plus tard, comparée à des offres témoins pour écarter les variations des moteurs." },
    ],
    preview: {
      caption: "Aperçu de rapport",
      legend: "Exemple illustratif — données fictives",
      stages: ["Indexé", "Récupéré", "Nommé", "Top 5", "Cité"],
      engines: ["Moteur A", "Moteur B", "Moteur C"],
      score: "Probabilité d'apparaître dans le top 5, avec sa fourchette",
    },
  },
  proof: {
    kicker: "La preuve, pas la promesse",
    title: "Une méthode qu'on peut vérifier.",
    facts: [
      { value: "3", label: "moteurs interrogés par leurs API officielles" },
      { value: "×5", label: "tirages par question dans un audit complet : on mesure une probabilité, pas un hasard" },
      { value: "95 %", label: "intervalle de confiance affiché à côté de chaque chiffre" },
      { value: "72 h", label: "durée maximale de conservation des réponses brutes, chiffrées" },
    ],
  },
  study: {
    kicker: "Mesuré sur nous-mêmes, d'abord",
    title: "780 réponses d'IA. Notre fondateur n'y apparaît pas une seule fois.",
    lead:
      "Avant de vendre quoi que ce soit, nous avons appliqué la méthode à notre propre fondateur, avec un protocole figé à l'avance : 13 offres de mission réelles, 4 formulations de recruteur, 3 moteurs, 5 tirages par question.",
    facts: [
      { value: "780", label: "réponses d'IA analysées, pour 15,79 $ de coût de mesure" },
      { value: "0 %", label: "de citations : intervalle de confiance [0 % ; 1,9 %] sur chaque moteur" },
      { value: "39 %", label: "des citations vont à Malt, 26,5 % à LinkedIn — presque jamais à un site personnel" },
      { value: "90,8 %", label: "des réponses d'Anthropic ne consultent aucune source : être vu dépend du moteur" },
      { value: "20/20", label: "d'accord entre nos mesures par API et les applications grand public" },
    ],
    sources: "Vague J0, 23 et 24 septembre 2026. Manifeste figé avant la mesure, empreinte 1bc9f85f. Réponses brutes supprimées après analyse.",
    limits:
      "Ces chiffres décrivent un profil, ces offres, ces moteurs, à cette date. Ils ne prédisent pas vos résultats. Nous les publions parce qu'un vendeur qui ne se mesure pas lui-même ne prouve rien.",
  },
  deliverable: {
    kicker: "Le livrable",
    title: "Ce que vous recevez, et rien de plus",
    lead:
      "Un rapport daté, chiffré, reproductible. Chaque action qu'il contient vient d'un chiffre de votre mesure : nous ne récitons pas de bonnes pratiques.",
    contents: [
      "L'étape exacte où votre profil décroche : pas trouvé, trouvé mais pas nommé, nommé mais pas dans les cinq premiers, ou cité sans lien vers vous.",
      "Pour chaque moteur, le compte brut et la fourchette dans laquelle se situe le taux réel — jamais un pourcentage seul.",
      "La carte des sources : les plateformes que les IA lisent réellement pour ce genre d'offre, avec leur part.",
      "Au plus huit actions classées, chacune avec sa raison, l'endroit où l'appliquer, l'effort estimé et le chiffre qui la justifie.",
      "Ce sur quoi vous ne pouvez rien : quand un moteur refuse de nommer des personnes, nous le disons au lieu de vous vendre une correction.",
      "Le modèle interrogé, la date, et l'empreinte du protocole figé avant la mesure.",
    ],
    sample: {
      caption: "Extrait du rapport de notre propre mesure. Nous ne montrons pas de rapport client : nous n'en avons pas encore.",
      blocking: "L'étape qui bloque : vos pages sont-elles connues des moteurs ?",
      action: {
        rank: "1",
        title: "Rendre vos pages lisibles sans JavaScript",
        why:
          "Les robots des IA ne lancent pas le JavaScript : sur une page construite dans le navigateur, ils ne lisent rien. Il n'y a donc aucun texte à retrouver dans la suite du parcours.",
        effort: "moyen",
        evidence: "0 page indexée sur 1 déclarée, relevé du 24 septembre 2026",
      },
      labels: { why: "Pourquoi", effort: "Effort", evidence: "Ce qui le montre" },
    },
    note:
      "Aucun rang, aucune apparition, aucun contact et aucune mission ne sont promis. Le rapport compte ce qui a été observé ; il ne prédit pas la suite.",
  },
  offers: {
    kicker: "Offres de lancement",
    title: "Commencez par savoir où vous en êtes.",
    list: [
      { name: "Audit complet", price: "49 €", unit: "paiement unique", items: ["3 offres de votre choix", "Rapport complet avec fourchettes", "Carte des sources citées", "Plan de correction priorisé"] },
      { name: "Clé en main", price: "490 €", unit: "paiement unique", items: ["Votre site, lisible par les IA", "Textes LinkedIn, GitHub et Malt : vous publiez vous-même", "Liste des preuves à obtenir", "Nouvelle mesure à 45 jours"] },
    ],
    closed: "Ouverture après validation juridique",
    legal: "Rétractation de 14 jours. Remboursement intégral si le service n'est pas lancé. Aucune garantie de résultat.",
  },
  companies: {
    kicker: "Pour les entreprises",
    title: "Recrutez des freelances dont les compétences sont prouvées.",
    text: "Des profils vérifiés, des missions documentées avec leurs sources, une disponibilité à jour. Et un seul interlocuteur pour le contrat et la facturation.",
    points: ["Possession des profils vérifiée", "Faits chiffrés avec leur source", "Disponibilité datée", "Contrat et facturation simplifiés"],
    cta: "Parlons de votre prochaine mission",
  },
  charter: {
    kicker: "Charte d'honnêteté",
    title: "Nous mesurons. Nous ne manipulons pas.",
    items: [
      { title: "Aucune manipulation des IA", text: "Pas de texte caché, pas d'instruction adressée aux IA, pas de contenu différent selon qui regarde." },
      { title: "Uniquement du vrai", text: "Nous refusons de générer une compétence, une expérience ou un chiffre que vous n'avez pas." },
      { title: "Vos comptes restent les vôtres", text: "Nous ne publions jamais à votre place et nous ne collectons rien sur LinkedIn ou Malt." },
      { title: "Les autres sont protégés", text: "Les noms des autres professionnels cités par les IA sont effacés avant tout stockage." },
    ],
  },
  order: {
    meta: {
      title: "Commander — Proofseen",
      description:
        "Pré-commande de l'audit Proofseen : périmètre, date de livraison maximale, droit de rétractation de 14 jours et conditions de remboursement intégral.",
    },
    kicker: "Commande",
    title: "Ce que vous achetez, et ce que vous pouvez défaire",
    lead:
      "Tout ce qui vous engage est sur cette page, avant le paiement. Rien n'est renvoyé à un lien que vous ouvririez après coup.",
    back: "Retour à l'accueil",
    items: [
      {
        name: "Audit complet",
        price: "49 €",
        scope: "Une mesure de votre visibilité dans les réponses des IA, et le plan pour la corriger.",
        includes: [
          "3 offres d'emploi que vous choisissez, plus 1 offre témoin choisie par nous.",
          "Pour chaque offre : 4 formulations de recruteur × 3 moteurs × 5 tirages.",
          "Un rapport daté : l'étape où votre profil décroche, avec son compte brut et sa fourchette, pour chaque moteur.",
          "La carte des sources que les IA citent réellement pour ce type d'offre.",
          "Au plus 8 actions classées, chacune avec sa raison, l'endroit où l'appliquer, l'effort et le chiffre qui la justifie.",
        ],
        excludes: [
          "Aucune publication n'est faite à votre place.",
          "Aucun nom de personne citée à votre place ne vous est communiqué.",
          "Gemini et Copilot ne sont pas couverts.",
        ],
        cta: "Pré-commander l'audit — 49 €",
      },
      {
        name: "Clé en main",
        price: "490 €",
        scope: "L'audit, puis les pages et les textes pour corriger, et une nouvelle mesure pour voir ce qui a bougé.",
        includes: [
          "Tout l'audit complet, en mesure de départ.",
          "Vos pages de profil, lisibles par les moteurs et les IA, rédigées à partir de vos vraies missions.",
          "Les textes de réécriture de vos profils LinkedIn, Malt et GitHub, dans un fichier.",
          "La liste des preuves tierces à obtenir, adaptée à votre profil.",
          "Une nouvelle mesure 45 jours après la livraison, avec le même protocole.",
        ],
        excludes: [
          "Vous validez chaque fait avant publication, et vous publiez vous-même sur les plateformes.",
          "Nous ne rédigeons aucune compétence, expérience ou chiffre que vous n'avez pas.",
          "Aucune automatisation n'est lancée sur LinkedIn ou Malt.",
        ],
        cta: "Pré-commander la clé en main — 490 €",
      },
    ],
    terms: {
      title: "Ce à quoi nous nous engageons",
      delivery: "Livraison au plus tard le {date}.",
      withdrawal:
        "Vous pouvez vous rétracter dans les {days} jours qui suivent votre commande, sans justification et sans frais. Nous vous remboursons intégralement sous 14 jours au plus, par le moyen de paiement utilisé.",
      refundTitle: "Remboursement intégral",
      refunds: [
        { when: "Nous décidons de ne pas lancer le service le {gate}", then: "Remboursement intégral, sous 14 jours au plus." },
        { when: "Rien ne vous est livré au {delivery}", then: "Remboursement intégral et automatique, sans démarche de votre part." },
        {
          when: "Un fournisseur d'IA ne nous autorise pas cet usage avant votre livraison",
          then: "Nous vous prévenons avant de lancer votre audit. Vous choisissez : un audit sur les moteurs restants, ou le remboursement intégral.",
        },
        {
          when: "Votre profil contient une manipulation destinée aux IA (texte caché, instructions)",
          then: "Nous refusons de mesurer, et vous êtes remboursé intégralement.",
        },
      ],
      neverTitle: "Ce que nous ne vous demanderons jamais",
      never:
        "Vos identifiants, mots de passe ou codes d'accès, pour LinkedIn, Malt, GitHub, votre hébergeur ou votre registrar. Nous ne nous connectons jamais à vos comptes et nous ne publions jamais à votre place.",
      noPromiseTitle: "Ce que nous ne promettons pas",
      noPromise: [
        "Aucun rang, aucune apparition, aucun contact et aucune mission ne sont promis.",
        "Nous ne vous montrons jamais qui apparaît à votre place.",
        "Nous observons les réponses des IA et nous les comptons. Nous ne connaissons pas leur fonctionnement interne et nous ne prétendons pas le connaître.",
      ],
      accept:
        "En commandant, vous acceptez les conditions de pré-vente, dont la date de livraison maximale et les conditions de remboursement ci-dessus.",
    },
    closed: "Commande fermée",
    closedWhy:
      "Aucun paiement n'est encaissé tant que les conditions de vente n'ont pas été validées par un juriste. Cette page décrit ce qui sera proposé à l'ouverture.",
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      { q: "Pouvez-vous me garantir la première place ?", a: "Non, et personne d'honnête ne le peut. Nous mesurons une probabilité avec sa fourchette, nous vous aidons à corriger, puis nous mesurons à nouveau." },
      { q: "Pourquoi poser la même question plusieurs fois ?", a: "Parce qu'une IA ne donne jamais deux fois exactement la même réponse. Une seule réponse ne veut rien dire ; une série de réponses dessine une tendance." },
      { q: "Mesurez-vous toutes les IA ?", a: "Nous mesurons par API les moteurs dont les conditions d'utilisation autorisent l'analyse des réponses. Les autres ne servent qu'à un étalonnage interne." },
      { q: "Que devient ma vie privée ?", a: "Vous prouvez que les profils mesurés sont bien les vôtres. Les réponses brutes sont chiffrées puis supprimées au bout de 72 heures." },
    ],
  },
  footer: { line: "Proofseen — la mesure de votre visibilité dans le recrutement assisté par IA.", legal: "Mentions légales et CGV publiées à l'ouverture." },
};
