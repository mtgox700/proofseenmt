# C13 — corrections de la revue de sécurité

Branche `sprint/c13-security`. Chaque constat a d'abord un test qui échoue, puis la correction. Les mesures restent
coupées en production (`PROOFSEEN_MEASURE_ENABLED=0`) jusqu'au déploiement de ce lot.

## Étapes de production

1. **Migration** `20261014160000_measurement_spend_ledger` (table `MeasurementSpend`, aucune clé étrangère). Elle part
   au `prisma migrate deploy` habituel du déploiement.
2. **`deploy/vps/cron.sh`** appelle désormais `/api/cron/proofs` entre les notifications et les mesures. Recopier le
   script sur le VPS (il reste exécutable, mode 755). Aucune nouvelle variable d'environnement.
3. Le registre de dépense part vide : la dépense des demandes déjà en base n'y est pas reprise. Sans mesure lancée en
   production jusqu'ici (interrupteur à 0), il n'y a rien à reprendre.

## Constats

### 1. HAUT — SSRF par IP littérale dans une redirection
- **Défaut** : le refus des adresses internes ne vivait que dans le `lookup`, que Node saute pour une IP écrite dans
  l'URL ; une redirection vers `https://127.0.0.1:8443/`, `10.x` ou `169.254.169.254` passait.
- **Correction** (`packages/profiles/src/safe-fetch.ts`, `blocked-addresses.ts`) : avant **chaque** saut, première URL
  comprise — https seulement, port 443 seulement, **aucune IP littérale** (toutes refusées : une adresse prouvée est un
  nom). Plages bloquées étendues : `::/96` (IPv4 compatible), IPv4 mappée sous forme hexadécimale, `::ffff:0:0:0/96`,
  6to4 `2002::/16`, NAT64 `64:ff9b::/32`, Teredo `2001::/32`, site-local, `100::/64`, `192.88.99.0/24`. Le contrôle au
  `lookup` reste. Transport injectable (`requestImpl`) pour tester sans réseau.
- **Tests** : `safe-fetch.test.ts` — « refuse une IP littérale dès la première adresse… », « refuse tout port autre que
  443… », « refuse une redirection vers une IP littérale interne, avant de la suivre », « refuse une redirection vers un
  autre port ou en clair », « refuse les IPv4 transportées sous toutes leurs formes IPv6… ».
- **Risque résiduel** : la résolution DNS elle-même (requête vers le résolveur du serveur) reste émise pour un nom choisi
  par le client ; c'est voulu et sans corps de réponse.

### 2. HAUT — plafonds de dépense remis à zéro par l'effacement du compte
- **Défaut** : plafonds et limite par profil sommaient `MeasurementRequest`, supprimées en cascade avec le compte.
- **Correction** (`packages/db/src/measurement-ledger.ts`, `measurement-queue.ts`, `measurements.ts`, `retention.ts`) :
  registre `MeasurementSpend` (id, requestId sans clé étrangère, attempt, reservedCents, actualCents, hostKeys,
  startedAt, settledAt), sans aucune relation vers un compte ou un profil. Réserve au pire cas à la prise en charge ;
  règlement à la fin, à l'échec, au refus (dépense réelle) ou à l'expiration du bail (pire cas). Les plafonds se lisent
  dans le registre. La limite par profil compte aussi les lignes du registre portant une empreinte SHA-256 des adresses
  prouvées du profil (domaine sans `www.` pour un fichier ou un TXT, page pour une balise) : un compte neuf qui prouve le
  même domaine ne retrouve aucune place. Purge à 60 jours.
