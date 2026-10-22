# CONNECTED_PLAN : la refonte de l'espace connecté (Sensei, 2026-10-22)

> Base lue : `origin/sprint/design-legends-followup` au commit 0c16e8e (= `origin/main` 22c668b + un commit de
> documentation), dans le worktree existant `wt-8`, en lecture seule. Chemins relatifs à la racine du dépôt.
> Sources : `.war-room/brand/BRAND_BOOK.md`, `.war-room/design/CONCEPT.md`, `STORYBOARD.md`, `VERDICT.md`,
> `KENSA_REVIEW.md`, `TEAM_MEMORY.md`. Audit fait sur le code seulement : aucun écran connecté n'a été rendu (Clerk
> refuse l'aperçu, et la War Room ne se connecte jamais au compte du founder). Toute largeur donnée ici sans capture est
> un **calcul** sur les valeurs déclarées dans le CSS, dit comme tel.

---

## 0. Le constat en cinq lignes

1. L'espace connecté parle la marque (tokens `--ps-*`, polices, boutons papier sur encre) mais pas encore son histoire :
   aucun écran ne montre le **poinçon** tel que la page publique le frappe. Le seul vert est une étiquette plate
   `.tag-proof` (`apps/web/src/styles/base.css:45`), pas le cartouche `.seal` du hub (`packages/hub/src/profile-styles.ts:59-61`).
2. Les deux moments où un fait est réellement frappé (une entreprise confirme une mission, des fonds sont versés)
   finissent sur une phrase dans un cadre `form-ok` (`app/[lang]/app/confirmations/page.tsx:79-87`) ou, pire, sur le
   cartouche vide en pointillé qui veut dire « rien n'est frappé ici » (`app/[lang]/confirmer-mission/[id]/page.tsx:114-116`).
3. L'arbitrage 6 (rien de caché en attendant une animation) n'est pas appliqué : cinq révélations depuis une opacité
   nulle et un `CountUp` (Kensa m4, toujours ouvert), plus une animation en boucle.
4. Sur 375 px, le cadre lui-même est fragile : barre du haut sur une seule ligne et menu de 15 liens empilés avant le
   contenu (calculs au §1.2).
5. Le menu liste des fonctions (15 entrées côté freelance), pas les étapes d'un dossier.

---

## 1. Inventaire

### 1.1 Le cadre commun

