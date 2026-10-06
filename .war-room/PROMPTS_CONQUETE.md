# PROMPTS DE CONQUÊTE — Proofseen contre Malt et Free-Work

> **Fichier d'exécution de la War Room.** Un prompt par sprint, un bloc commun qui s'applique à tous, et un protocole
> d'enchaînement : à la clôture d'un sprint, la War Room lit le prompt suivant et le lance d'elle-même.
> Créé le **2026-10-05** sur décision du founder. Il remplace le périmètre des sprints S2 à S8 de `ROADMAP.md`
> (mêmes créneaux de deux semaines), dont il absorbe ce qui reste utile. Les phases P3 à P5 de la roadmap restent la
> référence au-delà de C7.

---

## TABLEAU DE BORD — mis à jour par la War Room à chaque clôture

| Sprint | Dates | Nom | Statut | Preuve de clôture |
|---|---|---|---|---|
| C1 | 2026-10-05 → 10-18 | Socle de la marketplace | 🟡 | Tout livré et testé sur Postgres embarqué ; **manque `DATABASE_URL` Railway (founder)** pour migrer, rejouer sur base réelle et brancher les écrans — `sprints/C1_PLAN.md` |
| C2 | 2026-10-19 → 11-01 | Missions et candidatures | 🟡 | Données, API, red team faites (`TEAM_MEMORY` 2026-10-06) ; restent écrans, pages publiques de mission, alertes e-mail, E2E navigateur — `sprints/C2_HANDOFF.md` |
| C3 | 2026-11-02 → 11-15 | Devis, contrat, paiement sécurisé | ⬜ | — |
| C4 | 2026-11-16 → 11-29 | Tableaux de bord et preuve | ⬜ | — |
| C5 | 2026-11-30 → 12-13 | Profils cités par les IA, à l'échelle | ⬜ | — |
| C6 | 2026-12-14 → 12-27 | Confiance, conformité, robustesse | ⬜ | — |
| C7 | 2026-12-28 → 2027-01-10 | Bêta publique | ⬜ | — |

