# C12 — Écrans de la marketplace · reprise

> Mis à jour le 2026-10-08, branche `sprint/c12-ecrans`. Session de design ouverte par le « go » du founder du 2026-10-07.

## Pourquoi ce sprint

Les sprints C1 à C11 ont livré la marketplace côté données et API, mais l'espace connecté n'en montrait rien : même les
messages tournaient encore sur l'ancien stockage en fichiers. Aucun utilisateur de bêta n'aurait pu publier une mission,
postuler, envoyer un devis ou signer un contrat. C12 branche tout l'espace connecté sur la base.

## Architecture

- **Composants serveur et actions serveur** : chaque page lit la base par les dépôts de `@proofseen/db`, qui vérifient
  les droits dans leurs propres requêtes ; chaque formulaire passe par une action serveur. Ça marche sans JavaScript, et
  Next contrôle l'origine des actions. Il n'y a qu'un seul îlot client : la création d'une clé d'API, montrée une fois.
- **Contexte commun** : `apps/web/src/lib/market.ts`. La personne vient de la session et devient un acteur de la base ;
  l'entreprise courante, c'est la sienne ; un identifiant posté n'atteint un chemin de redirection qu'au format uuid.
- **Textes** : `apps/web/src/i18n/market/*`, en FR et EN avec les mêmes clés, un fichier par domaine (missions,
  profil, facturation, devis et contrats, équipe).
- **Modèles de lecture ajoutés** : `inbox.ts`, `billing-view.ts`, `contract-view.ts`, `organisation-view.ts`.

## Écrans livrés

| Côté | Écrans |
|---|---|
| Entreprise | Création de l'entreprise · missions (brouillon, publication, modification, clôture) · candidatures (retenir, choisir, décliner, sur des faits) · écrire à un profil publié · devis (accepter, décliner) et création du contrat · contrats (signature, annulation, validation, centre de coûts) · factures · facturation · équipe (membres, règle de validation, vivier, clés d'API, export comptable) |
| Freelance | Profil (rédaction, publication sous référence ou sous nom, retrait) · postuler depuis la page publique d'une mission · suivi des candidatures, avec retrait · devis à prix fixe dans l'échange · contrats et factures · facturation (identité, taux de TVA ou franchise, mandat de facturation, attestation de vigilance) |
| Les deux | Messages (accepter ou refuser un contact, répondre, clore), avec les coordonnées refusées avant un paiement |

## Exécuté sur Railway (le 2026-10-08)

Exécution avec des données jetables, effacées ensuite, le compte opérateur jouant le côté entreprise :

1. **Échange** :
   - un message contenant une adresse e-mail est refusé, avec la bonne phrase, sans être enregistré ;
   - un message propre est enregistré ;
   - l'envoi fonctionne au clavier seul ;
   - un fil d'un tiers renvoie 404 ;
   - pas de défilement horizontal sur téléphone.
2. **Devis** :
   - devis de 3 000 € accepté ;
   - première création de contrat refusée, parce que le freelance n'avait pas de SIRET : le refus est correct, et c'est un vrai trou d'interface, qu'on a corrigé (SIRET obligatoire sur le formulaire, message plus précis) ;
   - après correction, contrat créé avec les bons chiffres ;
   - contrat signé côté entreprise.
3. **Pages publiques** : la mission pointe vers la page de candidature, et le profil vers la page de contact.

L'exécution a aussi trouvé un **défaut de date** : une signature faite à 0 h 30 à Paris affichait la veille, parce que la
date était lue en UTC. Les dates des événements passent désormais par l'heure de Paris.

## Relecture sécurité

0 critique, 0 haute ; 4 moyennes, 3 basses. Corrigé :

- IndexNow : une annonce au plus toutes les cinq minutes par page, et seulement s'il y a un vrai changement ;
- limites de débit sur toutes les actions qui modifient quelque chose, et 50 brouillons au plus par entreprise ;
- **un simple membre n'engage plus l'entreprise** : accepter un devis, créer un contrat et signer sont réservés aux
  propriétaires et administrateurs, en base comme à l'écran ;
- un devis ne s'accepte plus dans un fil clos ;
- l'identité légale du freelance n'apparaît à l'entreprise qu'une fois qu'il a signé ;
- un identifiant posté n'atteint une redirection qu'au format uuid ;
- une adresse mal encodée sur la page de contact renvoie 404, et non plus 500.

Consigné sans changement de code :

- le limiteur de débit exige `PROOFSEEN_ACCESS_SECRET` en production, faute de quoi chaque instance compte seule
  (`C7_DEPLOY.md`) ;
- **SIRET d'un autre : tranché le 2026-10-08 par l'avocat du diable de la War Room** (délégation du founder). Un SIRET inconnu du répertoire, ou enregistré sous un autre nom que la raison sociale déclarée, bloque désormais la création et la signature du contrat, comme un SIRET fermé, des deux côtés (`registry_mismatch`). Un SIRET pas encore contrôlé ne bloque pas : risque résiduel accepté, pour qu'une panne de l'annuaire public ne gèle pas les contrats.

## Reste à faire

1. **[FOUNDER] Deux comptes de test**, un entreprise et un freelance, pour jouer le parcours complet des deux côtés dans
   le navigateur. Le compte opérateur ne voit pas ces écrans, et un compte Clerk (service externe) ne peut pas être créé
   par la War Room. En instance de développement Clerk, sans boîte mail : adresses `entreprise+clerk_test@example.com`
   et `freelance+clerk_test@example.com`, code de vérification **424242**.
2. **Paiement** (Stripe Elements) : à la fin du projet, avec les clés de test.
3. **Avis** après une mission, **relevés mensuels** (seulement quand la régie ouvrira), **préférences d'e-mails** et **alertes de
   missions**.
4. Lighthouse et accessibilité sur les écrans connectés.
