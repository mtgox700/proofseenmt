# Revue de sécurité vague 3 (C15 messagerie, C17 tableaux de bord, C19 back-office) : corrections

Branche `sprint/wave3-security-2`, reprise du lot `sprint/wave3-security` (commit « wip » remplacé par des commits par
sujet, rebasés sur `main` après C20). Migration unique : `20261016140000_wave3_security`.

Chaque point : le défaut, la correction, les tests (écrits d'abord, vus en échec, puis verts).

## MEDIUM

### M1. Contenu actif des PDF caché dans les flux d'objets ou les noms échappés

- **Défaut.** Le filtre par expression régulière (`file-sniff.ts`) ne voit ni les flux d'objets compressés ni les noms
  `#xx` ; le commentaire affirmait encore que les fichiers ne sont servis qu'à leur propriétaire, alors que les pièces
  jointes vont à l'autre partie et le CV aux entreprises.
- **Correction.** Le verdict vient du worker PDF (`apps/web/src/data/pdf-worker.mjs`), sur ce que PDF.js a lui-même
  analysé (flux d'objets décodés) : `getJSActions()` du document et des pages, `getOpenAction()`, `getAttachments()`,
  `getAnnotations()` (liens Launch/JavaScript/SubmitForm/ImportData, annotations FileAttachment, Sound, Movie, Screen,
  RichMedia, 3D, Widget, annotations portant des actions), présence d'AcroForm et de XFA. `pdf-scan.mjs` (dans le
  worker, plafonné) ouvre les flux d'objets pour les actions que PDF.js n'expose pas (Launch à l'ouverture ou sur un
  événement de page, SubmitForm, ImportData). Un PDF chiffré (même ouvrable sans mot de passe) est refusé. La regex
  reste le premier filtre, noms `#xx` décodés ; le commentaire est corrigé. CV (`cv-upload.ts`) et pièces jointes
  (`attachments.ts`) refusent un PDF actif.
- **Tests.** `apps/web/test/pdf-worker.test.ts` (vrai worker sur des PDF générés) : « reads a clean PDF », « finds a
  script run at opening hidden in a compressed object stream, which the raw scan misses », « finds a launch action
  hidden in a compressed object stream », « hands back the links of the document, a mailbox included », « takes a
  fillable form for active content », « reports an encrypted PDF », « sees through #xx escapes in names ».
  `cv-upload.test.ts` (« refuses a CV with active content, an encrypted one, an unreadable one or a too long one »).

### M2. Le filtre de coordonnées échouait ouvert

- **Défaut.** Un PDF illisible ou trop long passait pour « propre ».
- **Correction.** Pour une pièce jointe, un PDF illisible, chiffré ou de plus de 50 pages est refusé avec son message
  (FR/EN dans `live-fr.ts` / `live-en.ts`). Les URI des liens rendus par le worker sont lus comme le texte :
  `linkCarriesContact` (`packages/db/src/contact-urls.ts`) prend pour des coordonnées tout lien non web (mailto:,
  tel:, sms:, schémas de messagerie) et les adresses web de la liste de `contact-urls.ts` (wa.me, LinkedIn…).
  Extraction en `stopAtErrors: false`.
- **Tests.** `attachments.test.ts` : « refuses a PDF whose active content hides in an object stream, an encrypted one,
  an unreadable one and a too long one », « reads the links of a PDF for contact details, like its text » ;
  `contact-urls.test.ts` (« liens d'un document joint »).

### M3. Pièces jointes lues avant l'autorisation

- **Correction.** `messaging.canAttach` (une requête légère : partie du fil, contact accepté) avant de lire le moindre
  octet ou de lancer un worker ; budgets de workers séparés par usage dans `pdf-text.ts` (2 pour les CV, 2 pour les
  pièces jointes).
- **Tests.** `live-messaging.test.ts` (« dit, avant toute lecture de fichier, si l'acteur peut joindre des
  fichiers ») ; `pdf-text.test.ts` (« gives message attachments their own budget »).

### M4. Comptage d'audience gonflable

- **Correction.** Empreinte sur l'adresse ; le navigateur ne la partage qu'en 3 seaux au plus par adresse et par jour
  (`MAX_AGENTS_PER_ADDRESS`). Écritures limitées à 30 par minute et par adresse (`audience-rate.ts`). Au plus 5 000
  empreintes par profil et par jour en base (`MAX_SIGHTINGS_PER_PROFILE_DAY`, dans l'instruction même). Le comptage reste
  dans `after()` et ne change jamais le HTML.
- **Tests.** `audience.test.ts` (« rotating the browser string… »), `audience-rate.test.ts`, `audience-stats.test.ts`
  (« n'écrit plus d'empreinte au-delà du plafond du jour pour un profil »).

### M5. Masquer une page d'entreprise ne masquait pas ses missions

- **Correction.** Drapeau d'entreprise `Organisation.suspendedAt` / `suspensionReason` (CHECK : l'un sans l'autre
  impossible, motif de 3 à 1 000 caractères). Le nom diffère de la demande (`moderatedAt`/`moderationReason`) parce que
  ces colonnes existent déjà et portent le masque de la seule page publique, gardé tel quel. Action d'opérateur « Entreprise
  et ses missions » (cible `organisation`, clé : identifiant ou adresse de la page) dans `/operateur/moderation`,
  journalisée (`organisation_hidden` / `organisation_restored`) dans la même transaction, e-mail aux propriétaires et
  administrateurs, avis dans leur espace. `LISTED_MISSION` exclut les missions d'une entreprise masquée (via `NOT`,
  qu'une clé `organisation` posée par l'appelant ne peut pas écraser) ; `LISTED_COMPANY` exclut sa page ; suivi et
  avis aux abonnés aussi. L'identifiant de l'entreprise s'affiche dans la liste des vérifications.
- **Tests.** `moderation-public.test.ts` (« sa page et toutes ses missions, même écrites par un membre actif, jusqu'au
  rétablissement », « masquer la seule page publique laisse ses missions publiques ») ; `back-office.test.ts` (« une
  entreprise masquée avec ses missions : journal, e-mail aux administrateurs, avis, liste »).

### M6. Clés d'API d'une entreprise sans responsable actif

- **Correction.** `apiKeys.authenticate` refuse une clé si l'entreprise est masquée ou n'a plus aucun propriétaire ou
  administrateur non suspendu. La suspension d'un compte révoque les clés qu'il a créées, nombre au journal
  (`metadata.apiKeysRevoked`).
- **Tests.** `company-api.test.ts` (« la suspension d'un administrateur révoque ses clés, et le journal le dit », « une
  clé est refusée quand tous les propriétaires et administrateurs sont suspendus, ou l'entreprise masquée »).

## LOW

### L7. Écouteur en direct

- **Correction.** Ping avec délai (8 s) qui force la reconnexion ; `connectionTimeoutMillis` (10 s) sur le client pg ;
  connexion injectable pour les tests ; après reconnexion, relecture de chaque écran après un délai aléatoire (5 s au
  plus) ; délai de reconnexion SSE propre à chaque flux (5 s + jusqu'à 10 s) ; côté navigateur, réouverture après refus à
  1 min + jusqu'à 1 min.
- **Tests.** `packages/db/test/live-listener.test.ts` ; `live-stream.test.ts` (« spreads the re-reads after a
  reconnection… », « tells each browser a slightly different reconnection delay »).

### L8. Fait dans Caddy par le lead.

### L9. Listes et candidatures

- **Correction.** `isListedProfile` (même critère que `LISTED_PROFILE`) : dans les listes, un profil masqué ou suspendu
  se lit comme non publié ; dans le détail d'une candidature, pas d'adresse publique.
- **Tests.** `freelance-lists.test.ts`, `missions-space.test.ts` (« candidat retiré du public par un opérateur »).

### L10. Droits du rôle de base : hors lot, SQL recommandé plus bas.

### L11. Suspension contournée par effacement puis réinscription

- **Correction.** À l'effacement d'un compte suspendu : `ErasureTombstone` (HMAC-SHA256 de l'adresse normalisée sous une
  clé dérivée de `PROOFSEEN_ACCESS_SECRET`, motif et date de la suspension, rien d'autre ; intérêt légitime ; purge à
  3 ans dans `retention.ts`). `users.ensure` repose la suspension sur un compte de moins de 24 h dont l'adresse a une
  trace, puis supprime la trace (un opérateur qui lève ensuite la suspension n'est pas contredit). Normalisation :
  minuscules, sans alias `+…`, points Gmail retirés. Ligne ajoutée à `RETAINED_AFTER_ERASURE`. Côté site, tous les
  `ensure` passent par `accountUsers` (`apps/web/src/data/accounts.ts`), l'effacement par `erasureOptions()`.
- **Tests.** `erasure-tombstones.test.ts` ; `digest-unsubscribe.test.ts` (« erasure tombstone key »).

### L12. Comptes suspendus et e-mails

- **Correction.** `claimDue` ne prend pas un compte suspendu ; la file d'e-mails abandonne les e-mails en attente d'un
  compte suspendu (`lastError = 'account_suspended'`) sauf les avis de décision (`account_notice`) ; signal
  `suspended` (pg_notify dans la transaction de suspension) : le hub ferme les flux SSE ouverts de la personne.
  Résumés avec `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (lien signé par personne,
  route `POST /api/digest/unsubscribe` ; un GET ne change rien) ; le transport Resend transmet les en-têtes.
- **Tests.** `live-messaging.test.ts` (« les e-mails de messages sont abandonnés, l'avis de suspension part », « ne
  part pas pour un compte suspendu », signal) ; `live-stream.test.ts` (« closes every open stream of an account as soon
  as it is suspended ») ; `notify.test.ts` (en-têtes) ; `digest-unsubscribe.test.ts`.

### L13. Mots-clés montrés à partir de 3 apparitions (`MIN_KEYWORD_APPEARANCES`, `having` du groupBy).

- **Test.** `insights.test.ts` (ligne « rust » à 2, absente).

### L14. Recherche d'entreprises par action serveur

- **Correction.** `searchCompanies` (action serveur, limitée) et composant `CompanySearch` ; plus de formulaire GET ni
  de `q` dans l'adresse.
- **Test.** `operator-access.test.ts` (« searches companies through a server action… »), plus le contrôle existant
  « every back-office entry point goes through the gate » qui couvre la nouvelle action.

### L15. En attente vers fermé

- **Correction.** Application : `messaging.decide` n'accepte que `accepted`/`declined`. Base : le déclencheur
  `proofseen_conversation_decision` n'admet `pending → closed` que si la transaction a posé
  `set_config('proofseen.operator_review', 'on', true)`, ce que fait seule la relecture des premiers contacts.
- **Test.** `back-office-queues.test.ts` (« n'est permise qu'à la relecture des opérateurs, jusque dans la base »).

## Risques résiduels

- La détection de contenu actif reste une liste : un type d'action inconnu de PDF.js et de `pdf-scan.mjs` passerait.
  `pdf-scan.mjs` refuse ce qu'il ne sait pas ouvrir (filtre inhabituel, prédicteur, flux corrompu) : quelques PDF
  légitimes peuvent être refusés, et les formulaires remplissables le sont tous.
- Les images ne sont pas lues (pas d'OCR) : des coordonnées dans une image passent, comme l'indique l'aide.
- Le seau de navigateur (3 par adresse) fusionne parfois deux vrais visiteurs ; une adresse partagée (entreprise, CGNAT)
  compte 3 visiteurs au plus par jour. Un attaquant qui change d'adresse IP gonfle encore les vues, plafonnées à 5 000
  empreintes par profil et par jour.
- L'écriture du limiteur d'audience reste une écriture par requête (une ligne par adresse et par minute, purgée).
- Une entreprise masquée : ses membres gardent l'accès à leur espace et à la messagerie existante ; seuls les chemins
  publics, les missions et l'API sont coupés.
- La trace d'effacement ne reconnaît que la même boîte (avec ses variantes `+` et points Gmail) ; une autre adresse
  échappe toujours à la suspension. Sans `PROOFSEEN_ACCESS_SECRET`, aucune trace n'est écrite (journal d'erreur).
  La suspension reposée par une trace n'a pas d'entrée au journal des opérateurs (aucun opérateur n'agit).
- Le garde-fou SQL de L15 attrape une erreur de l'application, pas un rôle compromis : toute session peut poser le
  réglage. La vraie frontière serait une fonction `SECURITY DEFINER` réservée à un rôle d'opérateur distinct.
- Le lien de désinscription d'un résumé porte l'identifiant interne du compte dans l'URL (opaque, signé) ; il ne permet
  que de couper ce résumé.

## Mise en production

1. Merge, puis `prisma migrate deploy` (applique `20261016140000_wave3_security` : deux valeurs d'énumération, colonnes
   d'entreprise, table `ErasureTombstone`, contraintes, déclencheur de conversation remplacé).
2. Vérifier que `PROOFSEEN_ACCESS_SECRET` est posé (32 caractères au moins) : sans lui, ni trace d'effacement ni lien de
   désinscription.
3. Redéployer l'image (le worker PDF et `pdf-scan.mjs` sont copiés avec le dépôt, rien à configurer).
4. Contrôles à la main : déposer un PDF à formulaire en pièce jointe (refusé) ; masquer une entreprise de test avec ses
   missions puis la rétablir ; vérifier les en-têtes `List-Unsubscribe` d'un résumé reçu.

## L10 : droits recommandés pour le rôle applicatif (non appliqués)

```sql
-- Un rôle propriétaire pour les migrations, un rôle applicatif sans DDL.
CREATE ROLE proofseen_owner NOLOGIN;
CREATE ROLE proofseen_app LOGIN PASSWORD '<secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER SCHEMA public OWNER TO proofseen_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO proofseen_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO proofseen_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO proofseen_app;
ALTER DEFAULT PRIVILEGES FOR ROLE proofseen_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO proofseen_app;
ALTER DEFAULT PRIVILEGES FOR ROLE proofseen_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO proofseen_app;
-- Le journal des opérateurs : ajout et purge à cinq ans seulement (le déclencheur reste le garde-fou).
REVOKE UPDATE, TRUNCATE ON "OperatorAction" FROM proofseen_app;
-- Aucune table ne se vide d'un coup depuis l'application.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM proofseen_app;
-- Ni déclencheur ni fonction créés ou remplacés par l'application.
REVOKE CREATE ON SCHEMA public FROM proofseen_app;
-- Les migrations tournent sous proofseen_owner (DATABASE_URL de migration distincte de celle du site).
```
