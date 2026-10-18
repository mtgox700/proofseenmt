# C22 — lot C : communauté (publications, réactions, commentaires, partages, vues)

Branche `sprint/c22-community` (non poussée, pas de PR). Migration `20261018110000_community` (additive : tables
neuves, valeurs d'énumération ajoutées, CHECK et déclencheurs).

## Livré

**Données** (`packages/db`)
- `Post` : au nom d'un profil freelance publié **ou** d'une entreprise (écrite par l'un de ses membres), exactement un
  des deux (CHECK). Texte Markdown simple (3 000 caractères), lien https facultatif (filtre des adresses de contact),
  image facultative (`StoredFile` `post_image`, réencodée en WebP sans métadonnées, 2 Mo, 1 600 px), visibilité
  `public` | `members`, `createdAt` / `editedAt` / `deletedAt`, `moderatedAt` + motif (CHECK comme C19).
- **Partage = une publication** qui reprend une publication publique (`sharedPostId`), commentaire facultatif
  (1 000 caractères). Décision : un partage vit dans les fils, se modère, se supprime et s'exporte comme une
  publication ; pas de table `PostShare` séparée. Un partage d'un partage reprend l'original ; un partage n'a ni lien
  ni image ; une publication « membres » ne se partage pas (déclencheur `Post_rules`). Un partage part avec l'original
  quand celui-ci est effacé pour de bon.
- `PostReaction` (une par personne et par publication : like, insightful, celebrate, support — des mots, jamais une
  note), `PostComment` (un seul niveau de réponse, déclencheur `PostComment_thread`, 1 500 caractères, au nom d'un
  profil ou d'une entreprise), `ProfileFollow` (n'importe quel compte suit un profil publié, jamais le sien :
  déclencheur ; les entreprises suivies restent `CompanyFollow` de C16), `PostStatDay` + `PostStatSeen` (impressions
  et vues, empreinte du jour HMAC de C17, CHECK qui refuse toute autre forme : une IP ne peut pas entrer).
- Règles : filtre des coordonnées sur publications, commentaires, commentaires de partage et liens (refusé, pas
  signalé : c'est public) ; HTML brut refusé ; plafonds sous verrou du compte (10 publications partages compris et 100
  commentaires par 24 h glissantes) ; débit limité côté site (publier 5/min, commenter 10/min, réagir 60/min, suivre
  20/min).
- Visibilité publique : `LISTED_POST` / `LISTED_COMMENT` (`public-visibility.ts`) — supprimé, masqué, auteur suspendu,
  profil privé/masqué/suspendu, entreprise masquée ou sans membre actif : hors de tout chemin public (page publique,
  sitemap, llms.txt, sections des pages profil et entreprise, fil Découvrir, images, nombre de commentaires et de
  partages).
- Modération (`community-moderation.ts`, modèle C19) : masquer / rétablir une publication ou un commentaire avec motif,
  une instruction conditionnelle, journal `OperatorAction` (`post_hidden`, `post_restored`, `comment_hidden`,
  `comment_restored`, cibles `post`, `comment`) et e-mail `account_notice` à l'auteur dans la même transaction.
  L'auteur voit son contenu masqué avec le motif ; personne d'autre.
- Notifications de l'application (+ poussées C20) : `post_comment` (auteur de la publication et du commentaire auquel
  on répond), `post_reaction` (première réaction d'une personne), `post_share`, `new_follower` ; regroupées : une seule
  non lue par publication (et une seule « nouveaux abonnés »). Références seulement (`postId`, `commentId`).
- RGPD : export `community` (publications, commentaires, réactions, profils suivis, nombre d'abonnés, audience par
  jour) ; effacement : publications du profil, réactions et abonnements partent ; commentaires vidés et sans auteur
  (« Compte supprimé ») ; publications écrites au nom d'une entreprise restent à elle sans auteur (comme les missions).
  Ligne ajoutée à `RETAINED_AFTER_ERASURE`.
- Conservation : publication supprimée effacée pour de bon après 30 jours (commentaires, réactions et partages avec
  elle), empreintes du jour purgées le lendemain, compteurs 13 mois (`retention.purge` : `deletedPosts`,
  `postAudience`).

**Pages** (`apps/web`, `packages/hub`)
- `/[lang]/app/fil` : onglets Suivis (profils et entreprises suivis + ses propres publications, masquées comprises
  avec le motif) et Découvrir (publications publiques récentes). **Ordre : date seulement, écrit à l'écran.** Composer
  (texte, lien, image, visibilité), réactions, partage, modification et suppression : formulaires et actions serveur,
  tout marche sans JavaScript. Impressions comptées après l'envoi de la page (`after`), vues sur la page de la
  publication ; impressions et vues montrées à qui répond de la publication seulement.
- `/[lang]/app/fil/[id]` : publication et commentaires (réponses à un niveau, modifier / supprimer les siens ; l'auteur
  de la publication peut supprimer un commentaire).
- `/[lang]/app/abonnements` : profils et entreprises suivis, abonnés (nommés seulement s'ils ont eux-mêmes un profil
  publié, sous ce profil ; les autres comptés), confirmation de suivi depuis `?suivre=FR-XXXXX` (jamais un suivi sur un
  GET). Une entreprise ne voit toujours pas qui la suit (décision C16 gardée).
- `/[lang]/publications/[id]` : page publique (hub, zéro JS, JSON-LD `SocialMediaPosting`, commentaires en texte,
  lien d'auteur, compteurs publics de réactions / commentaires / partages). **Décision : un profil pseudonyme publie
  sous sa référence, publications indexables** ; son nom ne sort jamais (ni page, ni JSON-LD, ni llms.txt), pas d'image
  sous un pseudonyme. `sitemap-posts.xml` (originaux publics), déclaré dans le robots.txt et l'index ; section
  « Recent community posts » de llms.txt (50 dernières). `marketplace-verify` vert sur la page rendue.
- « Publications récentes » (5) sur les pages publiques de profil et d'entreprise.
- Navigation : entrée « Fil » (freelance et entreprise). Back-office : `/app/operateur/communaute` (récents et masqués,
  masquer / rétablir avec motif).

## Tests
- `packages/db/test/community-posts.test.ts` (12) et `community-engagement.test.ts` (8) : qui parle, filtre des
  coordonnées, HTML, liens, plafonds, membres / public, modification par l'auteur et les administrateurs, ordre et
  pagination, modération et suspension sur chaque chemin public, commentaire masqué, images, réactions et
  notifications regroupées, commentaires à un niveau, partages, abonnements, audience (une fois par jour, auteur exclu,
  IP refusée par la base, plafond), export et effacement, purge à 30 jours.
- `packages/hub/test/post-page.test.ts` (6) : échappement, aucun script hors JSON-LD, pas d'impressions publiées,
  pseudonyme, sitemap, section entreprise, llms.txt, `marketplace-verify`.
- `apps/web/test/community.test.ts` : textes FR/EN identiques, codes d'erreur fermés, adresses de retour, liens des
  notifications, chaque action serveur relit la session et passe le limiteur avant d'écrire.

## Reste à faire / à savoir
- **Résumé e-mail des notifications de la communauté** : non fait (facultatif dans le lot) ; seules les notifications
  de l'application et poussées existent.
- Pas de petit composant client pour « J'aime » instantané : tout passe par des formulaires (rechargement de page).
- Pas de signalement d'une publication par les membres : la modération part de la liste des récents du back-office.
- Les images ne sont pas lues (pas d'OCR) : une image peut porter des coordonnées ; écrit sous le champ.
- Un freelance n'écrit qu'au nom de son profil, un membre d'entreprise qu'au nom de l'entreprise choisie dans ses
  réglages (pas de choix dans le composer).
- Fichiers partagés touchés (ajouts) : `schema.prisma`, `gdpr.ts`, `retention.ts`, `stored-files.ts`,
  `app-notifications.ts`, `back-office.ts` (avis), `public-visibility.ts`, `index.ts` (db et hub), `profile-page.ts`,
  `company-page.ts`, `llms-txt.ts`, `marketplace-verify.ts` (une ligne de sitemap), `AppShell.tsx`, dictionnaires
  `fr.ts` / `en.ts` / `live-*` / `operator-*`, `OperatorParts.tsx`, routes profil, entreprise, sitemap, llms.txt,
  `/fichiers`, `data/audience.ts` (deux `export`), `file-sniff.ts`, `image-processing.ts`, `notify/account-notice.ts`.
- Pas de navigateur ni de `next build` dans le worktree : à jouer en recette (publier, réagir, commenter, partager,
  masquer depuis le back-office, page publique et sitemap).
