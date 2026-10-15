# C15 — Messagerie vivante : passation

Branche `sprint/c15-messaging`. Rien de poussé, aucune PR. Migration `20261016090000_live_messaging` (additive).

## Construit

- **Lu / non lu par participant** (`packages/db/src/read-state.ts`, table `ConversationRead`) : un repère par personne
  et par fil (chaque membre d'une entreprise a le sien), posé à la date du dernier message lue dans la base, jamais en
  arrière. Non lu = message de l'autre côté (pour un membre : du freelance ; pour le freelance : de l'entreprise),
  postérieur au repère ; ce qu'écrit un collègue n'est pas « à lire ». Compte par fil (boîte de réception, pastille
  « 3 non lus », fils triés par dernière activité) et total plafonné à 100 (« 99+ »). Ouvrir la dernière page d'un fil
  le marque lu (pas une page ancienne) ; les liens de la boîte n'ont pas de préchargement, un survol ne lit rien.
  « Lu » sous son dernier message quand l'autre côté l'a lu (la lecture d'un collègue ne compte pas).
- **Direct sans serveur WebSocket** : déclencheurs Postgres `pg_notify('proofseen_live', …)` sur `Message` (insert),
  `ConversationRead` (insert/update) et `AppNotification` (insert, lecture) — identifiants seulement, livrés à la
  validation de la transaction. Un écouteur par conteneur (`packages/db/src/live-listener.ts`, client `pg` dédié,
  `LISTEN`, reconnexion avec attente croissante, `SELECT 1` toutes les 60 s, export séparé
  `@proofseen/db/live-listener`). Diffusion en mémoire (`apps/web/src/lib/live/hub.ts`) : les parties d'un fil sont
  relues dans la base à chaque signal (un ancien membre n'apprend plus rien), un tiers ne reçoit rien ; le navigateur ne
  reçoit jamais le message, seulement « il y a du nouveau ici » et ses compteurs, puis relit par les routes habituelles.
  Route SSE `GET /api/messages/stream` (session Clerk, sans paramètre, 60 ouvertures / 10 min par personne, 5 flux par
  personne, 2 000 par conteneur, battement toutes les 25 s, fin d'elle-même après 15 min pour revérifier la session,
  `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`). Après une reconnexion de l'écouteur, chaque écran
  relit (`resync`).
- **Écran d'un fil** (`components/live/ThreadMessages.tsx`) : rendu serveur (marche sans JavaScript), puis ajoute les
  nouveaux messages, marque lu si l'onglet est visible (`POST /api/conversations/<id>/read`, limité), affiche « Lu ».
  L'envoi reste l'action serveur. La boîte et le centre de notifications se rafraîchissent seuls (`LiveRefresh`).
  En-tête : « Messages (3) » dans la navigation, « Notifications (2) » à côté du rôle, rendus par le serveur puis tenus
  à jour (`LiveCount`, un seul EventSource partagé par onglet).
- **Pièces jointes** : trois au plus par message, PDF/PNG/JPEG/WebP, 5 Mo chacune, stockage de C14 (nouvel usage
  `message_attachment`, type lu dans le contenu, images réencodées en WebP sans métadonnées, 2 400 px, PDF à contenu actif
  refusé, quota du compte 30 fichiers / 40 Mo). Seulement dans un fil accepté. Rattachées au message dans la transaction
  d'envoi (à l'auteur seulement, une fois, trois au plus : vérifié aussi par un déclencheur). Lues par les parties du fil
  (`/fichiers/<id>` : `private, no-store`, PDF toujours en téléchargement, nom générique `piece-jointe.pdf`), affichées
  « Pièce jointe 1 (PDF) » / « (image) » avec aperçu pour les images. **Filtre des coordonnées conservé et étendu** : le
  texte d'un PDF (50 pages au plus) est relu ; avant un contrat payé, un PDF qui contient des coordonnées fait refuser le
  message comme le ferait le texte. Pièce jointe restée sans message (envoi refusé, message disparu) : purgée au bout
  d'un jour par la tâche planifiée, fichier compris.
- **Centre de notifications** (`AppNotification`, `packages/db/src/app-notifications.ts`, page `/[lang]/app/notifications`) :
  écrite dans la transaction de l'e-mail correspondant (`notifications.enqueue`) pour contact, message, candidature
  reçue / lue / qui avance, invitation, confirmation de mission, contrat ; et à la fin d'une mesure (`measurement_done`,
  sans e-mail). Écrite même si l'e-mail est coupé. Références seulement (liste fermée de clés, valeurs courtes), une seule
  non lue par fil ; lire le fil lit ses notifications. « Voir » (marque lue et ouvre), « Marquer comme lue », « Tout
  marquer comme lu ». Rétention : lues purgées à 90 jours, non lues à un an. RGPD : export (`liveMessaging` : repères,
  notifications, résumé), effacement par cascade ; une pièce jointe part avec le compte de son auteur (ajouté à
  `RETAINED_AFTER_ERASURE`).