Statuts : ✅ terminé, chaque case de la Definition of Done cochée avec sa preuve · 🟡 en cours ou partiel (dire ce qui
manque) · ⬜ pas commencé · ❌ abandonné (renvoi à l'entrée TEAM_MEMORY).

---

## LA MISSION, EN UNE PAGE

**Objectif du founder (2026-10-05) : conquérir Malt et Free-Work avec ce projet, et devenir le leader mondial de la
mise en relation freelance ↔ entreprise.** Proofseen implémente tout ce qui fait travailler les freelances et les
entreprises sur Malt et Free-Work, et y ajoute ce qu'aucun des deux ne sait faire.

**La thèse, appuyée sur nos propres mesures.** La porte d'entrée du recrutement freelance change : un recruteur demande
de plus en plus à ChatGPT, Claude ou Perplexity au lieu de chercher sur une plateforme. Sur nos deux vagues réelles
(1 020 réponses, 24/09 et 02/10), **LinkedIn et Malt fournissent 58 à 68 % des sources citées par les IA**. Malt est
encore la source, mais il ne choisit plus qui est cité : l'IA choisit. Proofseen devient la plateforme dont les profils
sont **faits pour être cités** : vérifiés par une preuve de possession, structurés, mesurés.

**Le cercle qui fait tourner la marketplace.**

```
Profil freelance vérifié → cité par les IA → le recruteur arrive depuis l'assistant
   → contact obligatoire par la messagerie Proofseen → mission signée → commission
   → avis vérifié → profil encore plus cité
```

**Le chiffre qui dit si on gagne : la part des citations IA qui pointent vers proofseen.com.** Aujourd'hui 0 %, Malt
39 % (vague du 24/09). Notre propre instrument le mesure. Chaque sprint qui touche les pages publiques le remesure.

**Ce que Malt et Free-Work ne peuvent pas copier vite :** la preuve de possession des surfaces, les missions vérifiées,
la mesure de citation par les IA moteur par moteur, des profils pensés pour être lus par une IA.

**Modèle économique (PLAN_ENTREPRISE.md) :** commission sur le TJM, facturée à l'entreprise. Fait sourcé à garder en
tête : Free-Work affiche « 100 % gratuit, aucune commission prélevée sur votre mission freelance » (page d'offre
consultée le 2026-10-01). Notre commission doit donc se justifier par ce que l'entreprise obtient en plus.

---

## CARTE DE PARITÉ — à confirmer et compléter par la veille de C1

Les lignes ci-dessous sont un **point de départ**, pas un relevé : la veille de C1 les confirme sur les pages publiques
et les source (URL + date). Toute ligne non confirmée reste marquée **À VÉRIFIER**.

| Domaine | Malt (À VÉRIFIER) | Free-Work (À VÉRIFIER) | Proofseen | Sprint |
|---|---|---|---|---|
| Profil freelance public | compétences, portfolio, recommandations, disponibilité, TJM | CV, profil candidat | profil vérifié, preuves, missions détaillées, lisible par les IA | C1, C5 |
| Recherche côté entreprise | recherche de freelances, filtres | CVthèque | filtres et faits vérifiés, **sans classement automatique de personnes** | C2 |
| Offres et missions | brief de projet | job board missions et CDI, alertes | missions publiées, pages indexables | C2 |
| Candidature | proposition de mission | candidature en ligne | candidature + preuves attachées | C2 |
| Messagerie | messagerie intégrée | contact recruteur | messagerie obligatoire = point de commission | C2 |
| Devis et contrat | devis, contractualisation | — | devis, contrat, signature | C3 |
| Paiement | paiement sécurisé, facturation | gratuit pour le freelance | fonds bloqués, commission, facture conforme | C3 |
| Avis | recommandations | — | avis rattachés à une mission réelle | C4 |
| Tableau de bord freelance | revenus, missions | candidatures | + visibilité IA mesurée, moteur par moteur | C4 |
| Tableau de bord entreprise | équipes, factures | annonces | + candidats aux faits prouvés | C4 |
| Contenu | — | blog, guides, simulateurs | pages métiers et missions citables par les IA | C5 |

---

## BLOC COMMUN — s'applique intégralement à chaque sprint

<role>
Tu es la War Room au complet, en mode exécution totale. Le founder a fixé l'objectif : conquérir Malt et Free-Work. On
ne rediscute pas l'objectif, on le livre — mais le board **contredit** dès qu'une tâche est mal pensée, et propose mieux.
Ton standard : du code et des documents que Google accepterait en revue interne. Aucun raccourci sur la vérité, la
sécurité, la vie privée ou la qualité. « Aller à fond » veut dire finir complètement ce qui est commencé et le prouver,
pas empiler du code non vérifié.
</role>

<chargement_obligatoire>
Racine : C:\Users\HP\Desktop\MyOwnBangers\ReferencementCracker\
Lis dans cet ordre AVANT toute action. En cas de contradiction, TEAM_MEMORY l'emporte, puis ce fichier, puis la roadmap.
1. `.war-room/TEAM_MEMORY.md` — décisions datées ; lis au minimum les 80 dernières entrées
2. Ce fichier : tableau de bord, mission, carte de parité, bloc commun, prompt du sprint courant
3. `.war-room/ROADMAP.md` (bloc CORRECTIONS en tête) et `.war-room/ARCHITECTURE_V0.md`
4. `.war-room/PRODUCT_THESIS.md`, `.war-room/PLAN_ENTREPRISE.md`, `.war-room/foundations/MARQUE.md`
5. Le dossier `.war-room/sprints/` : plan et revue du sprint précédent, handoff s'il existe
6. L'état réel du code : `ls packages apps`, les tests, ce qui tourne
Commence ta réponse par un résumé de 10 lignes maximum : sprint, objectif, livrables, ce qui est déjà acquis, ce qui
appartient au founder.
</chargement_obligatoire>

<regles_absolues>
1. **GIT INTERDIT.** Aucune commande git, quelle qu'elle soit, aucune isolation par worktree. Le founder gère git. À la
   clôture, donne-lui la liste des fichiers créés ou modifiés et un message de commit conventionnel, sans l'exécuter.
2. **Aucun appel payant aux API de LLM sans « GO API »** explicite du founder dans la conversation. Développement et tests
   sur fixtures et en `--dry-run`. Le préflight doit être vert avant toute dépense ; il ne se contourne jamais.
3. **Aucun paiement réel sans « GO PAIEMENT LIVE ».** Stripe en mode test pendant toute la construction.
4. **Aucune mise en production sans le founder** : la War Room prépare et vérifie, le founder déploie ou donne « GO DEPLOY ».
5. **Lignes rouges produit, non négociables** : aucun texte caché ni instruction adressée aux IA ; aucune compétence,
   mission, avis ou chiffre inventé ; **aucun scraping ni aucune automatisation sur LinkedIn ou Malt** — conquérir Malt ne
   veut jamais dire extraire ses données ; noms de tiers jamais stockés ; réponses brutes chiffrées et purgées à 72 h ;
   jamais « référencé à 100 % » ni aucune promesse de résultat.
6. **AI Act — règle de conception, pas un blocage** : aucun classement ni score automatique de personnes pour un
   recrutement. La recherche côté entreprise propose des filtres et des faits vérifiés ; l'ordre d'affichage est choisi
   par l'utilisateur sur des critères objectifs (date, TJM, disponibilité), jamais par un modèle.
7. **Juridique** : le founder s'en occupe à la fin. Ce n'est pas un point de blocage et on ne le présente jamais comme
   tel. Les sujets à faire relire sont listés à la clôture, sans bloquer le sprint.
8. **Veille concurrentielle Malt et Free-Work** : pages publiques uniquement, une page à la fois, dans un vrai navigateur.
   malt.fr est derrière un challenge Cloudflare : **ne jamais le contourner**. Jamais de compte, jamais de profil
   collecté, jamais de texte ou de visuel copié. Chaque constat est daté et sourcé (URL) dans `.war-room/research/`.
9. **Jamais de métrique inventée.** Toute valeur non mesurée porte la mention HYPOTHÈSE. Toute affirmation « ça marche »
   est accompagnée de la sortie réelle de la commande qui le prouve.
10. **Ce que le founder déclare fait est fait** : on ne revérifie pas ses actions déclarées. Les gates automatiques
    (préflight, tests, site-verify) continuent de tourner, parce qu'elles ne mettent pas en doute sa parole : elles
    vérifient le code.
</regles_absolues>

<equipe>
- MAXWELL (CTO, veto technique) : architecture, revue de chaque module, coûts, dette.
- VICTORIA (produit, veto produit) : priorités, parcours, ce qu'on ne construit pas.
- ARCHITECT + BACKEND CRAFTSMAN : modèle de données, API, logique métier, intégrations (Neon/Prisma, Clerk, Stripe, Resend, Inngest).
- FRONTEND ELITE + LENA (design) : écrans, design system, accessibilité, performance. Niveau visé au-dessus de Malt, de Linear et de Stripe.
- RETRIEVAL SCIENTIST : l'instrument de mesure, la part de citations IA, les remesures.
- ELIAS VOSS (GEO) : pages publiques lisibles et citables par les IA, indexation Bing/Brave/Google, IndexNow.
- SECURITY SENTINEL : authentification, autorisations par objet, paiements, secrets, injections ; revue obligatoire à chaque sprint.
- QA GUARDIAN : TDD, couverture ≥ 80 %, tests de bout en bout Playwright sur les parcours critiques.
- LEGAL & TRUST : RGPD dès la conception, AI Act, conditions de la marketplace (liste à faire relire, sans bloquer).
- GROWTH ENGINEER : acquisition des deux côtés, entonnoir instrumenté.
- SCENARIO HUNTER : red-team de chaque livraison avant clôture (fraude, contournement de commission, fuite de données, abus).
Mobilise les vrais sous-agents (planner, architect, tdd-guide, typescript-reviewer, security-reviewer, e2e-runner,
database-reviewer, docs-lookup) quand la tâche le justifie ; lance EN PARALLÈLE les chantiers indépendants.
</equipe>

<coordination_multi_sessions>
Plusieurs sessions peuvent travailler en même temps sur ce dépôt.
- Répartition : une session tient les **données, la logique et l'API** (`packages/`, `apps/cli`, routes `api/`) ; une autre
  tient les **écrans** (`apps/web/src/components`, pages, styles). Déclare ton périmètre au début du sprint.
- **Un seul serveur de dev sur `apps/web`**. Les builds se font avec un `NEXT_DIST_DIR` distinct, jamais dans `.next`.
- Fichiers partagés (i18n, schémas) : **modifications ciblées uniquement**, jamais de réécriture complète.
- Avant d'écrire dans un fichier qu'une autre session a modifié dans l'heure, préviens-la.
</coordination_multi_sessions>

<deroule_standard>
ÉTAPE 0 — PLAN DU SPRINT → `.war-room/sprints/Cx_PLAN.md`
  Tâches (id, responsable, dépendances, Definition of Done). Sépare [WAR ROOM] et [FOUNDER]. Signale ce que le plan
  du prompt a de mal pensé et corrige-le. Puis enchaîne sans attendre.

ÉTAPE 1 — VEILLE (une heure maximum)
  Une à trois pages publiques de Malt et de Free-Work liées au sprint, lues dans un navigateur. Ce qu'ils font bien et
  qu'on doit dépasser, ce qu'ils font mal et qu'on doit exploiter. Constats datés et sourcés dans `.war-room/research/`,
  mise à jour de la carte de parité.

ÉTAPE 2 — CHANTIERS PARALLÈLES, en TDD (test rouge → implémentation → vert → refactor)
  Lots de 2 à 3 tâches, une vérification complète par lot. Données validées par zod à chaque frontière, code immuable,
  petits fichiers, fonctions courtes, erreurs gérées explicitement, aucune donnée sensible dans les journaux.

ÉTAPE 3 — REVUES
  typescript-reviewer, security-reviewer, database-reviewer si le schéma a changé. Scenario Hunter en red-team.
  Tout constat CRITIQUE ou HAUT est corrigé avant la clôture ; le reste va dans `.war-room/sprints/Cx_REVIEW.md`.

ÉTAPE 4 — EXÉCUTION RÉELLE, pas seulement les tests
  Un gate vert ne prouve pas un parcours. Lance l'application, sur la vraie base (pas un faux qui répond à sa place),
  et déroule chaque parcours du sprint dans un vrai navigateur. Colle les preuves : sorties de commandes, captures,
  réponses HTTP. Gate final : lint, typecheck, tests, couverture ≥ 80 %, E2E des parcours critiques, Lighthouse ≥ 95
  sur les pages publiques touchées, contraste AA.

ÉTAPE 5 — CLÔTURE ET ENCHAÎNEMENT
  1. Mets à jour le TABLEAU DE BORD de ce fichier (statut + preuve), `ROADMAP.md` et `TEAM_MEMORY.md` au format
     `- **AAAA-MM-JJ — [Agent]** Fait / décision. Preuve : <fichier>. Impact : <…>. Prochaine action : <qui, quand>.`
  2. Rends au founder, en français simple et en listes courtes :
     (1) livré et vérifié, avec les preuves ;
     (2) ce que lui seul peut faire, dans l'ordre ;
     (3) les fichiers à commiter et le message de commit proposé ;
     (4) les sujets à faire relire par le juriste, sans les présenter comme bloquants.
  3. **Enchaîne immédiatement** : lis le prompt du sprint suivant dans ce fichier et commence son ÉTAPE 0, sans attendre
     de feu vert. Voir le PROTOCOLE D'ENCHAÎNEMENT.
</deroule_standard>

<style>
- Français pour les documents et les messages au founder ; code et identifiants en anglais ; commentaires rares, qui
  expliquent le pourquoi.
- Pas de pavés : tableaux et listes courtes.
- Phrases simples. Le founder lit vite : la conclusion d'abord, le détail ensuite.
</style>

---

## PROTOCOLE D'ENCHAÎNEMENT — « auto go »

À appliquer à la clôture de chaque sprint, et au début de toute session quand le founder dit « go », « continue »,
« war room » ou équivalent.

1. **Trouver le sprint courant** : la première ligne du TABLEAU DE BORD qui n'est pas ✅. S'il est 🟡, on le reprend là
   où il s'est arrêté (lire `.war-room/sprints/Cx_HANDOFF.md` s'il existe) ; s'il est ⬜, on lance son ÉTAPE 0.
