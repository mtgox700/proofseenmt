import { HOSTS, PUBLISHER } from "./legal-facts";
import type { LegalDocument } from "./legal-page";

/*
 * Conditions d'utilisation, en français : la marketplace telle que le code la fait fonctionner au 2026-10-20 (règles et
 * limites relevées dans `packages/db`). Le paiement sur la plateforme n'est pas ouvert : rien ici ne le décrit comme
 * actif, et aucun taux de commission n'est annoncé.
 */

const CONTACT = `<a href="mailto:${PUBLISHER.contactEmail}">${PUBLISHER.contactEmail}</a>`;

export const TERMS_FR: LegalDocument = {
  title: "Conditions d'utilisation",
  description: "Les règles de la marketplace Proofseen : comptes, profils, missions, messagerie, communauté, invitations, avis, modération et responsabilités.",
  lead: "Les règles de Proofseen, telles que la plateforme les applique aujourd'hui.",
  sections: [
    {
      id: "objet",
      title: "Objet et acceptation",
      body: [
        `<p>Proofseen met en relation des freelances et des entreprises : profils vérifiables, missions, candidatures, messagerie, communauté. Le service est édité par ${PUBLISHER.name} (SIREN ${PUBLISHER.siren}) et hébergé par ${HOSTS.map((h) => h.name).join(" et ")} ; voir les <a href="/fr/mentions-legales">mentions légales</a>.</p>`,
        "<p>En créant un compte, vous acceptez ces conditions. Les offres vendues sur la page Commander ont leurs propres conditions de vente, affichées sur cette page.</p>",
      ],
    },
    {
      id: "compte",
      title: "Compte et rôles",
      body: [
        "<ul>",
        "<li>La connexion se fait par un code envoyé à votre adresse e-mail. Vous gardez l'accès à cette adresse et ne partagez pas votre compte.</li>",
        "<li>À la première connexion, vous choisissez un rôle : freelance ou entreprise. Ce choix ne se modifie pas seul ; en cas d'erreur, écrivez-nous.</li>",
        "<li>Dans une entreprise, chaque membre est propriétaire, administrateur ou membre. Seuls les propriétaires et administrateurs acceptent un devis, créent et signent un contrat, invitent par e-mail et gèrent la facturation, les clés d'API et la page publique. Tout membre peut publier et fermer une mission.</li>",
        "<li>Des opérateurs de Proofseen, désignés par l'éditeur, modèrent la plateforme (voir <a href=\"#moderation\">Modération</a>).</li>",
        "</ul>",
      ],
    },
    {
      id: "faits",
      title: "Exactitude et faits vérifiés",
      body: [
        "<p>Tout ce que vous publiez doit être exact : identité, compétences, expériences, missions, diplômes, taux, disponibilité. N'inventez ni client, ni chiffre, ni témoignage.</p>",
        "<p>Sur Proofseen, « vérifié » a un sens précis, et seulement celui-ci :</p>",
        "<ul>",
        "<li><strong>Adresse web prouvée</strong> : vous avez placé un code sur votre site (fichier, balise ou enregistrement DNS) ou dans un champ public de votre profil ; la preuve est revérifiée tous les 30 jours. Une adresse seulement déclarée ne compte pas.</li>",
        "<li><strong>Mission confirmée</strong> : votre client l'a confirmée, depuis son entreprise inscrite ou par un lien à usage unique reçu par e-mail. Personne ne confirme sa propre mission.</li>",
        "<li><strong>Entreprise active</strong> : le SIRET a été contrôlé au répertoire officiel des entreprises, tous les 30 jours ; il doit être actif et correspondre à la raison sociale déclarée.</li>",
        "<li><strong>Attestation URSSAF</strong> : une attestation de vigilance contrôlée à la main par un opérateur sur le site de l'URSSAF ; elle vaut 6 mois.</li>",
        "<li><strong>Disponibilité</strong> : elle est datée ; passé 30 jours sans confirmation, elle s'affiche « non confirmée ».</li>",
        "</ul>",
      ],
    },
    {
      id: "missions",
      title: "Missions, candidatures et prises de contact",
      body: [
        "<ul>",
        "<li>Une mission décrit un besoin réel ; elle ne se modifie plus une fois qu'elle a reçu des candidatures, et elle reste ouverte jusqu'à ce que l'entreprise la ferme.</li>",
        "<li>Un freelance candidate une fois par mission, avec un profil publié. L'entreprise fait évoluer la candidature (retenue, déclinée, choisie).</li>",
        "<li>Une entreprise peut contacter directement un profil publié (50 nouvelles prises de contact par jour et par entreprise) ; le freelance accepte ou refuse. Les pièces jointes ne sont possibles qu'après acceptation.</li>",
        "</ul>",
      ],
    },
    {
      id: "coordonnees",
      title: "Les échanges passent par la plateforme",
      body: [
        "<p>Les coordonnées (adresse e-mail, téléphone, lien, pseudonyme de messagerie) ne s'échangent pas sur Proofseen avant un paiement sous séquestre. Un filtre les repère, y compris déguisées : un texte public, une candidature ou un message qui en contient est refusé. Le paiement n'étant pas encore ouvert, c'est aujourd'hui le cas de tout message.</p>",
        "<p>Contourner ce filtre est interdit. Une première prise de contact récente peut être relue par un opérateur, qui peut la clore avec un motif.</p>",
      ],
    },
    {
      id: "communaute",
      title: "Communauté",
      body: [
        "<p>Vous publiez sous votre profil publié ou au nom d'une entreprise dont vous êtes membre, en public ou pour les seuls membres connectés. Limites : 3 000 caractères par publication, 1 500 par commentaire, 10 publications et 100 commentaires par 24 heures, liens en https. Pas de coordonnées, pas de HTML. Restez courtois et factuel : pas de contenu illicite, haineux, trompeur ou publicitaire déguisé.</p>",
      ],
    },
    {
      id: "invitations",
      title: "Invitations",
      body: [
        "<ul>",
        "<li>Une entreprise invite dans son vivier privé des freelances avec qui elle travaille déjà ; un freelance invite une entreprise cliente.</li>",
        "<li>N'invitez que des personnes que vous connaissez. Limites : 20 invitations par jour et par expéditeur, 50 par jour et par entreprise, 3 par adresse sur 14 jours.</li>",
        "<li>Une invitation vaut 14 jours ; une seule relance est possible. Pour l'accepter, il faut être connecté avec l'adresse invitée, vérifiée.</li>",
        "<li>Aucune récompense ni aucun argent n'est attaché à une invitation.</li>",
        "</ul>",
      ],
    },
    {
      id: "avis",
      title: "Avis",
      body: [
        "<p>Seul un membre de l'entreprise cliente peut laisser un avis sur le freelance, une fois par contrat, après une mission terminée et payée sur la plateforme. Un avis (note de 1 à 5 et texte) est affiché tel quel avec sa date ; il n'est ni modifiable, ni agrégé en moyenne, ni utilisé pour classer. Le paiement n'étant pas encore ouvert, aucun avis ne peut encore exister.</p>",
      ],
    },
    {
      id: "contrats",
      title: "Devis, contrats et paiement",
      body: [
        "<p>Aujourd'hui, un freelance peut envoyer un devis ; l'entreprise l'accepte ; un contrat est créé et signé par les deux parties. Pour signer, le freelance renseigne son SIRET et accepte le mandat de facturation.</p>",
        "<p><strong>Le paiement sur la plateforme n'est pas encore ouvert.</strong> Aucun paiement, aucune commission et aucun séquestre ne sont donc en place : un contrat ne peut pas encore être validé ni terminé sur Proofseen, et aucune facture n'y est émise. Proofseen ne prélève rien sur les missions aujourd'hui. Avant l'ouverture du paiement, ces conditions seront mises à jour avec ses règles et ses frais, que vous verrez avant de vous engager.</p>",
      ],
    },
    {
      id: "classement",
      title: "Pas de classement des personnes, pas de promesse",
      body: [
        "<p>Proofseen ne note ni ne classe les personnes : la recherche filtre sur des faits et trie selon le critère que vous choisissez ; les suggestions montrent ce qui correspond et ce qui manque. Il vous appartient de choisir avec qui travailler.</p>",
        "<p>Nous ne promettons aucun résultat : ni mission, ni contact, ni rang dans une IA ou un moteur de recherche. Une mesure de visibilité décrit ce que des moteurs ont répondu à un moment donné.</p>",
      ],
    },
    {
      id: "interdits",
      title: "Usages interdits",
      body: [
        "<ul>",
        "<li>publier des informations fausses ou exagérées, usurper une identité, créer de faux comptes ;</li>",
        "<li>contourner le filtre de coordonnées ou détourner des utilisateurs hors de la plateforme ;</li>",
        "<li>extraire des données de Proofseen de façon automatisée, ou revendre des données de profils ;</li>",
        "<li>cacher du texte ou des instructions destinées aux IA dans vos pages, ou montrer un contenu différent aux robots et aux visiteurs ;</li>",
        "<li>harceler, discriminer, publier un contenu illicite ou envoyer des sollicitations non désirées ;</li>",
        "<li>chercher à contourner une suspension, les limites ou la sécurité du service.</li>",
        "</ul>",
      ],
    },
    {
      id: "moderation",
      title: "Modération, suspension et contestation",
      body: [
        "<p>Un opérateur peut masquer un profil, une mission, une page d'entreprise, une publication ou un commentaire, clore une prise de contact, ou suspendre un compte ou une entreprise. Chaque décision porte un motif écrit, vous est envoyée par e-mail et est inscrite dans un journal conservé 5 ans. Masquer ne supprime rien.</p>",
        "<p>Un compte suspendu n'accède plus à son espace et son contenu public est masqué ; il peut toujours télécharger ses données. Vous pouvez contester une décision depuis la page qui l'affiche ; la contestation est relue par un opérateur.</p>",
        `<p>Pour signaler un contenu ou un comportement : ${CONTACT}.</p>`,
      ],
    },
    {
      id: "contenus",
      title: "Vos contenus",
      body: [
        "<p>Vous restez propriétaire de ce que vous publiez. Vous autorisez Proofseen à l'héberger, l'afficher et le reproduire sur la plateforme et dans ses pages publiques, le temps de sa publication, pour faire fonctionner le service. Vous garantissez disposer des droits sur ce que vous publiez.</p>",
      ],
    },
    {
      id: "responsabilite",
      title: "Responsabilité",
      body: [
        "<p>Proofseen fournit un service de mise en relation ; les contrats de mission sont conclus entre le freelance et l'entreprise, qui restent responsables de leurs engagements. Nous faisons le nécessaire pour que le service soit disponible et sûr, sans pouvoir garantir une disponibilité sans interruption. Chaque utilisateur répond de ce qu'il publie et de l'usage qu'il fait du service.</p>",
      ],
    },
    {
      id: "fin",
      title: "Fin de l'utilisation",
      body: [
        "<p>Vous pouvez effacer votre compte à tout moment depuis vos réglages, sauf tant qu'un contrat est en cours ou qu'un paiement est engagé. Nous pouvons suspendre un compte qui enfreint ces conditions, selon la procédure ci-dessus. Ce qui reste après un effacement est décrit dans la <a href=\"/fr/confidentialite#droits\">politique de confidentialité</a>.</p>",
      ],
    },
    {
      id: "modifications",
      title: "Modifications",
      body: ["<p>Ces conditions suivent la plateforme. La date de version figure en haut de la page ; un changement important vous est signalé avant de s'appliquer.</p>"],
    },
    {
      id: "droit",
      title: "Droit applicable et contact",
      body: [`<p>Ces conditions sont soumises au droit français. Pour toute question ou réclamation, écrivez d'abord à ${CONTACT} : nous cherchons une solution amiable avant toute autre démarche.</p>`],
    },
  ],
};