- **Résumé quotidien par e-mail** (`MessageDigest`, désactivé par défaut, bouton sur la page des notifications) : à
  partir de 8 h (Paris), une fois par jour au plus, pris sous verrou ; seulement s'il reste des non-lus ; qui a écrit et
  combien, jamais le contenu (`packages/notify/src/digest.ts`). Un envoi échoué n'est pas réessayé le jour même.

## Fichiers principaux

- Base : `packages/db/prisma/schema.prisma`, `prisma/migrations/20261016090000_live_messaging/migration.sql`,
  `src/read-state.ts`, `src/app-notifications.ts`, `src/live.ts`, `src/live-listener.ts`, `src/message-digest.ts`,
  `src/gdpr-messaging.ts` ; modifiés : `messaging.ts` (pièces jointes), `inbox.ts` (non-lus), `stored-files.ts`,
  `notifications.ts`, `measurements.ts`, `retention.ts`, `gdpr.ts`, `index.ts`, `package.json` (`pg`, sous-export).
- Application : `src/lib/live/{hub,sse}.ts`, `src/data/{live,live-counts,attachments,digest-mail}.ts`,
  `src/components/live/*`, `src/lib/notification-link.ts`, `app/api/messages/stream`, `app/api/conversations/[id]/read`,
  `app/[lang]/app/notifications`, `i18n/market/live-{fr,en}.ts` ; modifiés : pages messages, `AppShell`, `WorkspaceNav`,
  layout de l'app, `/fichiers/[id]`, cron des notifications, `file-sniff`, `uploads`, `pdf-text`, `next.config.ts`
  (corps des actions serveur 16 Mo), `market.css`.
- E-mail : `packages/notify/src/digest.ts`.
- Tests : `packages/db/test/live-messaging.test.ts`, `packages/notify/test/digest.test.ts`,
  `apps/web/test/{live-stream,attachments,notification-link}.test.ts`.

## Variables d'environnement

Aucune nouvelle. L'écouteur utilise `DATABASE_URL` (connexion dédiée, en plus du pool : compter une connexion de plus
par conteneur). Le résumé utilise `RESEND_API_KEY` / `NOTIFY_FROM` comme les autres e-mails.

## Mise en production (après merge, GO DEPLOY)

1. `prisma migrate deploy` sur Railway : `20261016090000_live_messaging` (tables neuves, une colonne nullable sur
   `StoredFile`, une valeur d'énumération, contrainte de type des fichiers remplacée, déclencheurs NOTIFY).
2. Rebâtir l'image : dépendance `pg@8.23.1` ajoutée à `@proofseen/db` (déjà dans l'arbre via `@prisma/adapter-pg`).
3. Caddy : `encode zstd gzip` peut retarder les événements. Vérifier avec `curl -N https://proofseen.com/api/messages/stream`
   (session) que les `: ping` arrivent toutes les 25 s ; sinon exclure le flux de la compression :
   `@compress not path /api/messages/stream` puis `encode @compress zstd gzip`. `reverse_proxy` vide déjà ses tampons
   pour `text/event-stream`.
4. Recette à deux navigateurs (définition de fini) : contact, accord, échange en direct, pièce jointe PDF et image,
   « Lu », compteurs exacts après lecture, cloche, résumé quotidien activé puis reçu le lendemain matin.

## Non fait / suite

- **Réponse depuis l'e-mail** : non faite (il faut un domaine de réception chez Resend ou IONOS, une adresse de réponse
  signée par fil, et la même vérification des coordonnées). Prochaine étape.
- Les images jointes ne sont pas lues (pas d'OCR) : une image peut porter des coordonnées. Écrit sous le champ.
- Une seule instance : la diffusion est en mémoire par conteneur, mais chaque conteneur a son propre écouteur, donc
  plusieurs conteneurs fonctionnent aussi (chacun reçoit tous les signaux).
- Pas de vérification dans un navigateur ni de `next build` dans le worktree (ni base ni session Clerk).
- Le quota de 30 fichiers par compte compte les pièces jointes : un freelance très actif l'atteindra ; décision
  produit (quota séparé, ou expiration des pièces jointes d'un fil fermé).
- Un nouveau membre d'entreprise voit tout l'historique de ses fils comme non lu.
