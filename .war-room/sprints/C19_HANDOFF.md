# C19 — Back-office opérateur · passation

Branche `sprint/c19-back-office` (non poussée, pas de PR). Migration `20261016110000_back_office`.

## Ce qui est livré

| Bloc | Où | Note |
|---|---|---|
| Accès | `apps/web/src/lib/operator-access.ts`, `lib/operator.ts`, `app/[lang]/app/operateur/layout.tsx` | Opérateur = session (OPERATOR_EMAILS, adresses vérifiées). Tout autre visiteur reçoit le 404 d'une page inconnue : layout, chaque page, chaque action, la route d'export. Chaque action est limitée (40/min par opérateur et par type). |
| Journal | modèle `OperatorAction`, `packages/db/src/back-office.ts`, `operator-log.ts`, page `/operateur/journal` | Écrit dans la transaction de l'action. Ajout seul : déclencheur qui refuse UPDATE, DELETE (avant 5 ans) et TRUNCATE. Motif obligatoire en base pour toute décision qui touche quelqu'un. Sans clé étrangère : survit à l'effacement des comptes. Purge à 5 ans dans `retention.ts`. |
| Modération | `moderation.ts`, `public-visibility.ts`, page `/operateur/moderation` | `moderatedAt`/`moderationReason` sur profil, mission, entreprise. Fragments `LISTED_PROFILE`, `LISTED_MISSION`, `LISTED_COMPANY` ajoutés à tous les chemins publics (pages profil, annuaire, recherche, API profil, missions + plein texte, sitemaps, villes, métiers, llms.txt, entreprises, baromètres, avis publics, photos publiques, candidature, contact par référence). E-mail `account_notice` + avis dans l'espace (profil, missions, page publique, facturation) avec formulaire de contestation. |
| Premiers contacts | `contact-review.ts`, `ContactReview`, page `/operateur/contacts` | Premier message d'une entreprise ou d'un compte de moins de 7 jours : signalé, **jamais retenu**. `FIRST_CONTACT_REVIEW.mode` = `"flag"` ; `"hold"` est prévu, pas branché (il faudra retenir aussi la notification et l'affichage du fil, côté C15). Fermer = statut `closed` (le déclencheur accepte désormais en attente → fermé). |
| Vérifications | `vigilance-desk.ts`, `proof-disputes.ts`, `registry-desk.ts`, page `/operateur/verifications` | URSSAF : vérifier avec le code contrôlé (même règle que la CLI), refuser avec motif (`rejectedAt`). Adresses contestées : lues dans `OwnedUrl` (même clé prouvée par l'un, déclarée par l'autre), retrait de preuve avec motif. Entreprises : état au répertoire, relance du contrôle (API publique gratuite). |
| Comptes | `user-desk.ts`, pages `/operateur/utilisateurs` (+ `[id]`, + route `export`) | Recherche par e-mail ou référence (action serveur : l'adresse ne passe jamais dans l'URL). Résumé = faits et nombres, jamais un message. Suspension / levée avec motif ; un opérateur ne se suspend pas. Export RGPD journalisé avec la demande de support. Aucune usurpation d'identité possible. |
| Suspension appliquée | `lib/market.ts` (`pageMarket`, `actionMarket`), `lib/api.ts` (`caller`), page `/app/suspendu` | Compte suspendu → page de suspension (motif + contestation) ; API connectée → 403 « compte suspendu » ; contenus publics masqués. |
| Retours | `feedback-triage.ts`, page `/operateur/retours` | Statut (nouveau, retenu, fait, écarté) + note. Les contestations (`page = /app/contestation`) arrivent avec le compte. |
| Chiffres | `operator-stats.ts`, pages `/operateur/entonnoir`, `/operateur/mesures` | `funnel(db)` sur une période ; dépense du registre (jour, mois, 24 h, 30 j), file, échecs. Affichage seul. |

## Tests ajoutés

- `packages/db/test/moderation-public.test.ts` : un test par chemin public (18).
- `packages/db/test/back-office.test.ts` : journal en ajout seul, motif exigé en base, rétention, suspension, comptes, retours, chiffres.
- `packages/db/test/back-office-queues.test.ts` : premiers contacts, URSSAF, adresses contestées, répertoire.
- `apps/web/test/operator-access.test.ts` : red team — 404 pour chaque type de visiteur, et chaque page / action / route passe par la porte (lecture des fichiers).
- `apps/web/test/suspension.test.ts`, `apps/web/test/operator-period.test.ts`, `packages/notify/test/account-notice.test.ts`.

## Reste à faire / à savoir

1. **Fichiers partagés touchés** (ajouts ciblés) : `schema.prisma`, `gdpr.ts` (export `operatorDecisions`, ligne de conservation), `retention.ts`, `messaging.ts` (signalement dans la transaction du contact, profil masqué refusé), `inbox.ts`, `mission-invitations.ts`, `freelance-lists.ts`, `public-profiles.ts`, `profile-search.ts`, `barometers.ts`, `company-pages.ts`, `missions.ts`, `AppShell.tsx` (lien Back-office), `i18n/market/fr.ts|en.ts`, `lib/api.ts`, `lib/market.ts`. À fusionner avec C15 / C17 / correctifs vague 2 : conflits attendus de quelques lignes seulement.
2. **Déclencheur `proofseen_conversation_decision` redéfini** (en attente → fermé ajouté) : si C15 le redéfinit aussi, garder les deux règles.
3. **CLI `vigilance`** : marque toujours vérifiée sans écrire au journal (pas d'identité d'opérateur en CLI) ; elle refuse désormais une attestation refusée. À terme, préférer l'écran.
4. Un profil masqué ou suspendu ne peut plus être contacté (`messaging.contact`, `inbox.ts`), invité à postuler (`mission-invitations.ts`) ni ajouté à une liste (`freelance-lists.ts`). Il reste dans les listes et les fils existants de l'entreprise (données privées de celle-ci).
5. Revue sécurité (sous-agent) : aucun CRITIQUE ni HAUT. Corrigés : opérateur suspendu exclu du back-office, en-tête Origin exigé sur l'export, fermeture d'un fil sans course, recherche d'entreprise sans 500, missions masquées exclues des invitations, missions enregistrées et notifications d'abonnés. Restent, assumés ou à trancher :
   - masquer une page d'entreprise ne masque pas ses missions (cibles distinctes, comme le demande le lot) ;
   - l'export RGPD téléchargé par l'opérateur contient les messages de la personne (c'est son droit d'accès : il doit être remis à elle seule) ;
   - les lectures (résumé de compte, premier message relu) ne sont pas journalisées, seul l'export l'est ;
   - une clé d'API d'entreprise reste valable si tous ses administrateurs sont suspendus ;
   - la recherche d'entreprise du back-office passe par l'URL (nom ou SIRET).
6. Pas d'exécution réelle dans un navigateur ni sur la vraie base dans ce lot (pas de `next build`, consigne) : à faire avec le founder — vérifier une attestation et masquer un profil depuis l'écran, puis relire le journal (DoD C19).
7. À faire relire par le juriste (non bloquant) : conservation 5 ans du journal (motifs pouvant contenir des données personnelles), information des personnes sur la modération et la suspension, procédure de contestation.
