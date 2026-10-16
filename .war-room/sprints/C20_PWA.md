# C20 — Lot PWA : application installable et notifications poussées

Branche `sprint/c20-pwa`. Rien de poussé, aucune PR. Migration `20261016130000_push_subscriptions` (additive : deux
tables neuves, aucune colonne modifiée). La moitié Stripe de C20 attend le founder : ce lot n'y touche pas.

## Construit

- **Manifeste** par langue, `/fr/app.webmanifest` et `/en/app.webmanifest` (`src/lib/pwa/manifest.ts`, route
  statique) : nom Proofseen, `start_url` `/<lang>/app`, `scope` `/`, `display` standalone, couleur `--bg` des jetons
  (`#070b14`, vérifiée par un test contre `tokens.css`), icônes 192/512 « any » et « maskable », raccourcis Messages,
  Missions, Notifications. Un seul `id` (`/app`) pour les deux langues : installer en français puis ouvrir en anglais,
  c'est la même application. Lié **uniquement** depuis la mise en page de l'espace connecté (`[lang]/app/layout.tsx`,
  avec les méta Apple et l'icône `apple-icon.png` du segment). Aucun manifeste à la racine de `app/` (Next le lierait
  depuis toutes les pages) : un test l'interdit.
- **Icônes** dessinées depuis le logo (`[lang]/icon.svg`) par `apps/web/scripts/pwa-icons.ts` (sharp), fichiers
  committés dans `public/icons/` (icon-192, icon-512, maskable-192, maskable-512, badge-96 monochrome pour Android) et
  `src/app/[lang]/app/apple-icon.png` (180). Régénérer : `pnpm --filter @proofseen/web icons`.
- **Service worker** `public/sw.js` (JS simple, portée `/`), enregistré par `components/pwa/ServiceWorkerRegistrar.tsx`
  dans l'espace connecté seulement. Ce qu'il fait :
  - pages `/fr/app/**` et `/en/app/**` (navigation GET) : réseau d'abord, **jamais mises en cache** ; sans réseau, la
    page `/offline` ;
  - `/_next/static/**` (fichiers à empreinte, immuables) : cache d'abord, 300 entrées au plus ; jamais sur
    `localhost` (le serveur de développement sert des fichiers sans empreinte) ;
  - tout le reste passe au réseau sans qu'il y touche : pages publiques, API, `/fichiers`, flux SSE, actions serveur
    (POST). Le HTML public est donc identique avec ou sans service worker, et les robots ne l'exécutent jamais ;
  - caches versionnés (`proofseen-v1-*`), ceux d'une autre version supprimés à l'activation ;
  - `push` : affiche titre + phrase envoyés par le serveur, icône et badge ; `notificationclick` : ouvre ou met au
    premier plan l'application sur le lien reçu, **jamais hors du site** (sinon le centre de notifications) ;
    `pushsubscriptionchange` : renvoie le nouvel abonnement au serveur.
  - `/sw.js` servi avec `Service-Worker-Allowed: /` et `Cache-Control: no-cache` (`next.config.ts`) ; l'enregistrement
    utilise `updateViaCache: "none"`.
- **Page hors ligne** `/offline` (`src/lib/pwa/offline-page.ts`) : statique, français puis anglais, sans script ni
  ressource externe, `noindex`, couleurs des jetons recopiées (test de cohérence). Mise en cache à l'installation.
