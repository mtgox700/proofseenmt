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
