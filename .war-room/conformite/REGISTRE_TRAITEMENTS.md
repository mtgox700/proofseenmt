# Registre des traitements — Proofseen

> Brouillon technique écrit le 2026-10-06 depuis le schéma de la base (`packages/db/prisma/schema.prisma`) et le code.
> Il décrit ce que le logiciel fait réellement ; la relecture juridique reste au founder, à la fin.

Responsable de traitement : **e-kigai**, SCOP SAS à capital variable (marque Spar-X), SIREN 999 138 050, siège 1 Allée des
Écuries, 64600 Anglet — décision du founder du 2026-10-07 de reprendre les mentions légales de Spar-X
(https://www.spar-x.fr/mentions.html). Contact pour l'exercice des droits : data@spar-x.fr.

| # | Traitement | Personnes | Données | Base légale | Conservation (appliquée par) |
|---|---|---|---|---|---|
| 1 | Comptes et connexion | freelances, recruteurs | e-mail, nom affiché, identifiant Clerk, langue | contrat | jusqu'à l'effacement demandé (`DELETE /api/me`) |
| 2 | Profil freelance | freelances | titre, résumé, ville, TJM, disponibilité, compétences, adresses web déclarées et prouvées, missions vérifiées | contrat | jusqu'à l'effacement ; public seulement si publié, pseudonyme au choix |
| 3 | Identité de facturation | freelances | raison sociale, SIRET, TVA, adresse, compte Stripe | obligation légale (facturation) | avec le profil ; copie figée dans chaque contrat |
| 4 | Missions et candidatures | recruteurs, freelances | annonce, lettre de candidature, statut | contrat | jusqu'à suppression de la mission ou du compte |
| 5 | Messagerie | les deux parties | messages, consentement au contact | contrat | prise de contact sans réponse : 1 an sans message ; refus : messages supprimés 1 an après la décision, le refus lui-même gardé pour empêcher un nouveau contact (`retention.purge`) ; sinon jusqu'à l'effacement |
| 6 | Détection de coordonnées | les deux parties | indicateur « contient des coordonnées », jamais la coordonnée extraite | intérêt légitime (commission, sécurité) | avec le message |
| 7 | Devis, contrats, paiements, factures | les deux parties | montants, identités légales figées, identifiants Stripe | obligation légale (comptabilité, 10 ans) | 10 ans ; détachés du compte à l'effacement, jamais purgés avant |
| 8 | Avis | recruteurs, freelances | note et texte d'un avis de mission payée | contrat | avec le contrat ; auteur détaché à l'effacement |
| 9 | Notifications e-mail | tous | type, références (jamais le texte d'un message), état d'envoi | contrat | 90 jours après création si envoyée ou abandonnée, 1 an au plus sinon (`retention.purge`) |
| 10 | Alertes de missions | freelances | filtres de recherche | consentement (création volontaire) | jusqu'à suppression de l'alerte ou du compte |
| 11 | Demandes d'audit | prospects | nom, e-mail, adresses déclarées, consentement daté | consentement | 3 ans (`retention.purge`) ; effacées avec le compte de même e-mail |
| 12 | Mesure de visibilité IA | freelances audités | résumé par moteur (comptes) ; réponses brutes hors base, chiffrées | contrat | résumé avec le profil ; réponses brutes 72 h |
| 13 | Limitation de débit | tous | HMAC de l'adresse IP ou de l'identifiant, jamais l'adresse | intérêt légitime (sécurité) | 1 jour (`retention.purge` et purge aléatoire) |
| 14 | Événements Stripe | — | identifiant et type d'événement | obligation (idempotence des paiements) | 90 jours (`retention.purge`) |
| 16 | Retours de la bêta | visiteurs, freelances, entreprises | nature, côté, chemin de la page (sans paramètres), texte ; compte si connecté | intérêt légitime (amélioration du service) | 1 an (`retention.purge`) ; supprimés avec le compte, inclus dans l'export |
| 17 | Contrôle des SIRET au répertoire officiel | freelances, entreprises | SIRET envoyé à l'API publique Recherche d'entreprises ; verdict (actif, fermé, inconnu) et date | intérêt légitime (lutte contre la fraude, confiance) | avec l'identité de facturation ; revérifié tous les 30 jours ; le SIRET n'est jamais publié |
| 18 | Attestation de vigilance URSSAF | freelances | date de délivrance, code de sécurité, date de vérification par un opérateur | obligation légale de l'entreprise cliente (art. L8222-1 du Code du travail) | avec le profil ; remplacée à chaque nouvelle déclaration ; incluse dans l'export, effacée avec le compte |
| 15 | Journaux serveur | — | événement, nom de classe d'erreur, date ; jamais de message d'erreur, d'e-mail ni d'identifiant | intérêt légitime (exploitation) | selon l'hébergeur |

## Droits des personnes

- **Accès et portabilité** (art. 15 et 20) : `GET /api/me` remet un fichier JSON de tout ce que la base tient sur la
  personne, avec la liste de ce qui restera après effacement.
- **Effacement** (art. 17) : `DELETE /api/me` avec `{ "confirm": true }`. Refusé tant qu'un contrat est en cours ou que
  des fonds sont engagés (effacer une partie bloquerait l'autre). Restent, détachés : contrats, paiements, factures
  (obligation comptable, art. 17(3)(b)) et messages écrits au nom d'une entreprise (correspondance du freelance). Les
  conversations d'un freelance partent avec son profil. Le dernier membre d'une entreprise qui part ferme ses missions
  ouvertes. L'export d'un membre d'entreprise ne contient pas l'identité légale des freelances.
- Un prospect sans compte demande l'effacement par e-mail : `auditRequests.eraseByEmail`.

## Sous-traitants

Clerk (connexion), Stripe (paiements), Resend (e-mails), Railway (base de données), hébergeur du site (à fixer au GO
DEPLOY). Les fournisseurs d'IA interrogés lors des mesures ne reçoivent que des requêtes de recherche, jamais l'e-mail
d'une personne.

## AI Act

La recherche filtre sur des faits (compétences, ville, mode de travail, disponibilité, TJM) et trie sur un critère que
l'utilisateur choisit (récence, TJM). Aucun score, rang ni note globale d'une personne n'est calculé ou stocké ; les
avis ne sont jamais agrégés. `packages/db/test/ai-act.test.ts` échoue si une colonne ou un tri de ce type apparaît.