- **Notifications poussées (Web Push, VAPID, aes128gcm)** avec le paquet `web-push@3.6.7` (licence MPL-2.0, dépendance
  de `@proofseen/web`) :
  - `PushSubscription` (personne, adresse d'envoi unique, clés, libellé court « Chrome · Android » — jamais l'en-tête
    complet —, création, dernière réussite, échecs) et `PushDelivery` (file : une ligne par notification et par appareil).
  - **Anti-SSRF** : l'adresse d'envoi doit être celle d'un service de notifications connu (`fcm.googleapis.com`,
    `android.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`), en https,
    sans identifiants ni port ; contrôle en base (https, longueur, format des clés).
  - Réglage sur `/[lang]/app/notifications` : « Recevoir les notifications sur cet appareil » (case à bascule) qui
    demande la permission, s'abonne et envoie l'abonnement à `POST /api/push/subscribe` ; décocher appelle
    `DELETE /api/push/subscribe` et désabonne le navigateur. Session Clerk, même origine, JSON seulement, 20 demandes /
    10 min par personne. Nombre d'appareils abonnés affiché. Section masquée si les clés VAPID manquent.
  - **Dix appareils au plus** par compte : le onzième remplace celui qui a servi le moins récemment (sous verrou du
    compte ; déclencheur en base en filet). Un appareil n'appartient qu'à un compte : s'abonner depuis un navigateur
    déjà abonné pour un autre compte le lui retire.
  - **Mise en file** dans la transaction de `recordAppNotifications` (C15) : chaque notification de l'application
    écrite devient une poussée par appareil abonné. Une notification regroupée (fil déjà non lu) ne pousse rien de plus.
  - **Envoi** par la tâche planifiée `/api/cron/notifications` (toutes les 5 min), avant les e-mails et quel que soit
    le transport d'e-mail : 3 lots de 100 au plus, 8 envois à la fois, bail de 2 min (`FOR UPDATE SKIP LOCKED`),
    3 essais (1 min puis 10 min), **abonnement supprimé sur 404/410**. Retirées de la file avant chaque passage : une
    notification déjà lue dans l'application, un compte suspendu, une attente de plus d'un jour, un abonnement et une
    notification qui ne sont pas à la même personne.
  - **Contenu** : titre « Proofseen », la phrase exacte du centre de notifications (générique : « Nouveau message dans
    une conversation. »), le lien de `notification-link.ts`, une étiquette par fil (les poussées d'un même fil se
    remplacent sur l'appareil). Jamais le texte d'un message, un nom, un montant.
- **Comptes suspendus (C19)** : abonnement refusé (route et base), rien mis en file, rien envoyé si la suspension
  arrive après la mise en file.
- **RGPD** : l'export (`liveMessaging.pushSubscriptions`) donne le service (hôte), le libellé, les dates et le nombre
  d'échecs, jamais l'adresse complète ni les clés ; l'effacement du compte supprime les abonnements (cascade).
- **Conservation** : abonnement sans réussite depuis 90 jours (ni depuis sa création) purgé ; ligne de file de plus
  d'un jour purgée (`retention.ts`, `PurgeReport.pushSubscriptions` / `pushDeliveries`).

## Fichiers

- Base : `packages/db/prisma/schema.prisma`, `prisma/migrations/20261016130000_push_subscriptions/migration.sql`,
  `src/push-subscriptions.ts`, `src/push-enqueue.ts`, `src/push-queue.ts` ; modifiés : `app-notifications.ts`,
  `retention.ts`, `gdpr-messaging.ts`, `index.ts`.
- Application : `public/sw.js`, `public/icons/*`, `scripts/pwa-icons.ts`, `src/app/[lang]/app.webmanifest/route.ts`,
  `src/app/[lang]/app/apple-icon.png`, `src/app/offline/route.ts`, `src/app/api/push/subscribe/route.ts`,
  `src/lib/pwa/{manifest,offline-page,base64url,push-client}.ts`,
  `src/lib/push/{vapid,payload,sender,device-label,subscribe-route}.ts`, `src/data/{push-delivery,web-push-sender}.ts`,
  `src/components/pwa/{ServiceWorkerRegistrar,PushToggle}.tsx`, `src/i18n/market/pwa-{fr,en}.ts` ; modifiés : layout
  de l'app, page des notifications, cron des notifications, `next.config.ts`, `i18n/market/{fr,en}.ts`,
  `package.json` (`web-push`, `@types/web-push`, script `icons`).
- Tests : `packages/db/test/push.test.ts`, `packages/hub/test/no-pwa.test.ts`,
  `apps/web/test/{pwa,service-worker,push}.test.ts`.

## Variables d'environnement

| Variable | Exemple | Rôle |
|---|---|---|
| `PROOFSEEN_VAPID_PUBLIC_KEY` | 87 caractères base64url | donnée au navigateur à l'abonnement |
| `PROOFSEEN_VAPID_PRIVATE_KEY` | 43 caractères base64url | **secret**, signe chaque poussée |
| `PROOFSEEN_VAPID_SUBJECT` | `mailto:contact@proofseen.com` | contact donné aux services de notifications (`mailto:` ou `https://`) |

Sans les trois (valides), la fonction est éteinte : réglage masqué, rien d'envoyé ; une configuration incomplète est
signalée dans les journaux par la tâche planifiée. Lues à l'exécution (pas de `NEXT_PUBLIC_`), aucun rebuild pour les
changer.

Générer les clés, **une seule fois** (en changer désabonne tous les appareils) :

```
pnpm --filter @proofseen/web exec web-push generate-vapid-keys
```

(ou `npx web-push@3.6.7 generate-vapid-keys`). Ranger la clé privée avec les autres secrets du VPS, jamais dans le dépôt.

## Mise en production (après merge, GO DEPLOY)

1. `prisma migrate deploy` : `20261016130000_push_subscriptions` (deux tables, contraintes, un déclencheur).
2. Rebâtir l'image : nouvelle dépendance `web-push` (le `Dockerfile` réinstalle avec le lockfile).
3. Poser les trois variables VAPID dans l'environnement du conteneur, redémarrer.
4. Vérifier :
   - `curl -I https://proofseen.com/sw.js` → `Service-Worker-Allowed: /` et `Cache-Control: no-cache` ;
   - `curl https://proofseen.com/fr/app.webmanifest` → JSON, `content-type: application/manifest+json` ;
   - `curl https://proofseen.com/offline` → la page bilingue ;
   - une page publique (`/fr/profils/...`) : aucun `manifest`, aucun `sw.js` dans le HTML (`curl | grep -i -E "manifest|sw.js"` vide) ;
   - la sortie de la tâche planifiée (`deploy/vps/cron.sh`) contient `"pushes":{"sent":…}` (ou `null` sans clés).
5. Caddy : rien à changer.

## Tester sur un téléphone

- **Android (Chrome)** : ouvrir `https://proofseen.com/fr/app`, se connecter, menu ⋮ → « Installer l'application ».
  Ouvrir depuis l'icône (plein écran, sans barre d'adresse). Notifications → cocher « Recevoir les notifications sur
  cet appareil » → Autoriser. Depuis un autre compte (ordinateur), écrire à ce compte : la notification arrive au plus
  5 min après (passage de la tâche planifiée). La toucher ouvre le fil. Mode avion puis ouvrir Messages : page hors
  ligne.
