import { HOSTS, PUBLISHER } from "./legal-facts";
import type { LegalDocument } from "./legal-page";
import { processorTable } from "./legal-processors";
import { retentionTable } from "./legal-retention";

/*
 * Politique de confidentialité, en français. Chaque phrase décrit ce que le code fait au 2026-10-20 (relevé dans
 * `packages/db`, `packages/measure`, `apps/web`) ; une fonction qui change doit changer ici.
 */

const DATA_MAIL = `<a href="mailto:${PUBLISHER.dataEmail}">${PUBLISHER.dataEmail}</a>`;

export const PRIVACY_FR: LegalDocument = {
  title: "Politique de confidentialité",
  description: "Quelles données Proofseen traite, pourquoi, combien de temps, avec quels prestataires, et comment exercer vos droits.",
  lead: "Ce que Proofseen fait de vos données, écrit à partir de ce que le logiciel fait réellement.",
  sections: [
    {
      id: "responsable",
      title: "Qui est responsable",
      body: [
        `<p>Le responsable de traitement est ${PUBLISHER.name}, ${PUBLISHER.form.fr} (marque ${PUBLISHER.brand}), ${PUBLISHER.address}, ${PUBLISHER.registry.fr}, SIREN ${PUBLISHER.siren}. Le détail figure dans les <a href="/fr/mentions-legales">mentions légales</a>.</p>`,
        `<p>Pour toute question sur vos données : ${DATA_MAIL}, ou par courrier : ${PUBLISHER.dataPostal}.</p>`,
      ],
    },
    {
      id: "en-bref",
      title: "En bref",
      body: [
        "<ul>",
        "<li>Nous ne vendons aucune donnée et n'affichons aucune publicité.</li>",
        "<li>Aucun outil de mesure d'audience ni traceur publicitaire : seuls des cookies nécessaires au fonctionnement sont déposés.</li>",
        "<li>Votre profil n'est public que si vous le publiez, et vous pouvez le publier sous une référence (FR-XXXXX) plutôt que sous votre nom.</li>",
        "<li>Les coordonnées ne s'échangent pas en dehors de la plateforme : un filtre les repère dans les messages et les textes publics.</li>",
        "<li>Aucun score n'est calculé sur une personne ; les rapprochements entre missions et profils reposent sur des faits que vous voyez.</li>",
        "<li>Vous pouvez télécharger toutes vos données et effacer votre compte depuis vos réglages.</li>",
        "</ul>",
      ],
    },
    {
      id: "donnees",
      title: "Ce que nous traitons, fonction par fonction",
      body: [
        "<h3>Compte et connexion</h3>",
        "<p>La connexion passe par Clerk, par un code envoyé à votre adresse e-mail. Nous gardons dans notre base votre identifiant Clerk, votre adresse e-mail principale, votre nom affiché (prénom et nom, ou l'adresse e-mail à défaut), votre rôle (freelance ou entreprise) et la langue de vos e-mails. Aucun mot de passe n'est stocké chez nous.</p>",
        "<h3>Profil freelance</h3>",
        "<p>Titre, résumé, ville, mode de travail, taux journalier, disponibilité et date de sa dernière confirmation, compétences, langues, expériences, formations, certifications, photo, portfolio, CV, adresses web que vous déclarez et celles dont vous prouvez la possession, missions confirmées par vos clients. Le profil reste privé tant que vous ne le publiez pas. Une adresse web n'est vérifiée que par une visite de votre propre site ; LinkedIn et Malt ne sont jamais consultés automatiquement.</p>",
        "<p>Pour facturer et rassurer vos clients : identité de facturation (raison sociale, SIRET, TVA, adresse) et attestation de vigilance URSSAF. Le SIRET est contrôlé auprès de l'API publique Recherche d'entreprises de l'État ; il n'est jamais publié.</p>",
        "<h3>Entreprises</h3>",
        "<p>Nom et page de l'entreprise, membres et leur rôle, missions publiées, viviers de freelances, listes, recherches enregistrées, clés d'API créées par l'entreprise.</p>",
        "<h3>Missions et candidatures</h3>",
        "<p>Annonce de mission, candidature, réponses aux questions de l'entreprise, CV joint, statut de la candidature.</p>",
        "<h3>Messagerie et pièces jointes</h3>",
        "<p>Messages échangés, état de la conversation (en attente, acceptée, refusée), pièces jointes (JPEG, PNG, WebP ou PDF, 5 Mo au plus chacune, 3 par message). Les images sont réencodées pour effacer leurs métadonnées (dont la position GPS) ; un PDF qui contient du contenu actif est refusé. Un filtre repère les coordonnées (e-mail, téléphone, lien, pseudonyme de messagerie) : il bloque le message, ou le signale quand un paiement est engagé entre les deux parties ; nous ne gardons qu'un indicateur, jamais la coordonnée extraite. Une première prise de contact récente peut être relue par un opérateur.</p>",
        "<h3>Communauté</h3>",
        "<p>Publications, commentaires, réactions et partages, sous un profil publié ou une entreprise ; un profil publié sous référence n'affiche jamais le nom du compte. Une publication est publique ou réservée aux membres connectés, à votre choix.</p>",
        "<h3>Invitations</h3>",
        "<p>Quand vous invitez quelqu'un, nous gardons l'adresse invitée, votre mot personnel (passé au filtre de coordonnées) et l'état de l'invitation. Le lien n'est gardé que sous forme d'empreinte. Pour accepter, la personne doit être connectée avec une adresse vérifiée qui est l'adresse invitée.</p>",
        "<h3>Confirmation d'une mission par un client</h3>",
        "<p>Pour qu'une mission passée apparaisse comme confirmée, vous nous donnez l'adresse e-mail de votre client ; nous lui écrivons une fois, il confirme ou non.</p>",
        "<h3>Audience, sans traceur</h3>",
        "<p>Pour vous dire combien de fois votre profil a été vu ou est apparu dans une recherche, nous comptons les visites sans cookie. L'adresse IP et le navigateur servent à calculer une empreinte du jour (HMAC avec une clé qui change chaque jour) ; ni l'adresse IP ni le navigateur ne sont enregistrés, et l'empreinte est effacée à la fin de la journée. Les robots, les préchargements et vos propres visites ne sont pas comptés. Seuls des totaux par jour restent ; vous seul voyez ceux de votre profil, et une entreprise ne voit que le total des recherches de son équipe.</p>",
        "<h3>Notifications, e-mails et notifications push</h3>",
        "<p>Les e-mails sont envoyés par Resend ; le résumé quotidien est facultatif et ne contient jamais le texte d'un message. Si vous activez les notifications push, nous gardons l'adresse d'abonnement de votre appareil et un libellé court du type « Chrome · Android » (jamais votre navigateur complet). Une notification ne contient qu'une phrase et un lien.</p>",
        "<h3>Mesure de visibilité dans les IA</h3>",
        "<p>Si vous la demandez, nous posons à des moteurs d'IA (OpenAI, Anthropic, Perplexity) des questions de recruteur construites à partir de votre titre, de vos compétences, de votre ville et de votre mode de travail. Votre nom, vos adresses web et votre e-mail n'y figurent jamais : un contrôle retire tout élément qui vous identifierait, et la mesure est refusée s'il ne reste rien. Les réponses sont analysées en mémoire ; seuls les résultats (êtes-vous cité, où) sont enregistrés. Voir aussi <a href=\"#personnes-citees\">les personnes citées par les IA</a>.</p>",
        "<h3>Import d'un CV et recherche en langage courant</h3>",
        "<p>Si vous importez un CV en PDF pour préremplir votre profil, son texte (24 000 caractères au plus, coordonnées comprises) est envoyé à Anthropic pour en tirer un brouillon ; vous acceptez chaque élément un par un et rien n'est publié automatiquement. Si une entreprise décrit sa recherche par une phrase, seule cette phrase est envoyée à Anthropic pour proposer des filtres, qu'elle peut modifier ; le modèle ne voit aucun profil.</p>",
        "<h3>Modération et sécurité</h3>",
        "<p>Décisions des opérateurs (masquer un profil ou une publication, suspendre un compte) avec leur motif, contestations, retours de la bêta, limitation de débit par empreinte de l'adresse IP ou du compte. Les journaux du serveur notent un événement et sa date, jamais le texte d'un message ni une adresse e-mail.</p>",
        "<h3>Paiements</h3>",
        "<p>Le paiement sur la plateforme n'est pas encore ouvert. Quand il le sera, il passera par Stripe, qui recevra les données nécessaires au paiement et au versement ; cette politique sera mise à jour avant.</p>",
      ],
    },
    {
      id: "conservation",
      title: "Bases légales et durées de conservation",
      body: [
        "<p>Les durées ci-dessous sont appliquées automatiquement par l'application, qui purge les données échues plusieurs fois par heure.</p>",
        retentionTable("fr"),
        "<p>Les sauvegardes de la base sont faites chaque nuit sur le serveur de l'hébergeur IONOS et supprimées après 14 jours. Après l'effacement d'un compte, ses données peuvent donc rester au plus 14 jours dans ces copies, qui ne sont jamais restaurées sauf pour réparer un incident.</p>",
      ],
    },
    {
      id: "destinataires",
      title: "Qui reçoit vos données",
      body: [
        "<p>Vos données sont accessibles à notre équipe dans la limite de ce qui est nécessaire, et aux prestataires ci-dessous, chacun pour son rôle. Ce que vous publiez est visible de tous ; votre identité de facturation n'est montrée à une entreprise qu'à la signature d'un contrat avec elle.</p>",
        processorTable("fr"),
        `<p>Hébergeurs : ${HOSTS.map((h) => h.name).join(" et ")} (voir les <a href="/fr/mentions-legales#hebergeurs">mentions légales</a>).</p>`,
        `<p>Plusieurs de ces prestataires sont établis aux États-Unis. Ces transferts reposent sur les garanties prévues par leurs accords de traitement des données (clauses contractuelles types de la Commission européenne ou cadre de protection des données UE–États-Unis, selon le prestataire). Vous pouvez en demander le détail à ${DATA_MAIL}.</p>`,
      ],
    },
    {
      id: "personnes-citees",
      title: "Personnes citées par les IA",
      body: [
        "<p>Les réponses des moteurs d'IA interrogés pour une mesure peuvent citer d'autres professionnels. Si c'est votre cas, voici ce que nous faisons de votre nom.</p>",
        "<ul>",
        "<li>Nous ne cherchons jamais votre nom et ne constituons aucun profil sur vous.</li>",
        "<li>Pour repérer qui est cité, la réponse est transmise à Anthropic, puis analysée en mémoire. Dans l'application, les réponses ne sont jamais enregistrées : seuls des résultats sans nom en sortent.</li>",
        "<li>Pour les mesures que notre équipe réalise avec son outil interne, les noms sont remplacés par des jetons avant toute écriture, la réponse est chiffrée, elle porte une échéance de 72 heures et l'outil l'efface dès qu'il est relancé après cette échéance.</li>",
        "<li>Nous ne montrons jamais à nos utilisateurs qui apparaît à leur place, et nous ne réutilisons pas ce que les IA disent de vous.</li>",
        "</ul>",
        "<p>Base légale : notre intérêt légitime à mesurer, pour un utilisateur, s'il est cité. Comme nous ne connaissons pas vos coordonnées, nous vous informons par cette page plutôt qu'individuellement (article 14, paragraphe 5, du RGPD). Vous pouvez vous opposer, demander l'accès ou l'effacement à " +
          DATA_MAIL +
          " ; au-delà de l'analyse, nous ne détenons en général plus rien qui permette de vous identifier, et nous vous le disons.</p>",
      ],
    },
    {
      id: "ia-act",
      title: "Pas de notation des personnes",
      body: [
        "<p>Proofseen ne calcule, ne stocke ni n'affiche aucun score, rang ou note globale d'une personne, et les avis ne sont pas agrégés en moyenne. La recherche filtre sur des faits (compétences, ville, mode de travail, disponibilité, taux) et trie selon un critère que vous choisissez.</p>",
        "<p>Les suggestions entre missions et profils comparent des faits un par un (compétences communes, ville, mode de travail, taux, disponibilité, langues, adresse prouvée, missions confirmées, entreprise active au répertoire, attestation URSSAF valide). Elles sont classées par nombre de critères remplis parmi ceux que vous comptez, puis par compétences communes et par date ; chaque suggestion montre ce qui correspond et ce qui manque. Aucune IA n'intervient dans ce rapprochement, et aucune décision n'est prise à votre place.</p>",
      ],
    },
    {
      id: "cookies",
      title: "Cookies et stockage",
      body: [
        "<p>Seuls des cookies nécessaires au service sont déposés ; ils n'exigent pas votre accord.</p>",
        "<ul>",
        "<li><strong>Clerk</strong> : cookies de session de la connexion, déposés par notre prestataire quand vous vous connectez.</li>",
        "<li><strong>ps_org</strong> : l'entreprise pour laquelle vous agissez, si vous êtes membre de plusieurs ; 1 an.</li>",
        "<li><strong>ps_access</strong> : l'accès à un espace client ouvert par un lien, limité à cet espace ; 30 jours.</li>",
        "</ul>",
        "<p>La langue vient de l'adresse de la page (/fr ou /en), pas d'un cookie. Aucun outil d'analyse d'audience, aucune publicité, aucune police ni image chargée chez un tiers. Dans l'espace connecté, l'application installe un service worker qui garde en cache la page hors ligne et les fichiers techniques du site, jamais vos données.</p>",
      ],
    },
    {
      id: "droits",
      title: "Vos droits et comment les exercer",
      body: [
        "<p>Vous pouvez accéder à vos données, les faire rectifier ou effacer, en demander la limitation ou la portabilité, vous opposer à un traitement fondé sur notre intérêt légitime, et retirer votre consentement quand il en est la base.</p>",
        "<ul>",
        "<li><strong>Télécharger vos données</strong> : dans l'application, Réglages, « Exporter mes données » remet un fichier JSON de tout ce que la base tient sur vous (le contenu des fichiers n'y est pas, seulement leur description), avec la liste de ce qui resterait après un effacement.</li>",
        "<li><strong>Effacer votre compte</strong> : dans Réglages, « Supprimer mon compte », avec une confirmation. L'effacement supprime votre compte chez Clerk et vos données chez nous. Il est refusé tant qu'un contrat est en cours ou qu'un paiement est engagé. Restent, détachés de vous : devis, contrats et factures (obligation comptable), messages écrits au nom d'une entreprise, commentaires vidés et affichés « Compte supprimé », journal de modération (5 ans) et, pour un compte suspendu, une trace de 3 ans. Les sauvegardes s'effacent d'elles-mêmes après 14 jours.</li>",
        `<li><strong>Corriger</strong> : la plupart des informations se modifient depuis votre profil ou vos réglages. Pour le reste, ou si votre compte est suspendu, écrivez à ${DATA_MAIL}.</li>`,
        "</ul>",
        "<p>Nous pouvons vous demander de prouver votre identité en cas de doute raisonnable. Nous répondons dans un délai d'un mois.</p>",
      ],
    },
    {
      id: "securite",
      title: "Sécurité",
      body: [
        "<p>Connexions chiffrées, fichiers stockés sur le serveur sous un nom aléatoire et servis selon les droits de chacun (une pièce jointe, aux seules parties de la conversation), empreintes à la place des liens d'invitation et des adresses IP, limitation de débit, journal de modération qui ne peut être ni modifié ni effacé avant 5 ans, aucune donnée utilisée pour entraîner un modèle d'IA par nous.</p>",
      ],
    },
    {
      id: "reclamation",
      title: "Réclamation",
      body: [`<p>Si vous estimez que vos droits ne sont pas respectés, écrivez-nous d'abord à ${DATA_MAIL}. Vous pouvez aussi saisir la CNIL : <a href="https://www.cnil.fr">www.cnil.fr</a>.</p>`],
    },
    {
      id: "modifications",
      title: "Modifications",
      body: ["<p>Cette politique suit le logiciel : quand une fonction change, elle change. La date de version figure en haut de la page ; un changement important vous est signalé dans l'application ou par e-mail.</p>"],
    },
  ],
};