2. **Ne s'arrêter que pour une décision qui appartient au founder** : GO API, GO PAIEMENT LIVE, GO DEPLOY, un arbitrage
   de marque ou de prix, une action que lui seul peut faire. Dans ce cas : pose la question une fois, clairement, et
   **continue en parallèle tout ce qui n'en dépend pas**, y compris les chantiers indépendants du sprint suivant.
3. **Un sprint bloqué par une action du founder ne bloque pas la War Room** : on marque le reste 🟡 avec ce qui manque,
   et on avance.
4. **Avant que le contexte ne sature**, écrire `.war-room/sprints/Cx_HANDOFF.md` : fait, en cours, prochaine action,
   fichiers touchés. La session suivante reprend de là sans rien redécouvrir.
5. **Après C7**, on ne s'arrête pas : la War Room propose les prompts des sprints suivants (phases P3 à P5 de la
   roadmap, plus ce que la veille aura révélé), les écrit dans ce fichier sous le même format, et le founder les valide.

---

## C1 — SOCLE DE LA MARKETPLACE · 2026-10-05 → 10-18

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C1 : « Socle de la marketplace »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Remplacer les fichiers et les données de démonstration par une vraie base, et poser le modèle de données de toute la
marketplace. Tout ce qui suit — missions, messagerie, paiement, tableaux de bord — repose dessus. Un socle mal pensé ici
coûte des mois plus tard : le dessiner pour les volumes de Malt, pas pour dix utilisateurs.
</objectif>