- **iPhone / iPad (iOS 16.4 ou plus)** : Safari → Partager → « Sur l'écran d'accueil ». Ouvrir depuis l'icône (l'app
  installée a ses propres cookies : **se reconnecter dedans**), Notifications → cocher → Autoriser. Sans installation,
  Safari iOS ne propose pas les notifications : la page le dit.
- **Ordinateur** (Chrome, Edge, Firefox) : même réglage ; DevTools → Application → Manifest / Service workers pour
  contrôler l'installabilité ; « Push » dans l'onglet Service workers envoie une poussée de test.

## Non fait / suite

- Délai jusqu'à 5 minutes (cadence de la tâche planifiée). Pour du quasi-instantané : déclencher l'envoi à la fin de
  l'action qui crée la notification, ou un passage plus fréquent dédié aux poussées.
- Se déconnecter ne désabonne pas l'appareil : le compte suivant sur le même navigateur peut voir les notifications
  (génériques) du précédent jusqu'à ce qu'il s'abonne lui-même ou que le premier décoche. À brancher sur la
  déconnexion Clerk.
- Pas de préférence par type (une case par appareil) ; pas de mode hors ligne des pages (seulement la page d'excuse).
- Ni `next build`, ni navigateur, ni téléphone dans le worktree : la recette ci-dessus reste à faire après déploiement.
- `pushsubscriptionchange` dépend d'une session Clerk encore valide dans le service worker : sinon l'ancien abonnement
  est retiré au premier 410 et la personne recoche la case.