- **Choix pour un effacement pendant une mesure** : l'effacement n'est **pas** refusé ; la réserve reste au registre et
  compte au pire cas, puis la fin réelle la règle (la demande a disparu, mais `complete`/`fail` règlent d'abord le
  registre). Raison : aucune modification de `gdpr.ts` (fichier partagé avec d'autres lots), et la course « effacement
  vérifié / prise en charge simultanée » est couverte de toute façon par le registre.
- **Tests** : `measurement-ledger.test.ts` — « une dépense terminée reste comptée sur les plafonds après l'effacement… »,
  « un effacement pendant la mesure laisse sa réserve comptée au pire cas, puis la fin réelle la règle », « une réserve
  orpheline expire au pire cas… », « la limite par profil survit à l'effacement… », « le registre ne garde que 60 jours ».
- **Risques résiduels** : (a) une mesure déjà en vol au moment de l'effacement va jusqu'au bout (20 min au plus) : titre,
  compétences et ville partent encore aux moteurs, rien n'est réenregistré ensuite ; (b) les empreintes sont des
  pseudonymes (un domaine connu se recalcule) : finalité unique, 60 jours, à mentionner au registre des traitements ;
  (c) prouver un **autre** domaine sur un compte neuf ouvre de nouvelles places — borné par les 24 h d'ancienneté, la
  file plafonnée et les plafonds de la plateforme.

### 3. HAUT — une cible au goutte-à-goutte bloque la tâche planifiée
- **Défaut** : délai d'inactivité seulement ; la relecture des preuves attendait chaque lot avant paiements et e-mails.
- **Correction** : délai **total** par appel de `safeFetchText` (la requête est détruite, redirections comprises ;
  `deadlineMs`, par défaut `timeoutMs`) ; délai par relecture (12 s) et budget global du passage (60 s, le reste est
  remis au passage suivant, champ `deferred`) dans `apps/web/src/data/ownership.ts` ; délai de 10 s sur « Vérifier
  maintenant ». La relecture a quitté `/api/cron/notifications` pour sa propre route `/api/cron/proofs`, appelée par
  `cron.sh` après les notifications.
- **Tests** : `safe-fetch.test.ts` — « coupe une cible qui envoie au goutte-à-goutte… », « le délai total couvre toute la
  chaîne de redirections » ; `ownership.test.ts` — « une cible qui ne répond jamais ne retient pas le passage… », « le
  passage entier a un budget… », « répond dans le délai, sans rien enregistrer » ; `cron-proofs.test.ts`.
- **Risque résiduel** : une relecture coupée continue en arrière-plan jusqu'à son propre délai réseau (5 s par lecture),
  sans rien enregistrer d'autre que son résultat éventuel.

### 4. MOYEN — redirections héritées
- **Correction** (`apps/web/src/lib/legacy-pages.ts`, `middleware.ts`) : aucune route héritée pour un chemin qui commence
  par `//` ou contient `\` ; la cible est construite depuis `new URL(request.url)` en ne remplaçant que le chemin
  (`legacyTarget`).
- **Tests** : `legacy-pages.test.ts` — « builds no redirect from a path that a URL parser would read as another host »,
  « keeps the request's origin whatever the route says… ».

### 5. MOYEN — budget de la plateforme épuisé par une flotte de comptes
- **Correction** (`packages/db/src/measurement-eligibility.ts`) : au plus 20 demandes en file sur la plateforme
  (`platform_busy`, demandes sérialisées par un verrou consultatif), compte d'au moins 24 h (`too_recent`, avec la date
  de disponibilité). Textes FR/EN dans `visibility-{fr,en}.ts`. L'ordre de prise en charge reste « premier arrivé ».
- **Tests** : `measurement-ledger.test.ts` — « un compte de moins de 24 heures attend », « au-delà de 20 demandes en
  file… » ; `visibility-dictionary.test.ts`.

### 6. MOYEN — injection de consignes et identité soufflée
- **Correction** (`packages/measure/src/profile-text.ts`, `subject.ts`, `packages/core/src/text.ts`, `jd.ts`) : chaque
  champ perd ses caractères `\p{Cf}`/`\p{Cc}` et les délimiteurs `<>«»{}[]` et tient sur une ligne ; un titre ou une
  compétence contenant le nom, un mot du nom (4 lettres ou plus) ou un radical de domaine prouvé (sans TLD ni `www`,
  lettres et chiffres seulement) est écarté ; les champs entrent dans l'offre entre `<<< >>>`, annoncés comme des
  données. `normalizeText` retire les caractères de format ; `assertJdFreeOfIdentity` compare aussi les formes
  compactes (sauf variantes à initiale, pour ne pas confondre « A. Hammoudi » et « Lisa Hammoudi »).
- **Tests** : `run.test.ts` — bloc « un profil qui tente de souffler son identité ou des consignes au moteur » ;
  `jd.test.ts` — « sees through invisible characters… », « does not flag look-alikes built from initials… ».
- **Risque résiduel** : le texte de l'offre change de forme (intitulé et compétences entre délimiteurs) : les mesures
  faites depuis l'application ne sont pas comparables mot pour mot à une offre d'audit. Un modèle peut toujours choisir
  d'obéir à une donnée ; les délimiteurs réduisent le risque, ils ne l'annulent pas.

### 7. MOYEN — bail et durée d'exécution
- **Correction** : arrêt dur de `runMeasurement` à 20 min (`MEASUREMENT_MAX_RUN_MS`, bail 30 min), étapes en vol
  comptées au pire cas, échec `time_limit` sans nouvelle tentative ; `complete`/`fail`/`refuse` prennent la référence de
  l'essai (`RunRef` : id + attempts) et ne touchent que cet essai.
- **Tests** : `run.test.ts` — « s'arrête à sa durée maximale… », « sa durée maximale reste bien en deçà du bail… » ;
  `measurement-ledger.test.ts` — « une exécution périmée ne clôt jamais l'essai suivant de la même demande ».

### 8. MOYEN — saut de ligne dans /llms.txt
- **Correction** : `cleanSkillLabel` à l'écriture (`packages/db/src/skills.ts`, via `uniqueSkills`) et nettoyage au
  rendu (`packages/hub/src/llms-txt.ts`).
- **Tests** : `marketplace.test.ts` — « n'écrit jamais un libellé sur plusieurs lignes… » ; `skill-index.test.ts` —
  « écrit chaque libellé sur sa seule ligne… ».

### 9. BAS — plafond des adresses non atomique
- **Correction** (`owned-urls.ts`) : transaction, verrou `FOR UPDATE` du profil, compte, insertion.
- **Test** : `owned-urls.test.ts` — « le plafond tient sous des ajouts simultanés ».

### 10. BAS — attribut répété dans la balise meta
- **Correction** (`ownership-check.ts`) : le premier attribut fait foi, comme un analyseur HTML.
- **Test** : `ownership-check.test.ts` — « sur un attribut répété, le premier fait foi… ».

### 12. BAS — toute demande qui a coûté compte
- **Correction** : la limite par profil compte toute demande avec `costCents > 0`, quel que soit son état, plus les
  essais du registre non réglés ou réglés au-dessus de zéro.
- **Test** : `measurement-ledger.test.ts` — « toute demande qui a coûté compte, quel que soit son état… ».