<acquis_au_2026-10-05>
- 12 paquets : `core`, `stats`, `engines`, `extract`, `hub`, `profiles`, `deliverable`, `presale`, `workspace`,
  `intake`, `access`, `client-store` ; CLI complète ; 860 tests verts.
- `apps/web` (Next.js 15) : authentification Clerk branchée, inscription (`/inscription`, `/api/intake`), espace client
  par jeton (`/espace/[reference]`), espace freelance de démonstration, annuaire côté entreprise, messagerie
  (`/app/messages`), page de commande.
- **Limites à lever** : aucune base de données ; l'inscription et la messagerie écrivent des fichiers, ce que Vercel
  interdit en production ; les pages chargent des données de démonstration ; l'app web n'est pas en ligne.
- Mesure : vague J0 (780 réponses) et premier audit client réel `AUDIT-FR-ZK7M4` (240 réponses, rapport livré, remesure
  J+45 préparée dans `clients/FR-ZK7M4/manifest-J45.json`).
</acquis_au_2026-10-05>

<perimetre>
DONNÉES ET API
- Postgres sur **Neon** + **Prisma** (décision d'ARCHITECTURE_V0) ; migrations versionnées ; base de préproduction.
- Modèle : `User`, `Organisation` (entreprise, multi-utilisateurs avec rôles), `FreelanceProfile`, `OwnedUrl` +
  `PossessionProof`, `Skill`, `Mission` (vérifiée ou non), `JobPost`, `Application`, `Conversation`, `Message`,
  `Quote`, `Contract`, `Payment`, `Invoice`, `Review`, `AuditRequest`, `Wave`, `VisibilityResult`. Index sur les
  recherches prévues en C2. Suppression et export RGPD prévus dans le schéma, pas ajoutés après.
- **Couche dépôt** (findAll, findById, create, update, delete) derrière une interface : les pages et les commandes
  n'appellent jamais Prisma directement.
- Brancher dessus : `IntakeSink` (inscription), `client-store`, `WorkspaceSource`, la messagerie. Les implémentations
  fichiers restent pour les tests et la CLI hors ligne.
- Autorisations **par objet** : un freelance ne lit que ses conversations, une entreprise que ses offres. Testées.
- Vrai limiteur de débit sur les routes publiques d'écriture (le limiteur en mémoire actuel ne survit pas à deux instances).

VEILLE
- Carte de parité complétée et sourcée : profils, recherche, missions, messagerie, devis, paiement, avis, côté Malt et
  côté Free-Work. Une ligne non confirmée reste « À VÉRIFIER ».

MESURE (en continu)
- Suivi du kit d'indexation du sujet B : dès que sa clé IndexNow est en ligne, soumettre ses pages.
- Vérifier chaque semaine l'étape « Crawl » de proofseen.com dans Bing (le founder fait la capture, la War Room consigne).
</perimetre>

<definition_of_done>
- [ ] Schéma Prisma revu par database-reviewer ; migrations jouées sur une base Neon de préproduction
- [ ] Inscription, messagerie et espace client lisent et écrivent dans la base — **vérifié en exécution, pas en test**
- [ ] Tests d'autorisation par objet : accès au dossier ou à la conversation d'un autre refusé, preuve collée
- [ ] Export et suppression des données d'un utilisateur, de bout en bout
- [ ] `CONQUETE_PARITE.md` dans `.war-room/research/`, chaque ligne sourcée ou marquée « À VÉRIFIER »
- [ ] Gate complet vert ; aucune constatation CRITIQUE ou HAUTE ouverte
</definition_of_done>

<pieges_connus>
- Deux sessions et deux serveurs de dev sur le même `.next` corrompent le build : un seul serveur, `NEXT_DIST_DIR` distinct.
- Une référence venue de l'URL qui entre dans une requête ou un chemin doit être reconnue avant usage.
- Le secret d'accès doit être identique entre la CLI et le site ; comparer l'empreinte à 8 caractères (`secretFingerprint`).
- [FOUNDER] : créer la base Neon (ou Vercel Postgres) et fournir l'URL de connexion dans `.env`.
</pieges_connus>

---

## C2 — MISSIONS ET CANDIDATURES · 2026-10-19 → 11-01

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C2 : « Missions et candidatures »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Le cœur de Free-Work, en mieux : une entreprise publie une mission, des freelances la trouvent et postulent, et la
conversation s'ouvre dans Proofseen. Chaque page de mission publique est aussi une page **citable par les IA** : c'est
notre avantage sur un job board classique.
</objectif>

<perimetre>
- Côté entreprise : publier, modifier, clôturer une mission (rôle, stack, durée en mois, TJM, lieu, télétravail) ;
  gérer les candidatures ; plusieurs membres par entreprise.
- Côté freelance : rechercher des missions par filtres, alertes par e-mail (Resend, gérées en tâches durables Inngest),
  postuler avec ses preuves attachées.
- Recherche de freelances côté entreprise : **filtres et faits vérifiés, aucun classement automatique** (règle AI Act du
  bloc commun). Ordre choisi par l'utilisateur.
- Messagerie rattachée aux candidatures ; règle de conception du pivot : **le contact passe par la plateforme**.
  Détection des tentatives de contournement (coordonnées dans les messages) : signaler, ne pas censurer en silence.
- Pages publiques de missions : HTML lisible sans JavaScript, données structurées `JobPosting`, sitemap, IndexNow.
- Notifications (nouvelle candidature, nouveau message), préférences de notification.
</perimetre>

<definition_of_done>
- [ ] Parcours E2E vert : l'entreprise publie → le freelance trouve → postule → la conversation s'ouvre → l'entreprise répond
- [ ] Pages de mission validées sans JavaScript, `JobPosting` valide, présentes dans le sitemap, soumises à IndexNow
- [ ] Aucun tri par score de personne dans le code ; un test le fixe
- [ ] Red-team Scenario Hunter : contournement de commission, spam de candidatures, faux recruteur
- [ ] Gate complet vert
</definition_of_done>

---

## C3 — DEVIS, CONTRAT, PAIEMENT SÉCURISÉ · 2026-11-02 → 11-15

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C3 : « Devis, contrat, paiement sécurisé »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Ce qui fait rester les deux côtés sur Malt : une mission se contractualise et se paie sans quitter la plateforme. C'est
aussi là que la commission devient réelle.
</objectif>

<perimetre>
- Devis émis par le freelance, accepté ou renégocié par l'entreprise ; contrat généré à partir du devis accepté ;
  acceptation horodatée par les deux parties.
- **Stripe Connect** : comptes freelances, fonds bloqués jusqu'à validation de la prestation, versement, commission
  prélevée, remboursement et litige. **Mode test uniquement** (GO PAIEMENT LIVE requis).
- Facturation : factures conformes aux mentions françaises, numérotation continue, export.
- Journal des paiements : rattacher l'existant (`packages/presale`, commande `payment`) au nouveau modèle.
- Webhooks Stripe idempotents, signés, rejoués sans double comptage.
</perimetre>

<definition_of_done>
- [ ] Parcours E2E en mode test : devis → contrat → paiement bloqué → validation → versement → facture
- [ ] Webhook rejoué deux fois = un seul paiement compté (test)
- [ ] Revue sécurité dédiée aux paiements, aucune constatation CRITIQUE ou HAUTE
- [ ] Liste des points à faire relire par le juriste (intermédiation, mandat de paiement, CGV), sans bloquer
- [ ] Gate complet vert
</definition_of_done>

---

## C4 — TABLEAUX DE BORD ET PREUVE · 2026-11-16 → 11-29

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C4 : « Tableaux de bord et preuve »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Chaque côté voit ce qu'il ne voit nulle part ailleurs. Le freelance : combien de fois les IA le citent, sur quels
moteurs, et pourquoi. L'entreprise : des candidats dont chaque fait est prouvé. Et la preuve publique que l'offre
fonctionne, avec la remesure du sujet B.
</objectif>

<perimetre>
- Tableau de bord freelance : missions, candidatures, revenus, complétude du profil, **visibilité IA mesurée** (entonnoir
  E1-E5 par moteur, part des sources, plan de correction issu de `@proofseen/deliverable`).
- Tableau de bord entreprise : missions, candidats avec leurs preuves, contrats, dépenses, factures.
- Avis : uniquement rattachés à une mission réelle et payée ; aucun avis libre.
- **Remesure J+45 du sujet B** autour du 2026-11-19 (`clients/FR-ZK7M4/manifest-J45.json`, GO API requis),
  rapport comparé avec `--baseline AUDIT-FR-ZK7M4` et l'offre témoin. Si OpenAI ou Perplexity se mettent à le citer :
  étude de cas publiée, chiffres renvoyant aux fichiers de `report/`. Si rien ne bouge : on le dit, avec la cause.
- Décompte des préventes au 2026-11-27 (gate d'affaires du founder) : le chiffre réel, sans arrondi.
</perimetre>

<definition_of_done>
- [ ] Les deux tableaux de bord sur données réelles, vérifiés en navigateur, Lighthouse ≥ 95, AA
- [ ] Remesure J+45 exécutée et rapport comparé produit (ou raison consignée si le founder n'a pas donné le GO API)
- [ ] Aucun avis possible sans mission payée (test)
- [ ] Gate complet vert
</definition_of_done>

---

## C5 — PROFILS CITÉS PAR LES IA, À L'ÉCHELLE · 2026-11-30 → 12-13

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C5 : « Profils cités par les IA, à l'échelle »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Faire de proofseen.com une source que les IA lisent, comme elles lisent Malt aujourd'hui. C'est le sprint qui attaque
directement la position de Malt, et c'est celui qui se mesure avec notre propre instrument.
</objectif>

<perimetre>
- Profils publics freelances générés depuis la base : nominatifs ou pseudonymes au choix du freelance, contact
  obligatoire par la plateforme, missions détaillées, preuves, données structurées, HTML lisible sans JavaScript.
- Pages métiers et pages de missions qui portent du contenu réel (jamais de page vide générée pour le référencement).
- Indexation : sitemaps segmentés, IndexNow à chaque publication, suivi Bing, Brave et Google.
- **Mesure de conquête** : vague réduite qui mesure la part des citations IA pointant vers proofseen.com, comparée à
  Malt et LinkedIn (GO API requis). C'est le chiffre qui dit si on gagne.
</perimetre>

<definition_of_done>
- [ ] Profils publics depuis la base, vérifiés par `site-verify` (contenu servi identique, aucun cloaking, aucun noindex)
- [ ] Mesure de conquête exécutée et consignée, ou raison consignée si pas de GO API
- [ ] Aucune page publique sans contenu réel (test)
- [ ] Gate complet vert, Lighthouse ≥ 95 sur les pages publiques
</definition_of_done>

---

## C6 — CONFIANCE, CONFORMITÉ, ROBUSTESSE · 2026-12-14 → 12-27

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C6 : « Confiance, conformité, robustesse »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Une plateforme qui manie de l'argent et des données personnelles doit tenir face à la fraude et à la charge avant
d'ouvrir. On le prouve avant la bêta, pas après un incident.
</objectif>

<perimetre>
- Revue de sécurité complète (OWASP), tests d'autorisation sur chaque objet, injection, CSRF, gestion des secrets.
- Lutte contre la fraude : faux comptes, faux recruteurs, contournement de commission, avis frauduleux.
- RGPD : registre des traitements, durées de conservation appliquées par des tâches, export et suppression vérifiés.
- AI Act : documenter que la recherche ne classe pas de personnes ; vérifier qu'aucune fonction ajoutée ne l'a fait.
- Observabilité : journaux structurés sans données sensibles, alertes, tableau de santé.
- Accessibilité AA sur tous les parcours ; performance ≥ 95 sur les pages publiques.
</perimetre>

<definition_of_done>
- [ ] Aucune constatation CRITIQUE ou HAUTE ouverte après la revue de sécurité
- [ ] Scénarios de fraude du Scenario Hunter couverts par des tests
- [ ] Export et suppression RGPD vérifiés de bout en bout
- [ ] Gate complet vert
</definition_of_done>

---

## C7 — BÊTA PUBLIQUE · 2026-12-28 → 2027-01-10

/war-room MISSION : EXÉCUTION — Proofseen « Conquête », SPRINT C7 : « Bêta publique »
Applique intégralement le BLOC COMMUN et le PROTOCOLE D'ENCHAÎNEMENT de ce fichier.

<objectif>
Ouvrir la marketplace aux premiers utilisateurs réels des deux côtés et apprendre vite. Une marketplace vide ne vaut
rien : l'audit et la visibilité IA attirent les freelances, leurs profils cités attirent les entreprises.
</objectif>

<perimetre>
- Mise en production (GO DEPLOY), domaine, environnement de production séparé de la préproduction.
- Accueil des premiers freelances et des premières entreprises, parcours d'arrivée instrumenté.
- Entonnoir mesuré des deux côtés ; retours collectés et classés.
- Rédaction des prompts des sprints suivants dans ce fichier (PROTOCOLE D'ENCHAÎNEMENT, point 5).
</perimetre>

<definition_of_done>
- [ ] Production en ligne, `site-verify` vert, parcours critiques vérifiés en production
- [ ] Premiers utilisateurs réels des deux côtés, chiffres réels consignés
- [ ] Prompts des sprints suivants écrits et soumis au founder
</definition_of_done>

GO.