| Élément | Fichier:ligne | État aujourd'hui | Écart avec la marque |
|---|---|---|---|
| Mise en page connectée | `apps/web/src/app/[lang]/app/layout.tsx:1,54-59` | `AppShell` autour de chaque page ; importe `market.css` | conforme |
| Feuilles chargées partout | `apps/web/src/app/[lang]/layout.tsx:5-6` | `landing.css` et `workspace.css` servies sur **toutes** les pages `[lang]`, publiques comprises | Kensa m3 : 25 Ko de styles d'espace connecté sur la vitrine. Plusieurs blocs de `workspace.css` (`.ws-shell`, `.ws-banner`, `.ws-side`, `.ws-main`, `.ws-id`, `.ws-field`, `.ci-*`, `.funnel*`, `.plan*`, `.checklist*`, `.verdict`, `.compare*`, `.models`, `.rules-list`, `.rings`) ne sont cités par aucun `className` littéral d'un `.tsx`, hors `components/landing/Simulator.tsx` et `app/[lang]/app/operateur/retours/page.tsx` : à confirmer avec un outil de couverture (classes composées possibles) |
| Barre du haut | `components/app/AppShell.tsx:47-64`, `styles/workspace.css:217-218` | lockup, rôle, « Notifications », langue, bouton Clerk, sur **une** ligne, sans retour | ce n'est pas l'en-tête de la marque (`packages/brand/src/chrome.ts:44-71`, deux lignes sur téléphone). Calcul à 375 px : lockup 125 px (`chrome.ts:93`) + étiquette de rôle environ 92 px + « Notifications » environ 104 px + langue environ 54 px + avatar environ 32 px + 4 espacements de 16 px, soit environ 470 px de contenu pour 343 px disponibles. Débordement probable, **non mesuré** |
| Menu de l'espace | `components/app/AppShell.tsx:27,37,39`, `components/workspace/WorkspaceNav.tsx:24-35`, `styles/workspace.css:20-24` | freelance 15 entrées, entreprise 14, opérateur 5, en liste plate ; sur téléphone `flex-wrap` de liens de 44 px | 15 liens d'au moins 44 px de haut avant le titre de chaque page : au moins 5 rangées, environ 240 px (estimation). Deux entrées « missions » côté freelance (« Candidatures » vers `/app/missions` et « Missions » vers la page publique, `AppShell.tsx:39`) ; « Factures » et « Facturation » côte à côte ; « Adresses prouvées » (`i18n/market/proofs-fr.ts:3`) nomme une page qui porte aussi les missions vérifiées (`app/[lang]/app/preuves/page.tsx:184`) |
| Titres de page | `styles/workspace.css:223` | `.app-head h1` en `--ps-step-5` (71,6 px à 1440) | l'échelle réserve `--ps-step-5` au titre d'accueil, `--ps-step-4` au titre de page (BRAND_BOOK §4). `.ws-main h1` en `--ps-step-4` (`workspace.css:27`) n'est plus utilisé |
| Champs | `styles/market.css:8-11`, `styles/workspace.css:127` | stylés : `text`, `number`, `date`, `email`, `search`, `select`, `textarea` | **non stylés** (rendu du navigateur, bord sans garantie de 3:1) : `type="url"` (`app/[lang]/app/preuves/page.tsx:174`, `equipe/page-publique/page.tsx:78`, `components/community/Composer.tsx:39`, `PostCard.tsx:96`, `profile/CredentialSections.tsx:37`, `profile/PortfolioSection.tsx:25`), `type="month"` (`market/VerifiedMissionsPanel.tsx:138,141`, `profile/ExperienceSection.tsx:39,43`), et les champs sans attribut `type` (`market/VerifiedMissionsPanel.tsx:117,120,132`) que `input[type="text"]` ne vise pas |
| Étiquettes d'état | `styles/base.css:42-48`, `components/market/StatusTag.tsx:1-21` | mono 12 px, `white-space: nowrap`, ton par mot | conforme pour les statuts. Mais une ligne vérifiée longue ne passe pas à 375 : calcul pour « Payée sur Proofseen, vérifiée le 12 octobre 2026 » (49 caractères à 7,2 px) : environ 372 px pour environ 309 px utiles dans un `.panel` ; « Confirmée par le client le 12 octobre 2026 » : environ 322 px. Débordement probable, **non mesuré** |
| Le vert | `styles/base.css:45`, `apps/web/test/brand-layer.test.ts:95-122` | `.tag-proof` seul, sur 4 fichiers | bon usage (faits vérifiés seulement), mauvaise forme : pas de coins de poinçon, pas de ligne de preuve, pas de date en mono à part |
| Révélations depuis une opacité nulle | `styles/workspace.css:156-157` (intervalles), `:173` (anneaux), `:203-204` (parcours du dossier), `:237` (tuiles), `:276-277` (chaque bulle de message, à chaque chargement) | contenu rendu par le serveur, mis à 0 par `InView` à l'hydratation (`components/motion/InView.tsx:23`), puis réaffiché | contraire à l'arbitrage 6 et à BRAND_BOOK §7 ; clignotement probable des blocs déjà dans l'écran au chargement |
| Compteur qui roule | `app/[lang]/app/page.tsx:49`, `components/motion/CountUp.tsx:28` | le total des dossiers de l'opérateur part de 0 | refusé par CONCEPT §5 |
| Animation en boucle | `styles/workspace.css:201-202` | l'étape active du dossier « respire » toutes les 2,4 s, sans fin | « Rien ne flotte » (BRAND_BOOK §7) ; une boucle n'est pas un geste de la marque |
| Squelettes | `styles/states.css:67-74` | barres qui respirent en boucle pendant le chargement, coupées en mouvement réduit | admissible (état d'attente réel), à garder court |
| États vides | `components/EmptyState.tsx`, `apps/web/test/states.test.ts:202-210` | cartouche vide en pointillé, testé sur 7 pages | restent des phrases nues hors du test : `preuves/page.tsx:157`, `VerifiedMissionsPanel.tsx:32,64`, `confirmations/page.tsx:89`, `ProfilesForMission.tsx:105`, `QuotesSection.tsx:37`, `operator/VerificationQueues.tsx:24,67` |
| Widgets tiers | `components/auth/AuthProvider.tsx:12-27`, `components/market/EscrowPayment.tsx:80` | Clerk toujours en palette sombre ; Stripe Elements en thème clair `"stripe"` | thème clair : Clerk reste sombre. Thème sombre (défaut) : le formulaire de paiement est un rectangle blanc au milieu de l'encre |
| Sens des styles | `EscrowPayment.tsx:114`, `facturation/page.tsx:64`, `styles/insights.css:26,44` | la note « Mode test » prend le cadre de succès `form-ok` ; `.insight-note` a un filet latéral de 3 px alors que la règle du lot dit « no side stripe » (`workspace.css:39`) ; `.btn-danger` en ambre `--ps-signal` alors que `--ps-danger` existe | trois écarts de sens, petits |
| Formes | `styles/profile.css:5`, `styles/discovery.css:113,122,130` | photo du profil en cercle ; carte entreprise qui coche ses faits d'un « ✓ » | STORYBOARD d.1 : photo au rayon de 4 px ; c.3 : le carré de 8 px remplace le « ✓ » |
| Nom en double | `styles/workspace.css:186`, `packages/hub/src/profile-styles.ts:10` | `.dossier` = parcours d'audit côté React, et grille de la fiche côté hub | risque de collision le jour où le registre du hub passe dans une feuille partagée |

### 1.2 Écrans, par rôle

Légende des colonnes : **R** = rôle (F freelance, E entreprise, O opérateur, L lien signé sans compte).

| Route (`/[lang]/app/...` sauf mention) | R | Ce qu'on y fait | Feuilles, composants | État visuel et écarts (fichier:ligne) | Lot |
|---|---|---|---|---|---|
| `/` accueil freelance | F | publier, reconfirmer sa disponibilité, voir candidatures, audience, citations, argent, parcours d'audit | `page.tsx:155-200`, `insights/FreelanceHomeBoard.tsx:41-80`, `StageBlock`, `AvailabilityCheck`, `MissionCounts`, `AudienceSection`, `AiCitations`, `FreelanceMoney`, `MissionsForYou`, `workspace/DossierPath.tsx` ; `insights.css`, `visibility.css` | neuf blocs de même poids, l'un sous l'autre ; **aucun** ne dit ce qui est vérifié sur la page publique ; parcours d'audit masqué puis révélé (`workspace.css:203`) et boucle (`:201`) | 2 |
| `/` accueil entreprise | E | créer l'entreprise, chiffres de recrutement, dépenses, activité d'équipe, recherche | `page.tsx:245-282`, `insights/CompanyHomeBoard.tsx:64-109`, `CompanySpend` | aucune liste de ce qui attend l'entreprise (confirmations, contrats à signer, paiements, candidatures non lues) ; le formulaire de recherche est en bas (`page.tsx:265`) | 3 |
| `/` accueil opérateur | O | dossiers d'audit, jauge, livraisons | `page.tsx:36-141` | `CountUp` (`:49`), tuiles révélées (`workspace.css:237`) | 6 |
| `/bienvenue` | F E | choisir son rôle | `bienvenue/page.tsx:37-48`, `workspace.css:247-253` | conforme à la charte ; la phrase freelance raconte l'ancien positionnement (« savoir si les IA me trouvent », `i18n/fr.ts:352`) | 1 (copie au founder) |
| `/profil` | F | éditer, publier, sections riches, CV | `profil/page.tsx:178-199`, `profile/*`, `SectionShell` ; `profile.css` | rien ne dit « déclaré par vous » ; photo ronde (`profile.css:5`) ; champs `url` et `month` non stylés (§1.1) | 2 |
| `/visibilite` | F | mesure par moteur, évolution, demande de mesure | `visibilite/page.tsx:139-158`, `visibility/*` ; `visibility.css` | « cité » en ambre (`visibility.css:15`), couleur qui veut dire « à corriger » (BRAND_BOOK §5) ; aucune figure de registre alors que c'est le moment signature de la marque (BRAND_BOOK §8.3) | 2 |
| `/preuves` | F | adresses prouvées, missions vérifiées, demandes de confirmation | `preuves/page.tsx:136-186`, `market/VerifiedMissionsPanel.tsx`, `ProofWays` ; `market.css:49-58` | page la plus proche de la marque, mais : missions vérifiées en dernier (`:184`), étiquette plate au lieu du cartouche (`:67`, `VerifiedMissionsPanel.tsx:39,73`), titre « Adresses prouvées », champs non stylés, débordement calculé des lignes vérifiées | 2 |
| `/missions`, `/missions/pour-vous`, `/missions/enregistrees`, `/missions/[id]/postuler` | F | candidatures, missions proposées avec raisons, enregistrées, postuler | `missions/page.tsx:89`, `pour-vous/page.tsx:85`, `MatchReasons` | non lu en détail ; ordre des missions expliqué (`i18n/market/matching-fr.ts:44`) | 5 |
| `/entreprises`, `/entreprises-suivies` | F E | annuaire des entreprises, suivre | `entreprises/page.tsx:137-169,209-263` ; `discovery.css` | faits cochés « ✓ » en encre (`discovery.css:113`) alors que le hub met un carré vert au fait « entreprise active au répertoire » ; point rond de l'étiquette (`:122`) | 5 |
| `/recherche`, `/recherche/enregistree/[id]` | E | chercher par filtres, enregistrer une recherche | `recherche/page.tsx:212-253`, `search/*` ; `discovery.css`, `@proofseen/brand/profile-card.css` | carte du hub partagée (bien) ; cibles sous 44 px : cases 36 px (`discovery.css:38`), liens de filtre 32 px (`:43`), actions de recherche enregistrée 36 px (`:60`), puces actives 36 px (`:69`), tri 40 px (`:67`), actions de carte 40 px (`:115`) | 5 |
| `/listes`, `/listes/[id]` | E | listes de freelances, notes, pouces | `listes/[id]/page.tsx:57-94`, `market/FreelancerCard.tsx` | **seconde carte de freelance**, différente de la carte unique (`FreelancerCard.tsx:62-114`) | 5 |
| `/missions` (entreprise), `/missions/nouvelle`, `/missions/[id]`, `/missions/[id]/modifier`, `/missions/[id]/candidatures/[applicationId]` | E | publier, recevoir, trier par statut, retenir, choisir, profils proches | `missions/[id]/page.tsx:56-163`, `ApplicantsBoard.tsx`, `ProfilesForMission.tsx`, `MissionForm` ; `market.css:66-70` | colonnes de statut lisibles sans JS (bien) ; faits du candidat en une ligne grise (`ApplicantsBoard.tsx:33-36`) ; profils proches **ordonnés par nombre de critères remplis** (`matching-fr.ts:63`), permis par la décision du 2026-10-18 tant que l'ordre est écrit et expliqué (`TEAM_MEMORY.md:679`) : la refonte ne doit jamais le transformer en pourcentage, en barre ou en rang | 5 |
| `/confirmations` | E | confirmer ou refuser une mission déclarée chez elle | `confirmations/page.tsx:36-98`, `ConfirmationDecisionForm.tsx` | **le moment de la frappe** se termine sur une phrase `form-ok` (`:79-87`) ; vide en phrase nue (`:89`) | 3 |
| `/messages`, `/messages/[id]` | F E | échanger, accepter le contact, pièces jointes, devis | `messages/[id]/page.tsx:95-194`, `live/ThreadMessages`, `QuotesSection.tsx` ; `workspace.css:256-278`, `market.css:20-22,72-86` | chaque bulle part d'une opacité nulle (`workspace.css:276-277`) ; le **devis**, étape commerciale, est en bas du fil après le formulaire de réponse (`:190-192`) ; lien « ↑ » (`:114`) | 4 |
| `/contrats`, `/contrats/[id]` | F E | signer, payer sous séquestre, valider, avis, factures | `contrats/[id]/page.tsx:142-260`, `EscrowPayment.tsx`, `PaymentReturn`, `InvoiceList` | les étapes (signatures, paiement, validations, versement) sont des panneaux séparés sans fil commun ni dates de paiement ; formulaire Stripe en thème clair (`EscrowPayment.tsx:80`) ; « Mode test » en cadre de succès (`:114`) | 4 |
| `/factures`, `/facturation` | F E | factures émises ; identité de facturation, compte de versement, attestation URSSAF | `factures/page.tsx`, `facturation/page.tsx:40-187`, `BillingForm`, `PayoutAccountButton` | « entreprise active, contrôlée le » et « attestation vérifiée » en gris (`facturation/page.tsx:41-44,97`) alors que ce sont des faits vérifiés, verts sur la page publique | 4 |
| `/equipe`, `/equipe/page-publique` | E | membres, règle de validation, vivier, clés d'API, page publique | `equipe/page.tsx:215`, `market.css:43-47` | non lu en détail ; lien « ← » (`page-publique/page.tsx:38`) | 6 |
| `/invitations`, `/invitations/[id]` | F E (L) | inviter, répondre | `invitations/*`, `market/Invitations.tsx`, `MyInvitations.tsx` | non lu en détail | 6 |
| `/fil`, `/fil/[id]`, `/abonnements` | F E | publications, réactions, suivis | `fil/*`, `community/*` ; `community.css` | sobre, conforme ; lien réduit à « → » (`community/Composer.tsx:20`) : nom accessible « → » | 6 |
| `/notifications`, `/alertes`, `/reglages`, `/contact/[reference]`, `/suspendu` | F E | centre de notifications, préférences, compte Clerk, export, effacement | `reglages/page.tsx:100-120` (Clerk `UserProfile`), `settings/EraseAccount.tsx:59` ; `insights.css:39-46` | bouton d'effacement en ambre (`insights.css:44`) | 6 |
| `/operateur` et `/operateur/{communaute, contacts, entonnoir, journal, mesures, moderation, retours, utilisateurs, utilisateurs/[id], verifications}`, `/articles`, `/articles/nouveau`, `/articles/[id]` | O | back-office, files de vérification URSSAF et litiges d'adresses, modération, blog | `operateur/layout.tsx:21-31`, `operator/*` ; `operator.css` | dense et sans décor (bien) ; liens du menu sans hauteur minimale (`operator.css:4`) ; vides en phrase nue (`VerificationQueues.tsx:24,67`) ; la vérification d'une attestation (`VerificationQueues.tsx:38-48`) est une vraie frappe par un tiers, sans retour visuel | 6 |
| `/[lang]/confirmer-mission/[id]` | L | le contact chez le client confirme sans compte | `confirmer-mission/[id]/page.tsx:34-121` ; `market.css` | l'état « confirmée » est lu dans l'adresse (`:103`, `fait=confirmee`) : une adresse fabriquée affiche le remerciement ; il est rendu avec le cartouche vide « rien n'est frappé » (`:114-116`) ; après décision, la base ne dit que `decided`, sans confirmée ou refusée (`packages/db/src/mission-confirmations.ts:95`) | 3 |
| `/[lang]/espace/[reference]` | L | espace d'audit du client par lien | `espace/[reference]/page.tsx:40,81`, `DossierPath` | même parcours que l'accueil, mêmes révélations | 1 (mouvement) |
| `/[lang]/connexion`, `/[lang]/creer-un-compte` | tous | Clerk | `AuthProvider.tsx:12-27` | palette sombre seulement | 6 |

---

## 2. Le fil de l'histoire : le bureau de garantie, côté guichet

La vitrine raconte le bureau vu de la rue. L'espace connecté est **le guichet et l'arrière-boutique** : on y dépose une
déclaration, on attend l'essai, et parfois le poinçon tombe. Un outil qu'on ouvre vingt fois par jour ne joue pas de
spectacle (c'est déjà la règle du menu, `WorkspaceNav.tsx:19`) : **la seule frappe est celle d'un événement réel**,
une fois, et tout le reste est immobile, typographié comme un registre.

Trois états, et seulement trois, partout :

| État | Forme | Couleur | Exemples |
|---|---|---|---|
| **Déclaré** | carré de 8 px au filet, texte en encre | aucune | compétences, missions déclarées, disponibilité, TJM |
| **À l'essai** | le mot de l'état, son échéance en mono | ambre `--ps-signal` + mot | demande de confirmation en attente jusqu'au…, contrat à signer, fonds sous séquestre |
| **Poinçonné** | cartouche `.seal` (coins de poinçon), date et source en mono | vert `--ps-proof` | mission confirmée par le client le…, payée sur Proofseen le…, adresse prouvée le…, SIRET actif contrôlé le…, attestation URSSAF vérifiée le… |

Aucun score, aucun classement de personnes : on compte des faits, on ne note pas des gens ; l'ordre de toute liste est
écrit à l'écran.

### 2.1 Côté freelance

| Étape | Écran | Ce que voit la personne | Sans JS | Mouvement réduit | 375 px, au doigt |
|---|---|---|---|---|---|
| **Déclarer** | `/profil` | un en-tête mono « Déclaré par vous », rien de vert ; un lien « Voir ma page publique » | formulaire serveur complet | identique | une colonne, champs à 16 px, actions pleine largeur 48 px |
| **Faire confirmer** | `/preuves` | en tête « Sur votre page publique » : les missions et adresses poinçonnées ; puis « À l'essai » : chaque demande avec son échéance (« En attente de réponse jusqu'au 21 novembre 2026 ») ; puis le formulaire de demande ; puis les adresses à prouver | tout est HTML serveur | identique | le cartouche passe à la ligne sous le rôle, texte autorisé à revenir à la ligne |
| **Être payé** | `/contrats/[id]` | le fil de l'affaire (§2.3) ; au versement, la dernière ligne devient un cartouche « Mission vérifiée : payée sur Proofseen le… » | fil complet | identique | fil vertical à gauche, une étape par ligne |
| **Être cité** | `/visibilite` | le registre de ses propres réponses d'IA, une case par réponse, comme la figure d'ouverture de la vitrine ; les cases où il est cité s'encrent (BRAND_BOOK §8.3) ; toujours « n sur N, vague du… » ; à zéro, rien ne s'allume et la ligne le dit | figure SVG serveur, tableau dans un `<details>` | figure immobile | colonnes de cases de 4 px, tableau replié |

**Accueil freelance = le dossier.** Dans l'ordre : (1) la référence et le lien vers la page publique ; (2) « Ce qui est
poinçonné sur votre page publique », exactement le résumé du rail du profil public (STORYBOARD d.1 : « 2 missions
vérifiées · 1 adresse prouvée · 3 faits vérifiés », ou « Aucun fait vérifié pour l'instant ») ; (3) « Ce qui attend
quelqu'un » : étapes de publication (`StageBlock`), demandes en attente, disponibilité à reconfirmer ; (4) missions
proposées ; (5) les chiffres (audience, argent, citations), plus bas et plus calmes. Le parcours d'audit reste, immobile.

**Accès unique de la section phare.** La section phare de l'espace freelance est le registre (`/preuves`). Sa porte est le
résumé de l'accueil : le cartouche de l'accueil est le lien, et la page des preuves s'ouvre sous le même cartouche, en
tête. Transition de vue entre les deux si le routeur la permet sans dépendance expérimentale (à trancher par Kaze et Tetsu,
`experimental.viewTransition` de Next n'est pas une base) ; sinon navigation simple, rien ne manque. Désactivée en
mouvement réduit. Aucune autre transition dans l'espace.

### 2.2 Côté entreprise

| Étape | Écran | Ce que voit la personne |
|---|---|---|
| **Chercher** | `/recherche` | des filtres et des faits, la carte unique du hub, la clé de lecture « vert vérifié, filet déclaré » ; l'ordre écrit |
| **Choisir** | `/missions/[id]`, `/candidatures/[id]` | chaque candidat avec ses faits en lignes de registre (poinçonné, déclaré) ; profils proches avec leur raison écrite, ordre écrit, aucun pourcentage |
| **Contracter** | `/messages/[id]`, `/contrats/[id]` | le fil de l'affaire en tête de l'échange : le devis n'est plus enterré sous le formulaire de réponse |
| **Payer sous séquestre** | `/contrats/[id]` | « Fonds bloqués sous séquestre depuis le… » en ambre et en mots : c'est un état à l'essai, pas une preuve ; le formulaire Stripe aux couleurs de la page |
| **Confirmer** | `/confirmations`, `/confirmer-mission/[id]`, `/contrats/[id]` | confirmer une mission passée, ou valider la prestation qui déclenche le versement : c'est l'entreprise qui frappe, et l'écran le lui montre |

**Accueil entreprise = « À traiter ».** En tête : confirmations en attente (avec échéance), contrats à signer, contrats
à payer, candidatures non lues, chacun avec son compte et son lien ; la recherche juste dessous ; les chiffres de
recrutement et de dépense ensuite.

### 2.3 Le fil de l'affaire (messages et contrat)

Un seul composant serveur, une ligne par étape, chacune avec sa date quand la base la connaît, sinon sans date (jamais
inventée) : Échange accepté · Devis accepté · Contrat signé par les deux parties · Payé sous séquestre · Prestation
validée (n validations sur N) · Versé au freelance · **Mission vérifiée : payée sur Proofseen**. Les étapes faites en
encre, l'étape en cours en ambre avec qui doit agir, les suivantes au filet. La dernière seule est un cartouche vert, et
seulement si la mission vérifiée existe en base (`packages/db/src/verified-missions.ts:12,109`).

### 2.4 Où le poinçon se frappe pour de vrai

Règle : **la frappe se lit en base, jamais dans l'adresse.** Un paramètre de redirection peut dire « montre l'accusé de
réception », il ne peut jamais dire « c'est vérifié ».

| Événement réel | Qui frappe | Écran de l'accusé | Source en base | Geste |
|---|---|---|---|---|
| Une entreprise confirme une mission | ses administrateurs | `/app/confirmations?fait=confirmee&demande=<id>` | la demande relue dans le périmètre de l'acteur (comme `listForCompany`), état `confirmed`, `decidedAt` | cartouche « Confirmée par le client le 22 octobre 2026 » et « Elle paraît maintenant sur la page publique de FR-XXXXX » ; frappe une fois (140 + 120 ms), anneau d'encre (240 ms) |
| Le contact du client confirme par lien | le contact, sans compte | `/[lang]/confirmer-mission/[id]` | **à ajouter** : `lookupByToken` doit rendre la décision et sa date (aujourd'hui `decided` seul, `mission-confirmations.ts:95`) | même cartouche ; plus jamais l'état vide en pointillé pour un succès |
| Les fonds sont versés | l'entreprise qui valide, puis Stripe | `/app/contrats/[id]` des deux côtés | paiement `released` et mission `paid_on_platform` | la dernière ligne du fil devient cartouche |
| Une adresse est prouvée | la relecture automatique | `/app/preuves?prouve=…` | `verifiedAt` de l'adresse | cartouche « Prouvée le… · fichier de vérification » |
| Une attestation URSSAF est vérifiée | l'opérateur | `/app/operateur/verifications`, puis `/app/facturation` du freelance | statut de vigilance vérifié | accusé côté opérateur ; ligne poinçonnée côté freelance |

Côté freelance, l'accusé arrive plus tard (notification, puis `/preuves`). La frappe y joue **une fois par appareil** pour
un fait poinçonné depuis la dernière visite : un petit îlot client garde dans `localStorage` les identifiants déjà vus
(aucune donnée personnelle, aucun appel réseau), plafonné à 3 frappes par page, décalées de 80 ms. Sans JS : le cartouche
est posé. Mouvement réduit : posé. Une page qui frappe à chaque chargement ne frappe plus rien.

### 2.5 Menu en sections de base

| Rôle | Sections (dans cet ordre) | Sous-pages en onglets dans la section |
|---|---|---|
| Freelance | Accueil · Profil · Preuves · Visibilité IA · Missions · Messages · Contrats · Argent · Réseau · Compte | Missions : candidatures, pour vous, enregistrées ; Argent : factures, facturation et versement ; Réseau : fil, entreprises, invitations, abonnements ; Compte : alertes, réglages |
| Entreprise | Accueil · Recherche · Missions · Confirmations · Messages · Contrats · Argent · Équipe · Réseau · Compte | Recherche : recherche, listes ; Argent : factures, facturation |
| Opérateur | Accueil · Back-office · Messages · Articles · Annuaire | le menu du back-office existant |

Aucun nom de profil, d'entreprise ou de mission dans le menu. Sur 375 px : une ligne qui défile, comme le menu public
(`packages/brand/src/chrome.ts:54-62`, fondu à droite qui dit « il y en a d'autres »), sans script ni bascule. Les
compteurs de non-lus restent sur Messages. Ce que le menu montre reste exactement ce que le serveur laisse ouvrir
(`AppShell.tsx:21`). Les libellés passent par les dictionnaires (« Preuves » à la place de « Adresses prouvées » : à
valider par le Shogun).

### 2.6 Rythme

Pas deux effets lourds à la fois, et dans l'espace connecté il n'y en a que deux possibles : la frappe d'un accusé, et
le registre de la visibilité IA (sa règle de lecture descend une fois, comme sur la vitrine). Ils ne sont jamais sur le
même écran. Tout le reste est immobile : retours d'état de 90 et 160 ms seulement.

---

## 3. Les lots

Ordre de valeur pour l'utilisateur. **Le lot 1 passe d'abord** (il livre les primitives communes) ; les lots 2 à 6 partent
ensuite de `main`, chacun sur sa branche, et peuvent avancer en parallèle. Pour rester indépendants, seul le lot 1 touche
`workspace.css`, `market.css` et `base.css` ; chaque autre lot écrit ses styles dans sa propre feuille
(`apps/web/src/styles/app-<lot>.css`), importée par ses seules pages.

### Définition de fini, commune à chaque lot

- **375 px** : `scrollWidth = 375` sur chaque écran du lot, tous les `<details>` ouverts, avec les plus longues chaînes
  réelles (dates longues, raisons sociales, adresses) ; cibles d'au moins 44 x 44 px.
- **Clavier** : ordre de tabulation = ordre de lecture ; anneau `--ps-focus` de 2 px partout ; lien d'évitement vers
  `#contenu` ; aucune action atteignable à la souris seulement ; formulaire Stripe atteignable.
- **AA** dans les deux thèmes : texte 4,5:1, bords de contrôles 3:1 (`--ps-line-strong`) ; aucun état dit par la seule
  couleur.
- **Mouvement réduit** : état final, frappe, encre et trace à 0 ms, aucune boucle.
- **Rien de caché** : aucun état de départ à `opacity: 0`, `scaleX(0)`, `scaleY(0)` ou `stroke-dashoffset` plein dans les
  feuilles de l'espace (le contrôle de `apps/web/test/home-page.test.ts:94` étendu à toutes les feuilles) ; l'état final
  est dans le HTML du serveur ; aucun compteur qui roule.
- **Sans JS** : tous les formulaires marchent (actions serveur) ; seuls le paiement Stripe et les compteurs en direct
  demandent JS, et la page le dit dans une ligne `<noscript>`.
- **Vert** : seulement sur un fait poinçonné ; la liste blanche de `brand-layer.test.ts:95-122` mise à jour et étendue aux
  feuilles de `@proofseen/brand`.
- **Vérité** : chaque date et chaque compte viennent de la base ; aucun vocabulaire de pièce ou de document
  (`apps/web/test/truth-vocabulary.test.ts:9`) ; zéro U+2014 (`brand-layer.test.ts:140-150`) ; espace fine insécable
  avant « : ; ? ! » dans les dictionnaires français (Kensa N6).
- **Coût** : pas de nouveau JavaScript client hors l'îlot de frappe (cible sous 1 Ko) ; les styles d'un lot ne sont
  chargés que par ses pages.
- **Gate** vert, commits au nom du founder, captures 1440 et 375, sombre et clair, prises par le founder (§4).

### Lot 1. Le socle de l'espace (toutes les pages, tous les rôles)

- **Écrans** : le cadre (`AppShell`, menu), `/bienvenue`, le parcours d'audit (`/`, `/[lang]/espace/[reference]`), les
  états.
- **Fichiers** : `components/app/AppShell.tsx`, `components/workspace/WorkspaceNav.tsx` (sections et onglets),
  `styles/workspace.css` (barre du haut en deux lignes, titres en `--ps-step-4`, retrait des révélations `:156-157`,
  `:173`, `:203-204`, `:237`, `:276-277` et de la boucle `:201-202`, purge des blocs morts après mesure de couverture),
  `styles/market.css` (une règle pour tous les champs de texte : `input:not([type])`, `url`, `month`, `tel`), `styles/base.css`
  (`.tag` peut revenir à la ligne), `app/[lang]/layout.tsx:6` (`workspace.css` quitte les pages publiques pour
  `app/[lang]/app/layout.tsx`, `espace` et `confirmer-mission`), `app/[lang]/app/page.tsx:3,49` et
  `components/motion/CountUp.tsx` (retrait), `components/workspace/DossierPath.tsx` (plus d'`InView`).
  **Primitive partagée** : `packages/brand/src/seal.ts` (nouveau) génère `seal.css` (`.seal`, `.sq`, `.proofline`,
  `.trace`, `.stamp`, frappe et encre) à partir des règles de `packages/hub/src/profile-styles.ts:44-96`, que le hub
  continue d'émettre à l'identique ; plus un composant React `components/proof/Seal.tsx` (texte, date en `<time>`, source).
- **Risques** : tests de balisage du hub qui cherchent les chaînes exactes du cartouche
  (`packages/hub/test/profile-proof-register.test.ts:82,137`) ; `brand-layer.test.ts:95-122` (liste blanche du vert, ne
  lit que `apps/web/src/styles` : à étendre au paquet de marque, sinon la garde s'éteint en silence) ;
  `states.test.ts:202-216` ; `pwa.test.ts:124` (lit la mise en page connectée) ; `profile-card-parity.test.ts` ; collision
  `.dossier` (§1.1). Sécurité : le menu ne doit montrer aucune section qu'un rôle ne peut ouvrir. Données : aucune.
- **Fini quand** : définition commune, plus le menu tient sur une ligne qui défile à 375 px, la barre du haut sur deux
  lignes sans débordement, et `workspace.css` n'est plus servie sur `/fr`.

### Lot 2. Le registre du freelance (déclarer, faire confirmer, être cité)

- **Écrans** : `/` (accueil freelance), `/preuves`, `/profil`, `/visibilite`.
- **Fichiers** : `app/[lang]/app/page.tsx` (`FreelanceHome`), `components/insights/FreelanceHomeBoard.tsx`,
  `app/[lang]/app/preuves/page.tsx`, `components/market/VerifiedMissionsPanel.tsx`, `ProofWays.tsx`,
  `app/[lang]/app/profil/page.tsx`, `components/visibility/*`, `app/[lang]/app/visibilite/page.tsx`,
  `components/proof/StrikeOnce.tsx` (îlot client), `i18n/market/{proofs,confirmations,visibility,profile}-{fr,en}.ts`,
  `styles/app-registre.css`.
- **Risques** : `brand-layer.test.ts:111-122` (fichiers autorisés à porter le vert) ; `first-steps.test.ts`,
  `profile-checklist.test.ts`, `visibility-view.test.ts`, `visibility-dictionary.test.ts`, `pseudonymous-copy.test.ts`.
  Données : le résumé de l'accueil ajoute des lectures (missions vérifiées, adresses, vigilance) : réutiliser les
  fonctions existantes, mesurer le temps serveur. **À vérifier** : la base expose-t-elle chaque réponse d'une mesure
  (moteur, offre, citée ou non) pour dessiner le registre du freelance ? Sinon, barres comptées avec n et date, sans
  figure. Le vert sur les cases citées suit BRAND_BOOK §8.3 et contredit en apparence CONCEPT §1 : **à confirmer par le
  Shogun** avant de coder. Sécurité : `localStorage` ne garde que des identifiants opaques déjà vus.
- **Fini quand** : définition commune, plus l'accueil dit en premier ce qui est poinçonné sur la page publique, avec les
  mêmes comptes que le rail public ; les lignes vérifiées ne débordent plus à 375 px (recalcul et capture).

### Lot 3. Confirmer : la frappe vraie (entreprise et contact du client)

- **Écrans** : `/confirmations`, `/[lang]/confirmer-mission/[id]`, `/` (accueil entreprise, bloc « À traiter »).
- **Fichiers** : `app/[lang]/app/confirmations/page.tsx` et `actions.ts` (redirection avec l'identifiant de la demande),
  `app/[lang]/confirmer-mission/[id]/page.tsx` et `actions.ts`, `components/market/ConfirmationDecisionForm.tsx`,
  `packages/db/src/mission-confirmations.ts` (lecture de la décision par jeton, et d'une demande décidée dans le
  périmètre de l'acteur), `app/[lang]/app/page.tsx` (`CompanyHome`), `components/insights/CompanyHomeBoard.tsx`,
  `styles/app-confirmer.css`.
- **Risques** : **sécurité** d'abord. `?demande=<id>` ne doit rien révéler hors des organisations que la personne
  administre (même réponse qu'une demande inexistante) ; le lien signé ne doit montrer confirmée ou refusée qu'à qui
  détient le jeton ; l'état ne se lit plus dans `fait=` (`confirmer-mission/[id]/page.tsx:103`). Tests :
  `apps/web/test/mission-confirmation.test.ts`, tests de `packages/db` sur les confirmations, `states.test.ts`. Données :
  pas de migration si `decidedAt` et la décision sont déjà sur la ligne (`MyConfirmationRequest` porte `decidedAt`,
  `VerifiedMissionsPanel.tsx:55`) : à confirmer dans le schéma.
- **Fini quand** : définition commune, plus une adresse fabriquée ne montre jamais un cartouche vert ; la frappe ne joue
  que sur une décision lue en base ; l'accueil entreprise liste ce qui l'attend, avec des comptes réels.

### Lot 4. L'affaire et l'argent (contracter, payer sous séquestre, être payé)

- **Écrans** : `/messages/[id]` (devis), `/contrats`, `/contrats/[id]`, `/factures`, `/facturation`.
- **Fichiers** : `components/market/DealThread.tsx` (nouveau, le fil de l'affaire du §2.3), `app/[lang]/app/messages/[id]/page.tsx`,
  `components/market/QuotesSection.tsx`, `app/[lang]/app/contrats/page.tsx`, `app/[lang]/app/contrats/[id]/page.tsx`,
  `components/market/EscrowPayment.tsx` (`appearance.variables` tirées de `PALETTE` de `@proofseen/brand`, thème choisi
  au montage selon `prefers-color-scheme`), `PaymentReturn.tsx`, `PayoutAccountButton.tsx`, `InvoiceList.tsx`,
  `app/[lang]/app/facturation/page.tsx` (SIRET actif et URSSAF vérifiée en lignes poinçonnées, datées),
  `i18n/market/{deals,billing}-{fr,en}.ts`, `styles/app-affaire.css`.
- **Risques** : paiement. `apps/web/test/pay-ui.test.ts:141-160` (aucun secret ni module serveur de paiement dans un
  composant client : `PALETTE` est public, à garder hors de `@/data/payments-config`) ; `payment.test.ts`. L'état du
  paiement continue de venir de la route `GET`, jamais de la redirection (`PaymentReturn.tsx:27`). **À vérifier** : la
  base expose-t-elle les dates de mise sous séquestre et de versement ? Sinon, l'étape s'affiche sans date. Le versement
  et la mission « payée sur Proofseen » ne sont pas jouables en mode test aujourd'hui (`TEAM_MEMORY.md:689`) : ils ne se
  prouvent que par des rendus serveur sur données de test, puis au GO PAIEMENT LIVE.
- **Fini quand** : définition commune, plus le formulaire Stripe a les couleurs de la page dans les deux thèmes ; le
  devis est atteignable depuis le haut de l'échange ; le fil de l'affaire dit la même chose sur le contrat et dans
  l'échange.

### Lot 5. Chercher et choisir (entreprise) ; trouver (freelance)

- **Écrans** : `/recherche`, `/recherche/enregistree/[id]`, `/listes`, `/listes/[id]`, `/missions` (les deux rôles),
  `/missions/nouvelle`, `/missions/[id]`, `/missions/[id]/modifier`, `/missions/[id]/candidatures/[applicationId]`,
  `/missions/pour-vous`, `/missions/enregistrees`, `/missions/[id]/postuler`, `/entreprises`, `/entreprises-suivies`.
- **Fichiers** : `components/market/FreelancerCard.tsx` (remplacée par le corps de carte du hub, comme
  `components/search/ProfileResultCard.tsx:20-27`), `app/[lang]/app/listes/[id]/page.tsx`, `lib/profile-card-view.ts`,
  `components/market/ApplicantsBoard.tsx`, `ProfilesForMission.tsx`, `MatchReasons.tsx`, `MissionForm.tsx`,
  `app/[lang]/app/entreprises/page.tsx` (carré et date au lieu du « ✓ »), `styles/discovery.css` (cibles de 44 px :
  `:38,43,60,67,69,115`), `styles/app-choisir.css`.
- **Risques** : AI Act. Aucun nouveau tri ; l'ordre des profils proches reste celui décidé et écrit (`matching-fr.ts:63`,
  `TEAM_MEMORY.md:679`), jamais en pourcentage, barre ou rang. Tests : `profile-card-parity.test.ts`,
  `advanced-search.test.ts`, `freelancer-search.test.ts`, `matching.test.ts`, `directory-filters.test.ts`,
  `states.test.ts:202-209` (liste de pages), `brand-layer.test.ts:116-121` (`FreelancerCard.tsx` sort de la liste).
  Données : **à vérifier** que les lignes de liste ont tous les champs de la carte du hub (date de mise à jour,
  disponibilité confirmée, langues).
- **Fini quand** : définition commune, plus une seule carte de freelance dans toute l'application, et aucune cible de
  filtre sous 44 px.

### Lot 6. Le reste à la marque : réseau, compte, opérateur

- **Écrans** : `/fil`, `/fil/[id]`, `/abonnements`, `/invitations`, `/invitations/[id]`, `/notifications`, `/alertes`,
  `/reglages`, `/equipe`, `/equipe/page-publique`, `/contact/[reference]`, `/suspendu`, `/[lang]/connexion`,
  `/[lang]/creer-un-compte`, l'accueil opérateur, `/operateur/*`, `/articles/*`.
- **Fichiers** : `components/community/Composer.tsx:20` (lien nommé), `components/settings/EraseAccount.tsx` et
  `styles/insights.css:44-46` (`--ps-danger`), `components/auth/AuthProvider.tsx` (thème clair de Clerk, voir §4),
  `app/[lang]/app/page.tsx` (`OperatorHome` sans tuiles révélées), `components/operator/VerificationQueues.tsx` (accusé
  poinçonné après vérification d'une attestation), `styles/operator.css:4` (liens de 44 px), `styles/app-compte.css`.
- **Risques** : `operator-access.test.ts` (la mise en page vérifie le rôle avant de dessiner), `community.test.ts`,
  `invitations.test.ts`, `settings.test.ts`, `suspension.test.ts`. Sécurité : le back-office reste 404 pour un
  non-opérateur ; les exports ne bougent pas.
- **Fini quand** : définition commune sur chaque écran listé.

---

## 4. Ce qui demande le founder, et ce qui se fait sans lui

### Le founder

| Besoin | Pourquoi lui |
|---|---|
| Jouer chaque lot avec ses comptes : son freelance et l'entreprise « Proofseen Test Client » (`TEAM_MEMORY.md:689`) ; les anciens comptes `+clerk_test` n'existent pas en production (`TEAM_MEMORY.md:677`) ; captures 1440 et 375, sombre et clair | la War Room ne se connecte jamais à sa place (`TEAM_MEMORY.md:664`) |
| Un compte opérateur pour voir le back-office | même raison |
| Ou bien : autoriser des utilisateurs de test sur une instance Clerk de développement, avec jetons de test, pour que Mamori et Kensa mesurent eux-mêmes (Lighthouse, débordements, clavier) | décision sur un service externe et sur des comptes |
| Le versement au freelance et la frappe « payée sur Proofseen » : jouables seulement au GO PAIEMENT LIVE ou avec un vrai Sandbox Stripe (`TEAM_MEMORY.md:689`) | paiement réel |
| GO DEPLOY de chaque lot | production |
| La phrase freelance de `/bienvenue` (`i18n/fr.ts:352`, ancien positionnement) | marque |
| Clerk en thème clair : accepter des widgets sombres sur page claire, ou un changement de thème côté client (léger clignotement à l'hydratation) | arbitrage visuel sur un service externe |

À trancher par le Shogun plutôt que par le founder : le vert des cases citées sur `/visibilite` (BRAND_BOOK §8.3 face à
CONCEPT §1) ; le libellé « Preuves » ; la transition de l'accès unique.

### Sans lui

Tout le code des six lots ; les rendus serveur des composants sur données fixes (`react-dom/server`, dans les tests, jamais
une route publique) ; les tests de CSS (liste blanche du vert, état de départ visible, cibles) ; les calculs de largeur à
375 px ; la relecture clavier sur le code ; la sécurité des lots 3 et 4 en lecture.

---

## 5. Ce que je n'ai pas vérifié

- Aucun écran connecté rendu ni capturé ; les débordements de la barre du haut, du menu et des cartouches sont des
  calculs sur le CSS déclaré.
- La liste des blocs morts de `workspace.css` : recherche par `className` littéral seulement.
- Le schéma : présence de la décision et de sa date sur une demande de confirmation, des dates de séquestre et de
  versement, et des réponses détaillées d'une mesure de visibilité.
- Les écrans lus en surface seulement (titre et structure) : équipe, invitations, notifications, alertes, réglages, fil,
  missions côté freelance, écrans du back-office hors files de vérification.
- L'écran de paiement mensuel sur relevé (`packages/db/src/timesheets.ts` existe, aucun écran trouvé sous `/app`).
- L'état de travail du worktree lu (`wt-8`) n'a pas été contrôlé par `git status` : je me fie à son journal (tête à 0c16e8e).

---

## 6. Décisions du Shogun (2026-10-22)

1. **Lot 2, cases citées dans le registre du freelance** : même traitement que le relevé de la vitrine (`.rg-you`), pour
   un seul langage visuel. Une citation relevée est un fait mesuré, daté, avec sa source (la réponse du moteur) ; la case
   non citée reste à l'encre. Aucun pourcentage seul : compte brut, n et date, comme sur la vitrine.
2. **Ordre** : le retrait des révélations depuis une opacité nulle et de `CountUp` est fait sur
   `sprint/design-legends-followup-a` ; le lot 1 part de `main` après sa fusion, pour ne pas toucher deux fois
   `workspace.css`.
3. **Lot 3 avant les autres après le lot 1** : il porte le seul défaut de sécurité du plan (l'état « confirmée » lu dans
   l'adresse, `confirmer-mission/[id]/page.tsx:103`).
4. **Captures de l'espace connecté** : sans session sur l'aperçu, chaque lot fournit des rendus serveur de ses écrans
   sur données de test (comme le lot c l'a fait pour la recherche) ; le parcours réel se joue avec le founder.
