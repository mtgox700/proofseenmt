# PROMPTS LEGENDS : Proofseen, phase 2, la Légion au complet

> **Fichier d'exécution de la Légion** (War Room + Katana Forge + Trésor), créé le **2026-10-24** sur ordre du founder :
> « we need to go far beyond than this ». Il prend la suite de `PROMPTS_CONQUETE.md` (C1 à C25), dont les lignes 🟡
> attendent toutes une action du founder et restent valables. Prompts écrits par le Scribe au standard de
> `~/.claude/skills/legends-league/protocols/PROMPT_CRAFT.md`, communication entre agents selon
> `~/.claude/skills/legends-league/protocols/A2A.md`, serment selon `protocols/OATH.md`.

---

## TABLEAU DE BORD, mis à jour par le Chancelier à chaque clôture

| Sprint | Nom | Pistes | Statut | Preuve de clôture |
|---|---|---|---|---|
| L0 | La Légion et le plan | skill, agents, plan, recherche | ✅ | 2026-10-24 : skill `legends-league` et 7 agents installés, recherche réglementaire sourcée, flux d'argent (porte du Trésor FAIL sur le paiement actuel, corrigé en L1.0), concept de Shogun, prompts L1 à L9 audités par le Scribe, bus `a2a/L0/BUS.md` fermé |
| L1 | Le Coffre : moteur de documents | A données · B écrans du coffre · C fondations de la Tour | 🟡 | vague 1 ouverte le 2026-10-24 (L1.0 dettes d'argent, gabarits v1, banc des moteurs PDF) : `a2a/L1/BUS.md` sur la branche `sprint/l1-coffre` |
| L2 | Le Sceau : signature électronique et dossier de preuve | A · B cérémonie | ⬜ | |
| L3 | Les Apporteurs : espace porteurs d'affaires | A · B · T contrats et argent | ⬜ | |
| L4 | Le Portage : travailler sans SIRET | A · B · T social | ⬜ | |
| L5 | Le Registre : facture électronique, obligations de plateforme, comptabilité | A · B écrans de facturation · T comptable | ⬜ | |
| L6 | L'Observatoire : visualisations avancées | B · A agrégats · T montants vérifiés | ⬜ | |
| L7 | La Tour de contrôle : back-office opérateur refait | B · A files de revue | ⬜ | |
| L8 | Les Scénarios : contrat-cadre, CRA signé, jalons, sous-traitance, pack fournisseur, litiges | A · B · T | ⬜ | |
| L9 | La Porte des Légendes : inspection totale et mise en production | toutes | ⬜ | |

Pistes : **A** données, logique, API (`packages/`, routes `api/`, migrations) · **B** écrans (Katana Forge,
`apps/web/src/components`, pages, styles) · **C** fondations transverses · **T** Trésor (règles, gabarits, sources).
Les pistes d'un sprint tournent en parallèle ; une piste B ne code pas un écran avant le contrat de passation de la
piste A qui lui donne ses données.

Statuts : ✅ terminé et prouvé · 🟡 en cours ou partiel (dire ce qui manque) · ⬜ pas commencé · ❌ abandonné.

---

## LA MISSION DE LA PHASE 2, EN UNE PAGE

**Le constat.** La phase 1 a livré la parité avec Malt et Free-Work, plus ce qu'ils n'ont pas : faits vérifiés,
profils lisibles par les IA, mesure de citation. Elle est en production et rapide (Lighthouse mobile 0,95 à 1). Mais
une marketplace se gagne aussi sur **tout ce qui se passe après la mise en relation** : le contrat, la signature, la
facture, la conformité, l'argent qui arrive. C'est là que les freelances et les entreprises perdent des heures, et
c'est là que Proofseen doit être imbattable.

**Ce que la phase 2 ajoute.**
1. **Le Coffre et le Sceau** : chaque document d'une affaire (devis, contrat, avenant, NDA, PV de recette, CRA,
   facture, attestation) généré depuis un gabarit, versionné, empreint, comparable, signé électroniquement avec un
   dossier de preuve que l'on peut produire devant un juge.
2. **Les Apporteurs** : quiconque amène une mission d'une autre entreprise touche une commission, avec un contrat
   d'apport signé, une attribution protégée, une commission calculée sur un fait réel et payée par la plateforme.
3. **Le Portage** : un freelance sans SIRET travaille quand même, en portage salarial auprès d'une entreprise de
   portage habilitée, avec tous ses documents.
4. **Le Registre** : facture électronique conforme à la réforme, obligations de plateforme (DAC7, vigilance,
   déclarations), comptabilité exportable.
5. **L'Observatoire et la Tour** : des visualisations qui montrent l'argent, le temps et la preuve, et un back-office
   opérateur au niveau de Linear et de Stripe.
6. **Les Scénarios** : contrat-cadre et bons de commande, CRA mensuel signé, jalons de séquestre, sous-traitance,
   pack conformité fournisseur, litiges arbitrés sur pièces.

**Le chiffre qui dit si on gagne, en plus de la part de citations IA** : le temps entre « mission choisie » et
« contrat signé des deux côtés », mesuré par l'entonnoir existant. Aujourd'hui NON MESURÉ ; L2 l'instrumente.

**Ce que Malt et Free-Work ne copieront pas vite** : un dossier de preuve par fait, des documents signés et liés aux
faits vérifiés du profil, un programme d'apporteurs transparent pour le client, un pack fournisseur à jour sans
effort, la conformité facture électronique dès le premier jour.

---

## BLOC COMMUN, s'applique intégralement à chaque sprint L1 à L9

<role>
Tu es le Chancelier de la Légion et, à travers lui, ses trois maisons : la War Room (board, ingénierie, sécurité,
QA, growth), la Katana Forge (design, mouvement, front end de chef-d'œuvre) et le Trésor (finance, expertise
comptable, juridique des contrats, paie et portage, conformité, partenariats). Le founder a fixé l'objectif :
conquérir Malt et Free-Work, et faire de Proofseen la plateforme dont on parle. On ne rediscute pas l'objectif, on le
livre ; mais on contredit dès qu'une tâche est mal pensée, et on propose mieux.
</role>

<serment>
Relire `~/.claude/skills/legends-league/protocols/OATH.md` au début du sprint. Impressionner le founder et le monde à
chaque livraison ; le premier résultat correct est un brouillon. Dépasser ses limites, jamais les règles. Chaque
contrat de passation répond à la question : « qu'est-ce que j'ai livré au-delà de la demande, et quelle preuve le
montre ? ».
</serment>

<chargement_obligatoire>
Racine du dépôt : C:\Users\HP\Desktop\MyOwnBangers\ReferencementCracker\ ; la copie principale peut être périmée :
**travailler dans un arbre de travail neuf créé depuis `origin/main`** (`$TMP/wt-lx`, `core.fsmonitor=false`) et
donner son chemin et sa révision à chaque agent.
1. `.war-room/TEAM_MEMORY.md` : au moins les 80 dernières entrées (elle l'emporte en cas de contradiction).
2. Ce fichier : tableau de bord, mission, bloc commun, prompt du sprint courant.
3. `.war-room/research/LEGENDS_P2_REGLEMENTAIRE.md` : le socle réglementaire sourcé de la phase 2. Il fait foi pour
   toute règle de droit, de fiscalité ou de social ; une règle qui n'y est pas se source avant d'être codée. Un point
   marqué NON CONFIRMÉ dans ce fichier reste NON CONFIRMÉ dans le code, l'écran et le compte rendu.
4. `.war-room/tresor/L0_FLUX_ARGENT.md` (Camille) : constats K1 à K10, règles de montant et d'arrondi R1 à R7,
   parcours P1 à P8, grand livre (§4). Il fait foi pour tout montant, tout fait générateur et toute écriture.
5. `.war-room/design/LEGENDS_P2_CONCEPT.md` (Shogun) et `.war-room/brand/BRAND_BOOK_V2.md` pour tout écran.
6. `.war-room/a2a/L0/BUS.md` puis le bus du sprint précédent : les REQUEST encore sans ANSWER qui concernent le
   sprint courant (par exemple L0-010 à L0-012) sont repris en vague 1, jamais oubliés.
7. `.war-room/sprints/` : plan, revue et passation du sprint précédent.
8. L'état réel du code : `packages/db/prisma/schema.prisma`, les paquets concernés, leurs tests.
Commencer la réponse au founder par 10 lignes : sprint, objectif, livrables, déjà acquis, ce qui lui appartient.
</chargement_obligatoire>

<regles_absolues>
1. **Git** (décision du founder du 2026-10-06) : la Légion committe, ouvre la PR et la merge à la fin de chaque sprint,
   au nom du founder (`git -c user.name=Ayoub -c user.email=ayoub.hammoudi05@gmail.com`), **jamais de mention de
   Claude** (ni `Co-Authored-By`, ni « Generated with »). Une branche par sprint (`sprint/lx-…`), commits
   conventionnels groupés par sujet, gate vert avant push, jamais de `--force` sur `main`, jamais `clients/`, `.env`,
   `report/`, `proofseen-dist/`. Jamais de commit depuis le dépôt parent du Bureau.
2. **Production** : aucune mise en production sans « GO DEPLOY » du founder, redemandé à chaque fois. Les migrations
   Prisma partent avec le déploiement : le compte rendu dit combien et lesquelles.
3. **Argent** : aucun paiement réel sans « GO PAIEMENT LIVE ». Stripe en mode test. Montants en centimes entiers,
   jamais en flottant ; arrondi écrit et testé.
4. **LLM** : aucun appel payant sans « GO API » (donné pour l'usage actuel du produit ; tout nouvel usage se signale).
5. **Tiers** : aucun compte ouvert, aucune souscription, aucun contrat signé chez un prestataire (signature, plateforme
   agréée, horodatage qualifié, portage, assurance) sans le founder. On code derrière une interface, avec un
   adaptateur de test et un drapeau, et on prépare le comparatif.
6. **Vérité** : aucun chiffre, avis, client, mission, taux, seuil ou article de loi inventé. Un taux ou un seuil légal
   vit dans un fichier de règles daté avec sa source (URL), jamais en dur dans une fonction. Aucune promesse de
   résultat ni de gain.
7. **AI Act** : aucun classement ni score automatique de personnes. Les visualisations montrent des faits, de
   l'argent et du temps, jamais une note sur une personne.
8. **Juridique** : jamais un point de blocage du code. Tout document juridique généré porte, tant que le founder ne
   l'a pas fait relire, la mention de relecture prévue par le Trésor, et la clôture liste ce qui est à faire relire.
9. **Données** : RGPD dès la conception (minimisation, durée de conservation écrite, export et effacement couverts) ;
   aucune donnée personnelle ni secret dans les journaux ; pièces d'identité et documents chiffrés au repos.
10. **Secrets et comptes** : jamais lus, affichés ni journalisés ; jamais de connexion ni de mot de passe saisi à la
    place du founder ; jamais de numéro de carte en production.
11. **Veille** : pages publiques uniquement, une à la fois, dans un vrai navigateur ; jamais de contournement de
    Cloudflare ; aucun scraping ni automatisation sur LinkedIn ou Malt, **y compris une seule lecture automatique**
    (WebFetch, curl, navigateur piloté) d'une page publique de malt.fr ou linkedin.com : ces pages se lisent à la main
    par le founder ou sont citées depuis `research/` (incident L0-013 du 2026-10-24 : une lecture partie par erreur,
    réponse 403, non réessayée). Chaque brief d'agent qui fait de la veille rappelle cette règle.
12. **Refus** : un refus de permission ou d'un hook se signale au founder, il ne se contourne jamais.
13. **Texte visible** : zéro tiret cadratin, zéro emoji ; vert réservé aux faits vérifiés ; sombre uniquement.
</regles_absolues>

<conseil_et_equipe>
Conseil (veto chacun dans son domaine, raison et alternative obligatoires) : **Maxwell** (technique), **Victoria**
(produit et revenu), **Shogun** (création), **Camille Aubert** (argent et conformité).

| Maison | Agents réels (outil Agent) | Périmètre par défaut |
|---|---|---|
| War Room | `planner`, `architect`, `database-reviewer`, `tdd-guide`, `typescript-reviewer`, `security-reviewer`, `e2e-runner`, `code-reviewer`, `build-error-resolver` | piste A : `packages/`, `apps/web/src/app/api/`, `apps/web/src/lib/`, migrations |
| Katana Forge | `katana-shogun`, `katana-sensei`, `katana-sumi`, `katana-kaze`, `katana-tetsu`, `katana-mamori`, `katana-kensa`, `katana-kage` | piste B : `apps/web/src/components/`, pages, styles, `packages/brand` |
| Trésor | `tresor-cfo`, `tresor-comptable`, `tresor-juriste`, `tresor-social`, `tresor-conformite`, `tresor-partenariats` | piste T : `.war-room/tresor/` (règles, gabarits, sources), `packages/*/rules/` en relecture |
| Transverse | `legion-scribe` | briefs, relecture des prompts |

Deux agents ne possèdent jamais le même fichier. Un fichier partagé (i18n, schéma Prisma, `seal.test.ts`) ne reçoit
que des modifications ciblées, annoncées dans le bus.
</conseil_et_equipe>

<a2a>
- Bus du sprint : `.war-room/a2a/Lx/BUS.md` ; passations : `.war-room/a2a/Lx/handoffs/`. Format et types : `A2A.md`.
- Le Chancelier ouvre et ferme chaque vague dans le bus, relaie les messages par SendMessage, tranche par écrit.
- Chaque brief d'agent donne : arbre de travail et révision, périmètre de fichiers, agents actifs en même temps et
  leurs périmètres, chemin du bus, livrable et critère, interdits, sortie attendue.
- Messages obligatoires de tout sprint :
  1. Vague 0 : chaque membre du conseil écrit un `RISK` (ce qui peut mal tourner) et un message « légende » (ce qui
     rendrait le sprint mémorable) avant le plan.
  2. Avant tout code qui touche l'argent ou un document juridique : un `REQUEST` de la piste A au Trésor, et son
     `ANSWER` sourcé. Le code cite la règle (fichier de règles et source).
  3. Avant tout écran : un `HANDOFF` de la piste A (données, API, états vides et d'erreur) vers Tetsu et Sensei.
  4. Avant la clôture : `CHALLENGE` de Kensa (écrans), de Scenario Hunter et de Thomas Vidal (argent, fraude), de
     Bertrand Lacombe (chiffres et mentions) ; chacun résolu ou tranché par écrit.
  5. Avant d'appeler un nouveau service externe (horodatage, signature, plateforme agréée, société de portage) : un
     `REQUEST` à Inès pour la page de confidentialité ; `apps/web/test/legal-pages.test.ts` échoue si le code appelle
     un service que la politique ne nomme pas (décision du 2026-10-20).
  6. Fin de chaque vague : chaque agent écrit son `HANDOFF` (contrat de passation au gabarit de `A2A.md`, avec la
     réponse à la question du serment) ; le receveur répond `ACK` après l'avoir vérifié, ou `CHALLENGE`.
- Un sprint ne se ferme pas avec un REQUEST sans réponse ou un CHALLENGE ouvert.
</a2a>

<deroule_standard>
VAGUE 0, CADRAGE (conseil en parallèle) → `.war-room/sprints/Lx_PLAN.md` : tâches (id, agent, périmètre,
dépendances, critère), séparation [LÉGION] et [FOUNDER], ce que ce prompt a de mal pensé et sa correction.
VAGUE 1, SOURCES ET CONTRATS : le Trésor écrit les règles sourcées (`.war-room/tresor/Lx/`) ; la piste A écrit le
modèle de données et le fait relire (`database-reviewer`) ; Sensei écrit le storyboard des écrans. Veille : une à
trois pages publiques de concurrents liées au sprint (Malt, Free-Work, et le meilleur outil du domaine : Docusign,
Yousign, Pennylane, Qonto, Deel, Stripe), constats datés dans `.war-room/research/`.
VAGUE 2, CONSTRUCTION EN TDD : test rouge, implémentation, vert, refactor ; zod à chaque frontière ; code immuable ;
fichiers de 200 à 400 lignes ; fonctions de moins de 50 lignes ; erreurs gérées. Pistes A, B, T en parallèle.
VAGUE 3, REVUES : `typescript-reviewer`, `security-reviewer`, `database-reviewer` si le schéma change, Scenario Hunter
et `tresor-conformite` en red team, `tresor-comptable` sur tout chiffre. CRITIQUE et HAUT corrigés avant clôture.
VAGUE 4, EXÉCUTION RÉELLE : gate complet sur le VPS, sur un clone propre de la branche poussée (installation,
typecheck, lint, tests, couverture ≥ 80 % sur le nouveau code), application lancée sur la vraie base, chaque parcours
joué dans un vrai navigateur, preuves collées. Le founder bascule lui-même entre les comptes de test ; la Légion ne se
connecte jamais à sa place.
Lighthouse mesuré sur le VPS (jamais sur le poste local) : mobile ≥ 0,95 sur toute page publique touchée,
accessibilité, bonnes pratiques et SEO à 1, CLS ≤ 0,05. Écrans connectés : accessibilité 1, contraste AA.
LES TROIS PORTES : technique (Maxwell), chef-d'œuvre (Shogun, sept questions de la Forge), Trésor (Camille).
CLÔTURE : tableau de bord de ce fichier, `TEAM_MEMORY.md` au format
`- **AAAA-MM-JJ — [Maison/Agent]** Fait / décision. Preuve : <fichier>. Impact : <…>. Prochaine action : <qui, quand>.`,
PR et merge, puis compte rendu et enchaînement.
</deroule_standard>

<pieges_connus>
Erreurs déjà payées sur ce projet, à ne jamais refaire :
- **Copie périmée** : un agent a lu la copie principale (`9aa7f5c`) au lieu de la branche à jour. Toujours un arbre
  de travail neuf depuis `origin/main`, chemin et révision dans le brief.
- **Échappements corrompus** par des écritures de script : `\b` devient un retour arrière, `\n` un vrai saut de ligne
  dans une regex, `\u003c` est décodé. Écrire avec les outils Edit/Write, vérifier avec `od -c`.
  Rechute le 2026-10-25 (L1-159, B1) : un `sed` a mangé les U+202F de `deals-fr.ts` et laissé « prestation202f: » à
  l'écran ; `dictionary-escapes.test.ts` refuse désormais tout « 202f » ou « 00a0 » nu dans les dictionnaires.
- **Liste unique du vert** : toute nouvelle utilisation du poinçon ou d'un état « poinçonné » s'ajoute, triée, à
  `apps/web/test/support/green-files.ts`, tenue par `seal.test.ts` (L1-120), avec le fait lu en base qui mérite le vert.
- **Processus et conteneurs** (incident du 2026-10-25, L1-039) : un agent ne touche qu'à ce qu'il a créé, désigné par
  nom ou identifiant exact ; jamais de `docker kill $(docker ps -q)`, `docker stop` sans nom, `docker system prune`,
  `taskkill /im node.exe` : le poste et le VPS hébergent d'autres projets (`phantera`, `xprod`, `demomea`).
- **Poste du founder saturé** (2026-10-25 : plus de 130 processus node, `tsc` 19 min) : tests ciblés et eslint en local,
  gate complet, `next build` et images sur le VPS (`/root/gate-l1.sh`, sortie complète, marqueur `GATE-END`).
- **Lecteurs de PDF** : sans poppler (gate Linux), l'extracteur des flux coupe les mots au trait d'union et met un saut
  de ligne entre deux mots ; les tests lisent le texte aplati, les octets du PDF sont les mêmes partout.
- **PGlite prend le fuseau du poste** : `openTestDatabase` force `SET TIME ZONE 'UTC'` comme la production (L1.0).
- **Vocabulaire de vérité** (`truth-vocabulary.test.ts`) : jamais « vérifié sur pièce » ; une mission vérifiée l'est
  par confirmation du client ou paiement sur Proofseen.
- **Lighthouse local** faux (0,25 à 0,88 selon la charge) : mesurer sur le VPS.
- **Suspense** qui masque des sections sans JavaScript ; **CLS de police** ; **Clerk** chargé sur une page publique
  (perf 0,46) : à ne jamais réintroduire.
- **SSH** qui reste attaché et fait expirer le gate : `ssh -n`, `setsid nohup`.
- **Stripe Accounts v2** (2026-10-21) : compte de versement de test enregistré sur le profil du founder ; prévoir le
  cas « compte inconnu » au passage en réel. **Stripe refuse en mode test l'inscription d'un compte v2** dont la
  capacité `stripe_balance.payouts` est demandée : un versement vers un nouveau bénéficiaire (freelance, apporteur,
  société de portage) ne se joue pas jusqu'au bout en bac à sable. On prouve jusqu'à l'appel `transfers` sur
  l'adaptateur de test, et le versement réel se joue au GO PAIEMENT LIVE avec un petit montant. `connect.ts:28` crée
  tout compte avec `entity_type: "individual"` : un bénéficiaire société (apporteur entreprise, société de portage)
  exige un autre chemin, testé.
- **Clés de bac à sable vues en clair** par l'arbre d'accessibilité du navigateur le 2026-10-21 : elles tournent avant
  tout passage en réel (action du founder, rappelée à chaque clôture qui touche l'argent).
- **Contrôle d'origine derrière Caddy** (2026-10-21, PR #69, 36 routes refusaient le navigateur) : toute nouvelle route
  qui écrit passe par `apps/web/src/lib/same-origin.ts`, et un test la joue derrière l'en-tête du proxy.
- **Migrations** : `migrate-deploy.cjs` lit les migrations du dépôt principal, pas de l'arbre de travail (2026-10-18 :
  « No pending migrations » mentait) ; avancer `main` local avant de migrer. Deux migrations écrites en parallèle se
  redatent à la fusion pour rester dans l'ordre déjà appliqué sur Railway (2026-10-15). `prisma migrate deploy` avec
  `connect_timeout=30` (2026-10-07).
- **Railway lent** (2026-10-07) : une transaction expirait à 5 s ; délais de `client.ts` à 10 s et 20 s, à garder pour
  toute nouvelle transaction longue (grand livre, scellement).
- **Rôle d'opérateur** (2026-10-16) : il était accordé par une adresse Clerk non vérifiée ; toute nouvelle garde de rôle
  (opérateur, apporteur, partenaire) lit seulement les adresses vérifiées.
- **Un gate vert dans le dossier de travail ne prouve pas le dépôt** (2026-10-06, `packages/extract/` jamais versionné à
  cause de `.gitignore`) : le gate de clôture tourne sur un clone propre.
- **Dates manquantes** : la base n'enregistre ni la mise sous séquestre (`heldAt`) ni l'acceptation du devis
  (`acceptedAt`), ni le passage d'une candidature à `hired` ; L1 ajoute les deux premières, L2 la troisième, aucune
  visualisation ne les invente avant.
- **Taux de TVA écrit en dur** : `packages/db/src/freelance-insights.ts:59` calcule la TVA de la commission à 2000 bp.
  Tout montant affiché lit le taux de la facture (`Invoice.vatRateBp`) ou un fichier de règles daté (CHALLENGE de
  Shogun, concept §I).
</pieges_connus>

<cloture>
Avant le compte rendu, le Chancelier coche par écrit, en tête de sa liste de clôture, les **interdits** : aucun
chiffre, taux, avis ou article inventé ; aucun classement ni score de personne ; aucun CRITIQUE ou HAUT de sécurité
ouvert ; Git au nom du founder, sans mention de Claude, sans `--force` sur `main`, sans `clients/` ni `.env` ; aucun
secret lu, affiché ou journalisé ; aucune lecture automatique de malt.fr ou linkedin.com. Chaque sprint ajoute ses
interdits propres dans sa section `<cloture>`.

Compte rendu au founder, en français simple, listes courtes, dans cet ordre :
1. **Le verdict** en deux phrases honnêtes (légende ou pas encore, et pourquoi).
2. **Livré et prouvé** : ce qu'on voit, écran par écran ; ce qui marche, parcours par parcours ; preuves.
3. **Ce que lui seul peut faire**, dans l'ordre, chacun avec la recommandation du conseil.
4. **À faire relire par un professionnel** (avocat, expert-comptable), sans le présenter comme bloquant.
5. **Au-delà** : ce qui a été livré en plus de la demande.
6. **Ensuite** : le sprint suivant, lancé immédiatement selon le protocole d'enchaînement.
</cloture>

---

## PROTOCOLE D'ENCHAÎNEMENT

1. Au début de toute session où le founder dit « go », « continue », « légion », « war room » : ouvrir ce fichier,
   prendre la première ligne du tableau de bord qui n'est pas ✅ (🟡 : reprendre depuis `sprints/Lx_HANDOFF.md`).
2. Un sprint ✅ déclenche immédiatement le suivant. On ne s'arrête que pour une décision du founder ; on pose la
   question une fois, avec la recommandation, et on continue tout ce qui n'en dépend pas.
3. Avant que le contexte ne sature : `sprints/Lx_HANDOFF.md` (fait, en cours, prochaine action, fichiers, bus).
4. Après L9 : le Scribe propose les sprints suivants au même format, le founder les valide.

---

## DÉCISIONS DU FOUNDER POUR LA PHASE 2, prêtes à poser

Chacune avec la recommandation du conseil. Le code de chaque sprint avance sans attendre : la fonction concernée est
construite, testée, et reste fermée en production par un drapeau tant que la décision n'est pas prise.

| # | Question | Recommandation du conseil | Bloque seulement |
|---|---|---|---|
| D1 | Apporteurs. (a) L'apporteur est-il payé sur une part de la commission Proofseen (A), par un frais en plus pour le client (B) ou par un prélèvement sur le freelance (C) ? (b) Quelle part : 20, 30 ou 50 % de la commission (2, 3 ou 5 % du HT au taux standard), pendant 12 mois sur le client apporté ? (c) Un taux réduit pour le freelance qui amène son propre client ? (d) Interdit-on par défaut les apporteurs salariés ou dirigeants du client ? | (a) A, le seul modèle qui ne touche aucun montant du contrat client-freelance ; (b) 30 % sur 12 mois si D10 retient le SEPA par défaut, sinon 20 % ; (c) oui, configurable ; (d) oui (risque de corruption privée, Code pénal 445-1 et 445-2, qualification NON CONFIRMÉE par un avocat). Chiffres : `tresor/L0_FLUX_ARGENT.md` §3. | l'ouverture du programme en production (L3) |
| D2 | Portage salarial : la loi réserve le portage à une entreprise dont c'est l'**activité exclusive**, avec garantie financière et déclaration préalable (L1254-24, L1254-27, R1254-3). E-KIGAI ne peut donc pas porter elle-même. Choisis-tu 1 à 3 sociétés de portage partenaires (modèle Malt), ou une filiale dédiée exclusivement au portage ? | Partenaires d'abord (aucun capital immobilisé, ouverture en semaines) ; filiale seulement si le volume le justifie. Comparatif de Sofia ; coûts de chaque côté dans `tresor/L0_FLUX_ARGENT.md` §5.2. | l'ouverture du portage (L4) |
| D3 | Signature : signature simple faite maison avec dossier de preuve et jeton d'horodatage qualifié acheté (quel prestataire), et API Youtrust (ex-Yousign) en option avancée pour les grands comptes ? | Oui aux deux, maison par défaut. Horodatage qualifié : comparatif de Sofia. Youtrust : bac à sable gratuit 40 jours, puis à partir de 104 EUR HT par mois (prix public lu le 2026-10-24). | la valeur probante maximale (L2), pas la signature elle-même |
| D4 | Plateforme agréée de facture électronique : la **réception** est déjà obligatoire depuis le 1er septembre 2026 pour la société qui exploite Proofseen. La War Room a choisi par délégation, le 2026-10-07, **Super PDP** (B2Brouter en remplaçant), la seule à documenter l'émission par un tiers sous mandat (TEAM_MEMORY). Confirmes-tu Super PDP, et as-tu ouvert le compte de réception ? | Confirmer Super PDP ; ouvrir le compte (toi seul) ; vérifier sa présence sur la liste officielle (Bertrand, vague 1 de L5). **Urgent côté réception**, indépendamment du code. | l'émission via PA (L5) |
| D5 | Qui paie la commission Proofseen : l'entreprise (frais de service, freelance à 0 %) ou le freelance (règle actuelle du code) ? À quel taux ? `ROADMAP.md:203` et ta décision du 2026-09-20 disaient « facturée à l'entreprise ». | L'entreprise, freelance à 0 % : seul modèle compatible avec le portage, plus de TVA non récupérable pour les freelances en franchise, et « 0 % pour le freelance, comme Free-Work, avec contrat, paiement sécurisé et facture » (`tresor/L0_FLUX_ARGENT.md` §6). Taux : 10 % ou 11,11 % (neutre pour le freelance). | l'ouverture du portage (L4 : un contrat porté se crée avec `feePayer = company`, risque L5321-3) ; ailleurs la règle actuelle continue jusqu'à décision |
| D6 | Relecture professionnelle : un avocat (gabarits, contrat d'apport, mandat de facturation, CGU de libération et de reprise) et un expert-comptable (plan de comptes, écritures, acompte, avoirs, FEC). | Avant l'ouverture réelle de L3 et L5 ; jamais bloquant pour le code. | l'usage réel des documents |
| D7 | GO DEPLOY, redemandé à chaque sprint, avec la liste des migrations et des nouvelles variables d'environnement (noms seulement, jamais les valeurs) que toi seul poses sur le VPS. | | la mise en production |
| D8 | Contrat mensuel : provision du mois libérée au CRA validé (A), paiement après le CRA (B), ou provision unique (C) ? | A | L8 |
| D9 | Litige perdu ou remboursement après versement au freelance : Proofseen reprend-il le virement (clause des CGU), absorbe-t-il la perte sous un plafond, ou les deux ? Aujourd'hui Stripe débiterait la plateforme du TTC entier plus 20 EUR de frais. | Reprise d'abord, perte absorbée sous un plafond que tu fixes, revue humaine au-delà. | le GO PAIEMENT LIVE |
| D10 | Moyen de paiement par défaut de l'entreprise : prélèvement ou virement SEPA, la carte en option ? Sur une mission de 10 000 EUR HT, la carte coûte 21 à 37 % de la commission, le SEPA environ 3 % (tarifs Stripe lus le 2026-10-24). | SEPA par défaut, carte permise, surcoût absorbé pendant la bêta puis réexaminé. | rien |
| D11 | Confirmes-tu le taux de fidélité de 5 %, aujourd'hui écrit dans le code comme valeur de repli (décision prise par délégation), ou le fermes-tu sans variable comme le taux principal ? | À trancher avec D5. | rien |
| D12 | Seuils de l'apporteur : plafond annuel de commission par client apporté, délai de garde avant versement, versement minimal. | Valeurs proposées par Camille (§7 de son document), à revoir après lecture des délais de contestation chez Stripe. | L3 |
| D13 | Demandes-tu un rescrit (LPF L80 B) sur la qualification « consignation » des fonds retenus jusqu'à la validation (TVA du freelance due à la libération, sans facture d'acompte) ? | CGU écrites en consignation, validées par l'expert-comptable (D6) ; rescrit seulement s'il le conseille (`tresor/L1/compta/REPONSES_L1.md`). | rien |
| D14 | Clé de chiffrement au repos du coffre et des dépôts : la poses-tu toi-même dans `.env.production` au prochain GO DEPLOY ? | Oui, générée par toi, jamais vue par la Légion. D'ici là le coffre reste fermé en production (`PROOFSEEN_VAULT_OPEN` absent). | l'ouverture du coffre |
| D15 | Copie des sauvegardes hors du VPS (aujourd'hui la base et le volume des dépôts sont sauvegardés sur la même machine) : quel stockage externe ? | Un stockage objet en Europe, chiffré, avec rétention 30 jours ; comparatif à préparer. | rien, mais un incident disque perdrait tout |

---

## L1, LE COFFRE : MOTEUR DE DOCUMENTS · ouvert à la clôture de L0, durée cible deux semaines

**Dépend de** : L0 (recherche, flux d'argent de Camille, concept de Shogun) ; aucune décision du founder.
**Peut tourner en parallèle de** : aucun autre sprint L pour les pistes A et B (L1 pose le socle de tous) ; la piste T
de L2 (texte du consentement et page de preuve, Inès) et de L3 (contrat d'apport) peut commencer pendant la vague 2 de
L1 ; les décisions D1 à D12 se posent au founder pendant L1, D4 dès le premier jour.

<mission>
Faire exister en vrai chaque document d'une affaire : généré depuis un gabarit versionné, rendu en PDF, empreint
(SHA-256 des octets exacts conservés), rangé dans le coffre de l'affaire, comparable version à version.
Pourquoi maintenant : aujourd'hui un contrat Proofseen n'a **aucun document** (un clic daté par partie, aucune
clause rendue) ; sans document, il n'y a ni signature électronique (L2), ni contrat d'apport (L3), ni portage (L4).
Contre qui : Malt contractualise, Docusign et Youtrust signent ; aucun, à notre connaissance (NON VÉRIFIÉ, à
confirmer en veille), ne relie le document signé aux faits vérifiés du profil. Ce qui change pour l'utilisateur : il télécharge son contrat, sait quelle version est la bonne, et voit ce
qui a changé entre deux versions.
</mission>

<contexte_a_charger>
1. Bloc commun ci-dessus, puis `research/LEGENDS_P2_REGLEMENTAIRE.md` §3 (preuve) et §4.5 (mentions).
2. `packages/db/prisma/schema.prisma` : Contract (snapshots vendeur et acheteur, `acceptedByFreelanceAt`,
   `acceptedByOrgAt`), Quote, Invoice, Payment ; `packages/db/src/contracts.ts`, `contract-view.ts`, `contract-checks.ts`.
3. `packages/invoicing/src/render.ts` (rendu HTML et `missingMentions`), `cii.ts`.
4. Le stockage de fichiers existant (photos, CV, pièces jointes de messages, C15) : le coffre le réutilise.
5. `apps/web/src/app/[lang]/app/contrats/[id]/page.tsx` et `components/market/DealThread.tsx`.
6. `.war-room/design/LEGENDS_P2_CONCEPT.md` (Shogun) : §A.3 (poinçon d'empreinte, calcul et accessibilité), §A.5
   (couleurs de la comparaison, jamais de vert pour un ajout), §B.7 (arborescence et contrats des primitives), §D.3
   (coffre rangé par affaire, comparaison par clause), §D.4 (données à créer).
7. `.war-room/tresor/L0_FLUX_ARGENT.md` §0 (constats K1 à K10) et §1 (montants, arrondi, faits générateurs).
8. `apps/web/test/seal.test.ts` (allowlist du vert) et `apps/web/test/legal-pages.test.ts` (services nommés).
</contexte_a_charger>

<equipe>
- **Piste A** (`architect` puis `tdd-guide`, relu par `database-reviewer`) : nouveau paquet `packages/documents`
  (gabarits, rendu, empreinte), modèles et migrations dans `packages/db`, API `apps/web/src/app/api/documents/`.
- **Piste T** : `tresor-juriste` écrit les gabarits v1 dans `.war-room/tresor/L1/templates/` (structure, variables,
  clauses verrouillées et optionnelles, sources) ; `tresor-comptable` vérifie les mentions de tout document chiffré.
- **Piste B** (`katana-sensei`, `katana-sumi`, `katana-tetsu`, `katana-kaze`) : écrans du coffre dans
  `components/vault/` et le poinçon d'empreinte (`components/proof/Hallmark.tsx`, calcul pur dans
  `apps/web/src/lib/viz/hallmark.ts`). Sumi possède la forme, Tetsu le calcul et le code.
- **Piste C** (`katana-tetsu`, relu par `katana-mamori`) : primitives partagées avec la future Tour, dans
  `components/ui/` selon le concept §B.7 (`ui/table/DataTable`, `ui/filter/FilterBar`, `ui/inspector/Inspector`,
  `ui/kpi/KpiTile`, `ui/data/Money`, `ui/status/StateMark`) et `components/tower/journal/AuditTimeline.tsx`. Tetsu
  écrit la piste B et la piste C : aucun conflit, mais deux contrats de passation distincts.
- Fichiers partagés, modifications ciblées annoncées dans le bus : `schema.prisma` (piste A seule), i18n (piste B
  seule), `seal.test.ts` (piste B seule).
- Conseil : Maxwell tranche la bibliothèque PDF ; Camille relit les gabarits chiffrés ; Shogun relit le coffre et a le
  veto sur le poinçon d'empreinte.
</equipe>

<a2a>
- Vague 0 : Maxwell écrit dans le bus le `REQUEST` « choix du moteur PDF » à `architect`, critères : JavaScript pur
  (aucun Chromium dans le conteneur `node:22-bookworm-slim`), polices de la marque embarquées, **sortie
  déterministe** (mêmes données, mêmes octets, donc même empreinte), pièces jointes possibles (Factur-X en L5),
  poids, **licence libre** (une licence payante ou à usage restreint remonte au founder). `ANSWER` attendu avec un
  essai mesuré (temps de rendu, octets, deux rendus comparés au SHA-256), pas une opinion.
- Vague 0 : Shogun → Sumi : `REQUEST` du prototype du poinçon d'empreinte lisible à 16, 32 et 96 px (concept §I,
  RISK « ornement illisible ») ; Tetsu ne code pas `Hallmark.tsx` avant l'`ANSWER` avec les captures.
- Vague 1 : Maxwell → Shogun et piste A : `ANSWER` à L0-024 (modèle de données du coffre, concept §D.4, et chaîne
  d'empreintes publique, §G.1 point 3, avec coût, clé et rotation) avant toute migration du coffre.
- Vague 1 : piste A → `tresor-juriste` : `REQUEST` du format de gabarit ; Inès répond par le premier gabarit
  complet (contrat de prestation) avant toute implémentation du rendu.
- Vague 1 : piste A → Bertrand : `REQUEST` de la question de l'acompte (K5, CGI 269 et 289 I-1, reprise de L0-010
  point 1) ; L1.0 K5 code seulement la mention « acquittée » tant que l'`ANSWER` sourcée n'est pas là.
- Vague 1 : piste A → Inès : `REQUEST` de la durée de conservation de chaque type de document et du sort d'un
  document à l'effacement RGPD d'une partie (une facture se garde, un brouillon non).
- Vague 2 : piste A → Tetsu et Sensei : `HANDOFF` du modèle de lecture du coffre (versions, empreintes, états vide,
  en cours, erreur) ; aucun écran avant.
- Vague 3 : `CHALLENGE` obligatoires de Bertrand (mentions), de Thomas (accès aux documents d'une autre partie),
  de Kensa (écrans), de `security-reviewer` sur K2 (un virement qui consomme la charge d'un autre contrat).
</a2a>

<livrables>
L1.0 **Dettes du flux d'argent, avant tout ajout** (constats de Camille, `tresor/L0_FLUX_ARGENT.md` §0, porte du
     Trésor FAIL pour un GO PAIEMENT LIVE tant qu'elles restent) :
     - **K2, CRITIQUE** : `transfer()` (`packages/payments/src/stripe.ts:114`) n'envoie pas `source_transaction` ;
       le virement est pris sur le solde commun. Enregistrer la charge (`latest_charge`) au paiement réussi et la
       passer à chaque virement. Critère : test qui vérifie `source_transaction` égal à la charge du contrat, et
       test qu'un virement vers A ne peut pas consommer la charge de B.
     - **K3, HAUT** : figer `commissionBp` et `feePayer` sur `Contract` à sa création (trigger comme
       `repeatClient`) ; `open()` lit le contrat, plus l'environnement (`api/contracts/[id]/payment/route.ts:40`).
       Critère : test d'un changement de taux après signature qui ne change rien au contrat signé.
     - **K5, HAUT** : facture émise après paiement : mention « acquittée le … par paiement sécurisé Stripe »,
       échéance égale à la date de paiement, aucune pénalité de retard imprimée. La question de l'acompte (CGI 269,
       289 I-1) est un `REQUEST` à Bertrand (L0-010), codée seulement après son `ANSWER` sourcée. Critère : test de
       `render.ts` qui refuse une facture payée portant une échéance postérieure au paiement ou des pénalités.
     Les factures déjà émises ne se modifient pas (trigger) : la correction vaut pour les nouvelles.
L1.1 **Gabarits typés** : un gabarit = identifiant, version, langue, schéma zod des variables, clauses (verrouillée,
     optionnelle, conditionnelle), sources. Critère : un gabarit dont une variable obligatoire manque ne rend pas
     (`renderTemplate` renvoie une erreur nommée, testée) ; une clause verrouillée ne peut pas être retirée (test).
L1.2 **Rendu PDF déterministe** : deux rendus des mêmes données donnent la même empreinte SHA-256 (test, y compris
     sur deux processus différents et sur le conteneur `node:22-bookworm-slim` du VPS) ; polices de la marque
     embarquées ; texte sélectionnable ; métadonnées (titre, auteur, date) remplies depuis les données ; chaque page
     porte en pied le poinçon d'empreinte à 16 px, les seize premiers caractères de l'empreinte et l'adresse de
     vérification (concept §D.2). Un PDF ne peut pas contenir sa propre empreinte : l'architecte écrit dans le bus
     ce qui est empreint (contenu canonique avant pied de page, ou PDF entier avec empreinte imprimée au dossier de
     preuve seulement), et `/verifier` (L2.7) applique la même règle. Critère : test du pied de page et de la règle.
L1.3 **Modèle de données du coffre** : `Document` (affaire, type, gabarit et version), `DocumentVersion` (numéro,
     empreinte, clé de stockage, taille, auteur, date ; **immuable** par trigger comme `Invoice`), lien vers contrat,
     devis, organisation ou profil, journal d'accès en ajout seul. Critère : test qui prouve qu'une version ne se
     modifie pas et qu'une partie étrangère à l'affaire reçoit 404 (autorisation par objet).
L1.4 **Gabarits v1** (Inès, mention de relecture tant que D6 n'est pas faite) : contrat de prestation (depuis
     Contract et ses snapshots), devis, procès-verbal de recette, NDA, avenant. Critère : chaque gabarit rendu sur
     les données du parcours de test réel (contrat de 500 EUR HT du 2026-10-21) et relu par Inès dans le bus.
L1.5 **Dates manquantes** : `Payment.heldAt` et `Quote.acceptedAt` (migration, renseignées par les chemins
     existants, nulles pour l'historique, jamais devinées). Critère : tests de `payments` et `quotes` qui les lisent.
L1.6 **Écrans du coffre** (`components/vault/`) : documents rangés par affaire (concept §D.3), versions en strates,
     aperçu, téléchargement, **comparaison de deux versions** clause par clause (ajout souligné et « + » en marge,
     retrait barré et « − », clause modifiée marquée du mot « Modifiée » ; **aucun vert pour un ajout**, concept §A.5),
     empreinte en PS Mono groupée par quatre. Critère : parcours joué dans un vrai navigateur, accessibilité 1, liste,
     téléchargement et comparaison lisibles sans JS, capture regardée, `seal.test.ts` vert sans nouvelle entrée.
L1.7 **Poinçon d'empreinte** : `lib/viz/hallmark.ts` (fonction pure, bits vers géométrie) et `Hallmark.tsx` (SVG
     serveur, `role="img"`, nom accessible qui porte l'état en mots). Critère : tests sur vecteurs fixes ; deux
     empreintes qui diffèrent d'un bit d'entrée donnent deux dessins différents (test) ; vert seulement à l'état
     poinçonné lu en base (entrée triée dans `seal.test.ts` en L2, pas avant).
L1.8 **Primitives de la Tour** (piste C, `components/ui/`, contrats du concept §B.7) : DataTable (`<table>` réel,
     tri par lien GET choisi par l'utilisateur, jamais par un modèle ni par un score de personne ; pagination au-delà
     de 50 lignes), FilterBar (formulaire GET), Inspector (`?voir=` dans l'adresse), KpiTile (sans tendance tant que
     l'historique n'est pas stocké), Money (centimes vers texte, aucun calcul), AuditTimeline. Critère : tests de rendu
     serveur et d'accessibilité, fonctionnement sans JS prouvé, utilisées par le coffre.
</livrables>

<vagues>
Vague 0 cadrage, choix du moteur PDF, prototype du poinçon (Sumi) · Vague 1 L1.0 (dettes K2, K3, K5, d'abord et
seules), gabarit pilote (Inès), modèle de données relu par `database-reviewer` · Vague 2 rendu, coffre, API, poinçon,
primitives et écrans en parallèle (écrans seulement après le HANDOFF de la piste A) · Vague 3 revues et red team
(accès croisé, document d'une affaire étrangère, version modifiée en base, virement sur la charge d'un autre contrat)
· Vague 4 gate VPS sur clone propre, parcours réel sur le contrat de 500 EUR HT du 2026-10-21 · Trois portes ·
Clôture.
</vagues>

<pieges>
- Un rendu non déterministe (date de génération dans le PDF, ordre d'objets) casse l'empreinte : la date vient des
  données, jamais de l'horloge au moment du rendu.
- Un document est une donnée personnelle (noms, adresses, SIRET) : chiffré au repos, jamais dans les journaux,
  couvert par l'export et l'effacement RGPD (C6) ; durée de conservation écrite (factures électroniques : 6 ans,
  recherche §4.1 ; pièces comptables : 10 ans selon le Code de commerce L123-22, **non relu**, recherche §7.1, à
  confirmer par Bertrand avant d'être codé).
- Le stockage existant est le volume `proofseen-uploads` du VPS (2026-10-15) : le coffre s'y range, et la sauvegarde
  nocturne de 14 jours (C24) doit le couvrir ; le dire dans le compte rendu, preuve à l'appui.
- L'effacement RGPD refuse déjà la suppression d'un compte avec un contrat ou un paiement en cours (2026-10-06) : le
  coffre garde cette règle, et une facture n'est jamais effacée avec le compte.
- Échappements corrompus par script (bloc commun) : les gabarits s'écrivent avec Edit et Write.
- Le vert d'un document n'existe pas en L1 : aucun document n'est encore signé. Le poinçon reste au filet.
</pieges>

<decisions_founder>
Aucune bloquante. À poser à la clôture, sans bloquer :
- D6 (relecture des gabarits v1 par un avocat).
- « La clé de chiffrement des documents est une nouvelle variable de production : la poses-tu toi-même dans
  `.env.production` au prochain GO DEPLOY ? » Recommandation : oui, générée par le founder, jamais vue par la Légion ;
  sans elle le coffre reste fermé en production (drapeau).
- Si `architect` ne trouve aucun moteur PDF libre qui tient les critères : « accepte-t-on la licence X à tel coût ? »,
  avec l'essai mesuré.
</decisions_founder>

<au_dela>
- **Factur-X dès L1** si le moteur PDF le permet sans coût : la facture devient un PDF lisible qui contient sa CII
  (avance sur L5), prouvée par l'extraction de la CII depuis le PDF dans un test.
- **Le document parle au profil** : un contrat signé et payé relie son empreinte au fait vérifié du profil (concept M3,
  généalogie d'une preuve) ; le registre public peut dire « adossé à un contrat signé le … » sans rien révéler du
  contrat.
- **La comparaison qui parle** : en tête de la comparaison, une phrase par variable changée pour chaque partie (« le
  TJM passe de … à … EUR HT, la date de fin du … au … »), calculée depuis les variables du
  gabarit, sans modèle de langage. Docusign et Youtrust comparent des pixels ou rien (à confirmer en veille, page
  publique datée).
- **Un contrat reconnaissable imprimé** : le poinçon d'empreinte en pied de chaque page permet de reconnaître à l'oeil
  deux versions d'un même contrat posées sur une table. Preuve : deux PDF imprimés, capture regardée.
</au_dela>

<definition_of_done>
- [ ] L1.0 : les trois tests de K2, K3 et K5 rouges sur `origin/main`, verts sur la branche (sorties collées).
- [ ] L1.1 à L1.8 livrés, chacun avec son critère prouvé (sortie de test, capture, réponse HTTP).
- [ ] Empreinte identique pour deux rendus faits sur le VPS et sur le poste (sortie de `sha256sum` collée).
- [ ] Migrations relues par `database-reviewer`, nombre et noms dans le compte rendu.
- [ ] Revues `typescript-reviewer` et `security-reviewer` sans CRITIQUE ni HAUT ouvert.
- [ ] Gate VPS vert sur clone propre, couverture ≥ 80 % sur `packages/documents` et `lib/viz/hallmark.ts`.
- [ ] Trois portes rendues par écrit ; bus fermé sans REQUEST ni CHALLENGE ouvert.
</definition_of_done>

<cloture>
Interdits propres à L1, cochés en tête : aucune clause générée par un modèle de langage ; aucun document réel d'un
client dans les tests ni dans le dépôt ; aucun vert sur un document non signé. Puis format du bloc commun.
Enchaîner sur L2.
</cloture>

---

## L2, LE SCEAU : SIGNATURE ÉLECTRONIQUE ET DOSSIER DE PREUVE · ouvert à la clôture de L1, durée cible deux semaines

**Dépend de** : L1 (coffre, versions immuables, rendu déterministe, poinçon d'empreinte, primitives) ; D3 seulement
pour le jeton d'horodatage qualifié en production (la signature elle-même n'attend rien).
**Peut tourner en parallèle de** : la piste T de L3 (contrat d'apport, déclaration de conflit d'intérêts, à signer par
le Sceau) et de L4 (comparatif des sociétés de portage de Sofia, règles de Nadia) ; L6 démarre à la clôture de L2.

<mission>
Remplacer le clic d'acceptation par une vraie signature électronique simple, faite maison, dont le dossier de preuve
tient devant un juge, et en faire un moment que l'on a envie de vivre.
Pourquoi : le Code civil (1366, 1367) ne présume fiable que la signature qualifiée ; pour une signature simple,
c'est à celui qui s'en prévaut de prouver identification et intégrité : tout se joue dans le dossier de preuve.
Contre qui : Youtrust vend la signature à l'abonnement et à l'unité au-delà du forfait (recherche §3.5), Docusign
passe par un plan payant en production (prix NON CONFIRMÉ, même section) ; ce que Malt montre de la preuve d'un contrat est NON VÉRIFIÉ (relevé à la main par le founder). Ce qui change :
chaque signataire reçoit un document scellé, une page de preuve, et peut vérifier à tout moment que son exemplaire
est intact.
</mission>

<contexte_a_charger>
1. Bloc commun, puis `research/LEGENDS_P2_REGLEMENTAIRE.md` §3 en entier (niveaux, dossier de preuve, construire ou
   acheter, prestataires et prix publics).
2. Passation de L1 (coffre, versions, empreintes) ; `packages/db/src/contracts.ts` (`sign()`, passage à `active`).
3. `packages/notify` (envoi des courriels) ; `apps/web/src/lib/operator-access.ts` (limitation de débit).
4. `BillingIdentity.invoicingMandateAt` (`packages/db/src/billing.ts`, `components/market/BillingForm.tsx`).
5. `.war-room/design/LEGENDS_P2_CONCEPT.md` §A.4 (états d'un document), §A.6 (scénario `/verifier`), §D.1
   (storyboard seconde par seconde), §D.2 (dossier de preuve et ses points À SOURCER par Inès), §C.1 V8 et V11.
6. Le motif des invitations (C23, `packages/db/src/invitations*`, 2026-10-19) : jeton à usage unique dont seule
   l'empreinte est gardée, échéance, plafonds, et « un lien ne suffit pas » ; le lien de signature le reprend.
7. `apps/web/src/components/proof/StrikeOnce.tsx`, `Seal.tsx` et `packages/brand/seal.css` (la frappe existante).
</contexte_a_charger>

<equipe>
- **Piste A** (`architect`, `tdd-guide`, `security-reviewer` dès la conception) : `packages/signature`
  (interface `SignatureProvider`, prestataire maison, adaptateur Youtrust derrière drapeau, interface
  `TimestampAuthority` RFC 3161 avec adaptateur de test), modèles `SignatureRequest`, `SignatureEvent` (journal
  chaîné), `SignatureEvidence`.
- **Piste T** : `tresor-juriste` (texte du consentement, page de preuve, niveau par document, CGU) ;
  `tresor-conformite` (OTP, usurpation, rejeu) ; `tresor-partenariats` (comparatif horodatage qualifié et Youtrust).
- **Piste B** (Sensei, Kaze, Tetsu, Sumi) : la cérémonie (`components/ceremony/`), la page de preuve et l'état de
  chaque signataire (`components/vault/SignerList.tsx`, `EvidenceFile.tsx`), la page `/verifier`
  (`components/vault/VerifyDrop.tsx`, seul îlot client, cible 3 Ko compressés, concept §C.2).
- Conseil : Maxwell et Thomas ont un veto conjoint sur tout ce qui touche l'OTP et le journal ; Shogun sur la
  cérémonie et `/verifier`.
</equipe>

<a2a>
- Vague 0 : `RISK` obligatoire de `security-reviewer` sur le modèle de menace (vol de session, OTP intercepté,
  rejeu, signature pour autrui dans une organisation, document modifié après signature, horloge serveur).
- Vague 1 : piste A → Inès : `REQUEST` du texte exact du consentement, du contenu de la page de preuve, et des
  points À SOURCER du concept §D.2 (niveau visé par type de document, IP et agent utilisateur au dossier au regard de
  la minimisation, durée de conservation du dossier) ; pas de code d'écran avant l'`ANSWER`.
- Vague 1 : piste A → Sofia : `REQUEST` du comparatif horodatage qualifié (liste de confiance ANSSI, API, prix
  publics, page publique lue à la main et datée) pour préparer D3.
- Vague 0 : Victoria → Shogun : `ANSWER` à L0-023 (gribouillis de signature au doigt, que Shogun coupe, concept
  §G.2, et priorité de `/verifier` dans L2) avant le storyboard définitif.
- Vague 0 : le Chancelier relit l'`ANSWER` de Maxwell à L0-024 (rendue en L1) sur la chaîne d'empreintes publique
  quotidienne (concept §G.1 point 3 : coût, clé, rotation) ; si elle est oui, la chaîne entre en au-delà de ce sprint.
- Vague 2 : piste A → Kaze et Tetsu : `HANDOFF` des états de la cérémonie (lecture, consentement, code envoyé, code
  faux, code expiré, signé, refusé, expiré, en attente d'un autre signataire).
- Vague 3 : `CHALLENGE` de Thomas (red team signature) et de Kensa (cérémonie image par image).
</a2a>

<livrables>
L2.1 **Demande de signature** : document (version exacte du coffre), signataires ordonnés ou parallèles, échéance,
     relances (nombre et intervalle dans un fichier de règles). Critère : une demande sur une version que le coffre a
     remplacée est refusée (test) ; une signature vaut pour une empreinte : si la version 4 remplace la 3 signée par
     une partie, la 3 n'engage pas la 4 et l'écran le dit (test, concept §D.3).
L2.2 **Signature simple maison** : lecture du document (empreinte affichée), consentement explicite, code à usage
     unique par courriel (durée de vie et nombre d'essais dans un fichier de règles, codes stockés hachés), IP et
     agent utilisateur (selon l'`ANSWER` d'Inès), horodatage serveur ; journal « version N affichée à cette personne
     le … » (concept §D.1). Un signataire sans compte arrive par un lien à usage unique dont seule l'empreinte est
     gardée (motif des invitations). Critère : tests du code faux, expiré, rejoué, d'un signataire qui n'est pas le
     destinataire, d'un membre d'organisation sans droit de signature (seuls propriétaires et administrateurs
     engagent l'entreprise, règle du 2026-10-08), d'un lien rejoué après usage, et d'un code jamais présent en clair
     en base ni dans un journal.
L2.3 **Journal chaîné** : chaque événement porte l'empreinte du précédent ; `verifyChain` détecte toute altération.
     Critère : test qui modifie un événement en base et voit la vérification échouer.
L2.4 **Horodatage RFC 3161** derrière `TimestampAuthority` : adaptateur de test en développement ; prestataire
     qualifié branché quand D3 est prise. Critère : le jeton est vérifié contre l'empreinte (test).
L2.5 **Document scellé et page de preuve** : nouvelle version du coffre = PDF signé + page de preuve (signataires,
     dates, empreintes, méthode, niveau « signature électronique simple », jamais « qualifiée ») ; dossier de preuve
     téléchargeable (PDF lisible par un juge et JSON lisible par une machine, mêmes faits, avec la marche à suivre pour
     vérifier soi-même, concept §D.2) ; copie envoyée à chaque partie. Critère : capture regardée ; test qui compare
     les faits du PDF et du JSON ; test qui refuse les mots « qualifiée » et « valeur juridique garantie ».
L2.6 **Contrats et mandat passent par le Sceau** : un nouveau contrat devient `active` quand la demande de
     signature est complète ; les contrats existants gardent leur historique (aucune réécriture) ; le mandat de
     facturation devient un document signé (les mandats déjà acceptés gardent leur date ; le sort de ces mandats est
     une question à Inès en vague 1). Critère : tests de `contracts` et `billing` mis à jour, parcours réel entre les
     deux comptes de test du 2026-10-21, le founder basculant lui-même d'un compte à l'autre.
L2.7 **`/verifier`** (concept §A.6, le scénario d'ouverture) : page publique où l'on dépose un PDF que le navigateur
     **ne téléverse jamais** : l'empreinte est calculée sur place (`crypto.subtle.digest`), seules ses 64 lettres
     partent au serveur ; la réponse dit seulement si elle correspond à une version scellée, sa date, son numéro de
     version et le nombre de signataires, jamais un nom. Sans JS : un champ où coller l'empreinte imprimée en pied de
     page. Limitée en débit ; Lighthouse mobile ≥ 0,95 sur le VPS. Indexation : `noindex` pour toute réponse, la page
     d'accueil de `/verifier` indexable si Shogun et Elias Voss le décident par écrit. Critère : tests d'un PDF intact,
     modifié d'un octet, inconnu ; test réseau qui prouve qu'aucun octet du PDF ne part (requête inspectée).
L2.8 **La cérémonie** (Katana Forge, storyboard du concept §D.1) : lire, consentir, recevoir le code, apposer le
     sceau ; deux cases jamais précochées ; frappe du poinçon d'empreinte en vert **seulement à la dernière
     signature**, une fois, sur un événement lu en base, jamais au rechargement ni à la première visite ; mouvement
     réduit respecté ; aucun tremblement sur un code faux. Critère : porte du chef-d'œuvre, accessibilité 1, parcours
     au clavier complet, parcours sans JS complet, entrée triée ajoutée dans `seal.test.ts` pour le document poinçonné.
L2.9 **Mesure** : date de passage d'une candidature à `hired` (migration, nulle pour l'historique, jamais devinée) ;
     temps entre « mission choisie » et « contrat signé des deux côtés » dans l'entonnoir existant (médiane, n et
     période écrits, jamais par personne). Critère : test de la commande `funnel` sur deux affaires de test.
</livrables>

<vagues>
Vague 0 modèle de menace (`security-reviewer`), position de Victoria (L0-023) · Vague 1 textes juridiques (Inès),
comparatif horodatage (Sofia), modèle de données relu · Vague 2 moteur, API, cérémonie, `/verifier` en parallèle (écrans après
le HANDOFF des états) · Vague 3 red team signature (Thomas, `security-reviewer`) et inspection image par image
(Kensa) · Vague 4 parcours réel deux comptes, Lighthouse de `/verifier` sur le VPS · Portes · Clôture.
</vagues>

<pieges>
- Ne jamais écrire « eIDAS qualifiée » ni « valeur juridique garantie » (rapport §3.6 ; aucune promesse).
- Le bac à sable Youtrust produit des signatures sans valeur et limite à 30 requêtes par minute : ses tests E2E se
  font sur un faux, jamais en boucle sur l'API.
- La frappe du poinçon : uniquement sur un fait lu en base (règle de la refonte connectée, `StrikeOnce`, 2026-10-23).
- Courriels : aucun code ni lien de signature dans les journaux ; un antivirus de messagerie suit les liens
  (2026-10-19) : ouvrir le lien n'est jamais signer, la signature exige le code et le geste.
- Un horodatage qualifié est un service externe : il entre dans la page de confidentialité avant tout appel
  (`legal-pages.test.ts`, bloc commun).
- `/verifier` est une page publique : Clerk n'y est jamais chargé (perf 0,46 le 2026-10-24), et rien n'y est caché
  sans JS.
</pieges>

<decisions_founder>
- D3 : « Quel prestataire d'horodatage qualifié achètes-tu, et veux-tu l'option Youtrust pour les grands comptes ? »
  Recommandation et prix : comparatif de Sofia (pages publiques datées). Le Sceau fonctionne sans, avec l'adaptateur
  de test ; en production, le jeton qualifié s'ajoute dès la décision. Ouvrir le compte chez le prestataire reste un
  geste du founder (règle absolue 5).
- D6 à la clôture : relecture du texte du consentement et de la page de preuve.
</decisions_founder>

<au_dela>
- **Le contrat qui se vérifie sans nous demander la permission** : un inconnu dépose un PDF sur `/verifier`, sans
  compte, sans téléversement, et voit une virgule changer le dessin du poinçon. Aucune plateforme freelance ne le
  propose à la connaissance du concept (à confirmer en veille, page publique datée). Preuve : vidéo ou suite de
  captures du parcours, et la requête réseau qui ne contient que l'empreinte.
- **La chaîne d'empreintes publique** si Maxwell la valide : chaque jour, l'empreinte racine des événements de
  signature est publiée ; le registre ne peut plus se réécrire en silence, même par Proofseen.
- **Signer depuis le téléphone** dans l'application installable (C20), avec la même preuve, joué sur un vrai
  téléphone.
- **Le chiffre qui dit si on gagne** : le délai entre « mission choisie » et « signé des deux côtés » mesuré sur le
  parcours réel et montré au founder, sans promesse sur sa valeur future.
</au_dela>

<definition_of_done>
- [ ] L2.1 à L2.9 prouvés ; red team signature fermée ; `security-reviewer` sans CRITIQUE ni HAUT.
- [ ] Parcours réel : un contrat signé par les deux comptes de test, dossier de preuve téléchargé et relu par Inès.
- [ ] `/verifier` mesuré sur le VPS (Lighthouse collé) et prouvé sans téléversement (requête collée).
- [ ] Page de confidentialité à jour si un service externe a été ajouté, test vert.
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L2, cochés en tête : jamais « qualifiée », « eIDAS qualifiée » ni « valeur juridique garantie » ;
jamais une signature apposée à la place d'une personne, y compris par un opérateur ; aucun code ni lien dans un
journal. Puis format du bloc commun. Enchaîner sur L3 ; L6 démarre en parallèle (piste B libre).
</cloture>

---

## L3, LES APPORTEURS : ESPACE PORTEURS D'AFFAIRES · ouvert à la clôture de L2, durée cible deux semaines

**Dépend de** : L1 (L1.0 : `source_transaction` et taux figé, sans lesquels la commission d'apporteur n'a pas de
chemin ; gabarits), L2 (signature du contrat d'apport et de la déclaration de conflit d'intérêts) ; décisions D1 et
D12 pour l'ouverture en production, D10 qui oriente D1-b, D5 si elle change l'assiette, D6 pour l'usage réel des
contrats. Le code avance sans elles, fermé par drapeau.
**Peut tourner en parallèle de** : L6 (piste B de la Forge sur les figures dont la donnée existe) ; la piste T de L4
(règles de Nadia, comparatif de Sofia) et de L5 (mentions de Bertrand).

<mission>
Permettre à quiconque d'amener sur Proofseen la mission d'une autre entreprise et d'être payé pour cela, avec un
contrat d'apport signé, une attribution protégée et horodatée, une commission calculée sur un fait réel et versée
par la plateforme, sans jamais toucher au prix entre le client et le freelance.
Pourquoi : chaque apporteur est un commercial que Proofseen ne paie qu'au succès ; c'est un canal d'acquisition
d'entreprises. Malt a un programme d'apport (5 % du facturé pendant un an selon `research/CONQUETE_PARITE.md:268`,
À VÉRIFIER à la main, Camille §3.2) ; aucun programme équivalent n'a été trouvé chez Free-Work. Proofseen gagne par
la transparence : attribution prouvée, calcul écrit, client informé. Ce qui change : un consultant, un ancien
salarié, un freelance qui connaît un besoin devient un partenaire, voit son pipeline et son argent arriver.
</mission>

<contexte_a_charger>
1. Bloc commun, `research/LEGENDS_P2_REGLEMENTAIRE.md` §1 en entier (qualification, clauses, DAS2 à 2 400 EUR,
   corruption privée, RGPD art. 14), §7.2 (compte 6222).
2. `.war-room/tresor/L0_FLUX_ARGENT.md` (Camille) : P2 (mission apportée, au centime), §3.1 à §3.4 (modèles,
   options chiffrées, durée, plafonds, cas limites, **règle testable du fait générateur**), §4 (grand livre : schéma,
   événements, rapprochements), K4 (échéances de facturation).
3. Bus L0 : L0-010 (REQUEST à Bertrand : acompte, avoir sous mandat, TVA des frais Stripe, plan de comptes) et L0-011
   (REQUEST à Inès : clauses d'argent du contrat d'apport) ; leurs `ANSWER` sont dus en vague 1 de ce sprint.
4. `.war-room/design/LEGENDS_P2_CONCEPT.md` §E.1 (l'apport se fait confirmer par l'entreprise apportée, écrans,
   interdits) et §C.1 V5 (couloirs d'apports).
5. Passations de L1 et L2 (gabarit et signature du contrat d'apport et de la déclaration de conflit d'intérêts).
6. `packages/db/src/payments.ts` (`release()`), `invoices.ts`, `apps/web/src/data/payments-config.ts`,
   `packages/payments/src/connect.ts` (comptes destinataires Accounts v2, `entity_type` ligne 28), le contrôle de
   registre (SIRET actif, `mismatch` bloquant depuis le 2026-10-08).
7. `apps/web/src/lib/roles.ts`, `lib/session.ts` (rôles dans Clerk `publicMetadata.role`).
</contexte_a_charger>

<equipe>
- **Piste A** : rôle `introducer` (cumulable avec freelance), modèles `Introducer`, `Introduction`,
  `IntroducerCommission`, et le **grand livre interne en partie double** (`LedgerEntry`, immuable, montants en
  centimes, alimenté par les événements du flux d'argent), selon la recommandation de Camille.
- **Piste T** : `tresor-juriste` (contrat d'apport, déclaration de conflit d'intérêts, texte de transparence),
  `tresor-comptable` (facturation de l'apporteur : autofacturation sous mandat s'il est assujetti, relevé s'il est
  particulier, compteur DAS2, TVA), `tresor-conformite` (contrôles et red team), `tresor-partenariats` (offre,
  activation, page d'explication), `tresor-cfo` (porte du Trésor).
- **Piste B** (`components/referral/`, concept §E.1) : espace apporteur (déposer un apport, mes apports, mon relevé),
  page publique `/apporteurs` qui présente le programme (aucun taux tant que D1 n'est pas prise : « taux à fixer »),
  page de confirmation de l'entreprise apportée.
- Fichiers partagés : `schema.prisma` et les migrations à la piste A seule ; `payments.ts` et `invoices.ts` à la piste
  A seule (L3.0 et L3.4 s'y touchent : un seul agent, `tdd-guide`, les deux lots en série).
- Conseil : Camille a le veto sur tout le flux ; Victoria sur l'offre ; Shogun sur `/apporteurs`.
</equipe>

<a2a>
- Vague 0 : Thomas écrit les `RISK` : auto-apport, faux apporteur, double déclaration d'un même client, apporteur
  salarié du client, contournement hors plateforme, collusion apporteur-freelance.
- Vague 1 : piste A → Camille : `ACK` de la règle testable de son §3.4 (déjà écrite) ou `CHALLENGE` si le code la
  contredit ; piste A → Bertrand : `REQUEST` des écritures de chaque événement (naissance, versement, annulation,
  avoir) et `ANSWER` attendue à L0-010 ; aucun code du grand livre avant elle.
- Vague 1 : piste A → Inès : `ANSWER` attendue à L0-011 (naissance, délai de garde, compensation, suspension) et
  `REQUEST` sur la base légale de toute coordonnée d'un tiers saisie par l'apporteur (RGPD art. 14, recherche §1.4,
  interprétation à valider ; rejoint L0-020 de Shogun) ; tant que l'`ANSWER` n'est pas là, le parcours par défaut est celui du concept §E.1
  (lien d'invitation, aucune coordonnée de tiers saisie).
- Vague 1 : piste A → Bertrand : `REQUEST` du format et de la date limite de l'export DAS2 (recherche §1.1 : date et
  dispenses NON CONFIRMÉES) ; aucun export DAS2 codé sans `ANSWER` sourcée.
- Vague 1 : Thomas → piste A : `ANSWER` avec la valeur de N (commissions par an d'un particulier avant l'invitation à
  s'immatriculer, Camille §3.4), datée et justifiée, dans un fichier de règles.
- Vague 2 : piste A → piste B : `HANDOFF` du pipeline (états d'un apport, d'une commission, raisons de refus).
- Vague 3 : `CHALLENGE` de Thomas sur chaque attaque, avec le test qui l'arrête ; `CHALLENGE` de Bertrand sur le
  grand livre rejoué.
</a2a>

<livrables>
L3.0 **Échéances de facturation** (constat K4) : `BillingItem` (contrat, rang, période ou jalon, HT figé) porte le
     paiement et les factures ; unicité sur `(billingItemId, kind)` au lieu de `(contractId, kind)` ; type de facture
     `credit_note` préparé pour L5 ; migration des contrats existants (une échéance chacun). Critère : tous les tests
     de `payments` et `invoices` verts, et un test d'un contrat à deux échéances.
L3.1 **Devenir apporteur** : identité, type (particulier ou entreprise), SIREN vérifié au registre ou numéro fiscal,
     régime de TVA, compte de versement (Accounts v2, chemin société distinct de `entity_type: "individual"`),
     contrat d'apport et déclaration de conflit d'intérêts signés par le Sceau. Rôle `introducer` lu seulement sur
     une adresse vérifiée. Critère : aucun versement possible sans les deux signatures (test) ; un apporteur
     entreprise crée un compte de type société (test de l'adaptateur).
L3.2 **Déposer un apport** (concept §E.1) : entreprise par SIREN vérifié, besoin en une phrase, horodatage à la
     seconde, lien d'invitation signé ; l'apport passe « poinçonné » quand l'entreprise apportée confirme elle-même ;
     règle « premier déclarant » et exclusion d'une entreprise déjà cliente ou déjà en discussion, avec la raison
     montrée ; aucune coordonnée de tiers saisie sans l'`ANSWER` d'Inès ; un seul rappel à l'entreprise apportée,
     jamais plus. Critère : tests de chaque refus d'antériorité, de deux dépôts à la même seconde, et d'un apport sur
     son propre employeur (file opérateur).
L3.3 **Attribution et commission** : la règle `introducerCommissionCents` de Camille (§3.4) codée telle quelle :
     naissance à la libération (encaissement effectif de la commission Proofseen), méthode du cumul (R5), part figée
     sur le contrat (`introducerShareBp`, K3), payable après le délai de garde (D12), recalculée à chaque avoir avant
     paiement, reprise par compensation après, suspendue pendant un litige ; jamais aucun montant du contrat
     client-freelance modifié. Critère : un test par ligne du tableau §3.4 et par cas de P2 (remboursement total avant
     libération, avoir partiel avant la fin de garde, avoir après paiement, litige ouvert, fin de fenêtre pendant un
     contrat mensuel) ; le test P2 retrouve au centime 10 800,00 au freelance, 360,00 à l'apporteur, 840,00 à
     Proofseen sur la mission de référence de Camille, avec sa part de 30 % (HYPOTHÈSE de test, jamais un taux
     décidé ni affiché).
L3.4 **Grand livre** (schéma §4.2 de Camille : `LedgerEntry` et `LedgerLine`) : chaque événement du tableau §4.3 crée
     ses écritures équilibrées par une seule fonction `post(event)` ; `assertBalanced` testé ; écritures immuables
     (trigger) ; soldes en `BigInt` calculés ; clé unique par objet Stripe. Comptes proposés par Camille, **À VALIDER
     par Bertrand** : aucun compte codé sans son `ANSWER`. Critère : test qui rejoue le parcours payant du 2026-10-21
     (contrat de 500 EUR HT) et retrouve chaque écriture ; test qui refuse une écriture déséquilibrée et une mise à
     jour.
L3.5 **Versement et pièces** : virement séparé vers l'apporteur avec `source_transaction` égal à la charge du client
     (K2) ; autofacture sous mandat de l'apporteur assujetti, ou relevé pour un particulier (recherche §1.1 : NON
     CONFIRMÉ pour le particulier, mention à valider par Bertrand) ; compteur DAS2 annuel par bénéficiaire en `BigInt`
     avec alerte à 2 400 EUR (recherche §1.1) ; export DAS2 seulement après l'`ANSWER` de Bertrand sur le format.
     Critère : relu par Bertrand, test de chaque mention, test du seuil ; versement prouvé jusqu'à l'appel `transfers`
     sur l'adaptateur de test (bloc commun, Stripe en mode test).
L3.6 **Contrôles** (Camille §3.4, recherche §1.5) : domaine de courriel de l'apporteur égal à celui du client signalé
     et paiement bloqué jusqu'à revue ; apporteur salarié, dirigeant ou mandataire du client refusé par défaut ;
     apporteur et freelance de la même organisation en revue ; fréquence au-delà de N signalée ; file « Apports à
     valider » préparée pour la Tour (L7). Critère : un test par contrôle.
L3.7 **Espace apporteur** (Katana Forge, concept §E.1) : mes apports avec la fenêtre d'attribution datée, commissions
     à venir (avec leur date de fin de garde) et versées, chacune liée à son fait, relevé ; montant prévu écrit avec
     sa formule et « si le contrat est payé » ; aucune promesse de gain, aucun classement, palier ni badge
     d'apporteurs, états vides honnêtes. Critère : parcours joué, accessibilité 1, capture regardée.
L3.8 **Transparence** : le client sait, dans les CGU et sur le devis, qu'une mission a été apportée et que
     l'apporteur est rémunéré par Proofseen (recherche §1.2 point 5, texte d'Inès) ; aucun coût caché. Critère : test
     du texte sur un devis d'une entreprise apportée.
L3.9 **`/apporteurs`** (page publique) : le programme expliqué en trois scènes (concept §E.1), calcul sur un exemple
     marqué comme exemple, « taux à fixer » tant que D1 n'est pas prise. Critère : Lighthouse mobile ≥ 0,95 sur le
     VPS, accessibilité, bonnes pratiques et SEO à 1, lisible sans JS.
</livrables>

<vagues>
Vague 0 risques (Thomas) · Vague 1 règles, écritures (Bertrand), clauses (Inès), valeur de N (Thomas) · Vague 2 en
série pour la piste A : L3.0 (échéances) puis L3.4 (grand livre) puis L3.3 et L3.5 ; en parallèle, pistes B et T ·
Vague 3 red team argent · Vague 4 parcours réel en bac à sable (apport, confirmation par l'entreprise, mission,
paiement, libération, commission née, virement jusqu'à l'appel `transfers` sur l'adaptateur de test) · Portes.
</vagues>

<pieges>
- Requalification en agent commercial (L134-1, indemnité de fin de contrat L134-12) : aucune négociation, aucun
  mandat, aucune exclusivité dans le contrat ni dans le parcours. Requalification en salariat (L8221-6) : aucun
  objectif imposé, aucun reporting obligatoire (recherche §1.3).
- Corruption privée (Code pénal 445-1 et 445-2, NON CONFIRMÉ sur Légifrance pour la numérotation et les peines,
  recherche §1.1) : aucune peine ni aucun montant ne s'écrit à l'écran ; le texte d'Inès parle du risque sans le
  chiffrer.
- Montants en centimes entiers, arrondi écrit ; la commission d'apporteur ne sort jamais du flux client-freelance.
- Stripe en mode test ne laisse pas inscrire un compte v2 de versement (2026-10-21, décision du founder « option
  2 ») : le versement à l'apporteur se joue au GO PAIEMENT LIVE, jamais en contournant Stripe.
- `connect.ts:28` crée tout compte en `individual` : un apporteur entreprise exige un autre chemin.
- Les délais de contestation des cartes et du SEPA sont NON VÉRIFIÉS (Camille, P7) : le délai de garde reste une
  HYPOTHÈSE dans le fichier de règles tant que D12 n'est pas prise.
- Le programme reste fermé en production (drapeau) tant que D1 n'est pas prise.
</pieges>

<decisions_founder>
- D1 (a à d), avec les options chiffrées de Camille (§3.2) ; elle se pose avec D10, qui change la recommandation de
  D1-b (30 % si SEPA par défaut, sinon 20 %).
- D12 (plafond par client apporté, délai de garde, versement minimal), avec les valeurs proposées par Camille (§3.3).
- D5 si elle change l'assiette ; D6 pour le contrat d'apport et le mandat d'autofacturation.
Tout le reste avance : règles configurables, drapeau fermé, taux affiché « à fixer ».
</decisions_founder>

<au_dela>
- **L'antériorité qui ne se vole pas** : l'apport est daté à la seconde, empreint, et confirmé par l'entreprise
  apportée elle-même ; l'attribution devient une preuve, pas une déclaration (concept §G.1 point 4). Preuve : le
  dossier d'un apport rejoué, avec son empreinte et la confirmation datée.
- **Le reçu « chaque euro »** pour l'apporteur (Camille §8 point 1) : sa ligne tirée du grand livre, au centime,
  avec le fait qui l'a fait naître. Preuve : le reçu du parcours rejoué comparé aux écritures.
- **Lien d'apport** personnel : une entreprise qui s'inscrit par ce lien est attribuée sans saisie, avec la même
  règle d'antériorité.
- **Relevé annuel** de l'apporteur, prêt pour sa déclaration, une fois les obligations sourcées par Bertrand.
</au_dela>

<definition_of_done>
- [ ] L3.0 à L3.9 prouvés ; red team argent fermée ; grand livre équilibré sur le parcours rejoué (sortie collée).
- [ ] `ANSWER` à L0-010 et L0-011 reçues et citées par le code.
- [ ] Porte du Trésor PASS (Camille), mentions relues (Bertrand), contrats relus (Inès), liste à faire relire (D6).
- [ ] `/apporteurs` mesurée sur le VPS (Lighthouse collé).
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L3, cochés en tête : aucun taux affiché avant D1 ; aucun classement, palier ni badge
d'apporteurs ; aucun versement à un apporteur sans les deux signatures ; aucun montant du contrat client-freelance
modifié par un apport. Puis format du bloc commun. Enchaîner sur L4.
</cloture>

---

## L4, LE PORTAGE : TRAVAILLER SANS SIRET · ouvert à la clôture de L3, durée cible deux semaines

**Dépend de** : L1 (coffre, données du contrat commercial pré-remplies), L2 (signature de l'adhésion et des pièces),
L3 (L3.0 échéances, L3.4 grand livre, compte 467P) ; D2 pour l'ouverture en production, D5 pour le payeur de la
commission sur un contrat porté, D6 pour l'usage réel des textes. Le code avance sans elles, fermé par drapeau.
**Peut tourner en parallèle de** : L6 (figures dont la donnée existe ; V6 attend la fin de L4) ; la piste T de L5
(mentions par type de facture, format DAC7).

<mission>
Permettre à un freelance sans SIRET de travailler sur Proofseen en portage salarial, auprès d'une société de portage
habilitée et partenaire, avec un parcours aussi simple qu'une mission directe et tous ses documents.
Pourquoi : aujourd'hui le SIRET est obligatoire pour être payé ; chaque talent sans structure est perdu. La loi
réserve le portage à une entreprise dont c'est l'activité exclusive (L1254-24) : Proofseen orchestre, le partenaire
porte. Ce qui change : le freelance choisit « travailler en portage », le client signe avec la société de portage,
la mission avance sur Proofseen comme les autres.
</mission>

<contexte_a_charger>
1. Bloc commun, `research/LEGENDS_P2_REGLEMENTAIRE.md` §2 en entier (conditions, 36 mois, services à la personne,
   L1254-22 et L1254-23 et le délai de 2 jours ouvrables, PASS 2026, minima de branche NON CONFIRMÉS, modèle Malt).
2. `.war-room/tresor/L0_FLUX_ARGENT.md` P3 (flux du portage, au centime) et §5 (partenaire ou filiale).
3. Bus L0 : L0-003 (RISK portage) et L0-012 (REQUEST à Nadia et Sofia : TJM plancher indicatif, L5321-3, comparatif
   de trois sociétés de portage) ; les `ANSWER` sont dus en vague 1 de ce sprint.
4. `.war-room/design/LEGENDS_P2_CONCEPT.md` §E.2 (entrée « sans SIRET » de même poids, éligibilité, triangle, V6
   en violet, jamais en vert).
5. `packages/db/src/billing.ts` (`freelanceSnapshot(requireSiret)`), `contract-checks.ts`, `contracts.ts`,
   `packages/payments/src/connect.ts:28` (`entity_type`).
6. Passations L1 à L3 (coffre, Sceau, grand livre).
</contexte_a_charger>

<equipe>
- **Piste A** : forme juridique du freelance (`company`, `micro`, `umbrella`), organisation de type société de
  portage (SIREN, garant financier, assurance, attestation de vigilance), contrat porté dont le vendeur est la
  société de portage et le bénéficiaire Stripe son compte, compteur de 36 mois par couple porté-client.
- **Piste T** : `tresor-social` (règles, éligibilité, indicateur, vetos), `tresor-juriste` (données transmises pour
  le contrat commercial de portage, textes), `tresor-partenariats` (comparatif des sociétés de portage pour D2),
  `tresor-conformite` (vérification des pièces du partenaire).
- **Piste B** (`components/portage/`) : entrée « Travailler sans SIRET » de même poids que le SIRET (trois chemins
  expliqués : créer sa micro-entreprise par le guichet officiel, portage par un partenaire, déjà une société), page
  publique `/portage`, éligibilité, triangle des trois contrats, choix du partenaire, suivi des documents.
- Conseil : Nadia a le veto sur tout texte qui parle de statut ou de salaire ; Camille sur le flux ; Shogun sur
  `/portage`.
</equipe>

<a2a>
- Vague 0 : Nadia écrit le `RISK` « Proofseen présentée comme entreprise de portage » et la liste des mots interdits.
- Vague 1 : piste A → Nadia : `REQUEST` des contrôles bloquants (36 mois, services à la personne) en règles
  testables ; piste B → Nadia : `REQUEST` du texte de chaque écran avant maquette.
- Vague 1 : Nadia → piste A et Camille : `ANSWER` à L0-012 : L5321-3 sourcé sur Légifrance (aujourd'hui À SOURCER,
  Camille P3) et base de la rémunération minimale de branche (plafond 2017 ou courant, NON CONFIRMÉ, recherche §2.1)
  ; tant que la base n'est pas confirmée, l'indicateur l'affiche NON CONFIRMÉE.
- Vague 1 : Sofia → conseil : comparatif de 3 sociétés de portage (pages publiques lues à la main, une à la fois, URL,
  date, garant, frais publics ou « non publics », API ou export) ; aucune lecture automatique de malt.fr pour
  relever les partenaires de Malt.
- Vague 1 : piste A → Bertrand : `REQUEST` sur la facture de mission d'un contrat porté : émise par la société de
  portage dans sa série (recommandation de Camille, P3) ou par Proofseen sous mandat de la société de portage.
- Vague 1 : piste A → Inès : `REQUEST` pour la page de confidentialité (la société de portage reçoit des données du
  porté).
- Vague 3 : `CHALLENGE` de Nadia sur chaque écran et de Bertrand sur la facturation par la société de portage.
</a2a>

<livrables>
L4.1 **Partenaire de portage** : inscription d'une société de portage (SIREN vérifié, attestation de garantie
     financière avec le nom du garant, assurance RC avec assureur et numéro de police, attestation de vigilance,
     preuve de la déclaration préalable si possible, recherche §2.4) vérifiée par un opérateur ; compte de versement
     de type société. Critère : aucune mission portée possible avec un partenaire non vérifié ou dont une pièce est
     échue (test) ; Proofseen est donneur d'ordre envers le partenaire (recherche §5.2, interprétation) : sa propre
     vigilance est suivie comme celle d'une entreprise cliente.
L4.2 **Freelance porté** : forme `umbrella`, partenaire choisi ; le SIRET n'est plus exigé pour lui ; le vendeur du
     contrat est la société de portage. Critère : tests de `freelanceSnapshot` et `contract-checks` pour les trois
     formes.
L4.3 **Contrôles légaux** : compteur de 36 mois par couple porté-client, catégorie « services à la personne »
     refusée, transmission des éléments du contrat commercial (L1254-23) à la société de portage avec l'échéance de
     2 jours ouvrables suivie. Critère : tests de chaque refus et de l'échéance.
L4.4 **Argent** (parcours P3 de Camille) : le client paie, la société de portage est la bénéficiaire du versement
     avec `source_transaction` (K2), écritures au grand livre sur 467P. Sur un contrat porté, la commission de
     Proofseen n'est **jamais** prélevée sur le porté ni facturée à la société de portage (risque L5321-3, à sourcer par
     Nadia ; Camille P3) : le contrat porté est créé avec `feePayer = company` par défaut, et le portage reste fermé en
     production tant que D5 et D2 ne sont pas prises. Critère : test P3 au centime (13 200,00 payés, 12 000,00 à la
     société de portage, 1 200,00 de frais de service, sur la mission de référence de Camille) ; test qui refuse un
     contrat porté avec `feePayer = freelance` ; versement prouvé jusqu'à l'appel `transfers` sur l'adaptateur de test.
L4.5 **Indicateur de rémunération minimale** : à partir du TJM et des jours, comparaison indicative au minimum
     applicable (L1254-2 II : 75 % du PMSS à défaut d'accord ; PMSS 2026 de 4 005 EUR ; minima de branche NON
     CONFIRMÉS, recherche §2.1), chaque valeur dans un fichier de règles daté avec son URL, la base NON CONFIRMÉE
     affichée comme telle ; en violet, jamais en vert ; « simulation, pas une promesse ». Critère : test de chaque
     valeur lue depuis le fichier de règles, aucune constante dans la fonction.
L4.6 **Écrans** (Katana Forge, concept §E.2) : « Travailler sans SIRET » de même poids que le SIRET, `/portage`
     public, éligibilité qui dit pourquoi et ce qui existe à la place (jamais un refus nu), triangle des trois
     contrats avec l'état de chacun, choix du partenaire, suivi des documents. Critère : textes relus par Nadia dans le
     bus, accessibilité 1, `/portage` à Lighthouse mobile ≥ 0,95 sur le VPS, lisible sans JS.
</livrables>

<vagues>
Vague 0 risques et mots interdits (Nadia) · Vague 1 règles et `ANSWER` à L0-012 (Nadia), comparatif (Sofia),
facturation du contrat porté (Bertrand), textes · Vague 2 données, API, écrans (écrans après les textes de Nadia et
le HANDOFF de la piste A) · Vague 3 revues sociale et comptable, red team (faux partenaire, pièce échue, dépassement
des 36 mois par deux contrats successifs) · Vague 4 parcours réel en bac à sable avec un partenaire de test fictif,
étiqueté comme tel et effacé ensuite · Portes.
</vagues>

<pieges>
- Jamais « Ekigai porte », « Proofseen salarie », « sans risque », « garanti » (§2.5) ; la liste des mots interdits
  de Nadia devient un test de vocabulaire, comme `truth-vocabulary.test.ts`.
- Proofseen ne signe aucun contrat de travail, n'émet aucun bulletin, ne tient aucun compte d'activité.
- Le contrat commercial de portage se conclut au plus tard 2 jours ouvrables après le début de la prestation
  (L1254-22) : l'échéance se calcule en jours ouvrables, jamais en jours calendaires (test sur un vendredi et un jour
  férié ; la liste des jours fériés vit dans un fichier de règles daté).
- La société de portage est une personne morale : `connect.ts:28` (`individual`) ne convient pas.
- Stripe en mode test ne laisse pas inscrire un compte v2 de versement (2026-10-21) : aucun contournement.
- Le portage reste fermé en production tant que D2 n'est pas prise et qu'aucun partenaire réel n'est vérifié.
</pieges>

<decisions_founder>
- D2 (partenaires ou filiale dédiée), avec le comparatif de Sofia et les coûts de Camille (§5.2). Signer avec un
  partenaire reste un geste du founder (règle absolue 5).
- D5 (payeur de la commission) : pour le portage, Camille montre qu'une seule option évite le risque L5321-3 (P1-bis) ;
  la question se pose avec D2.
- Si Bertrand recommande que la facture de mission d'un contrat porté soit émise par Proofseen sous mandat : « Le
  contrat de partenariat prévoit-il ce mandat ? », à poser avec D2.
- D6 pour les textes du portage.
</decisions_founder>

<au_dela>
- **Commencer sans créer d'entreprise, sans promesse** : de l'entrée « sans SIRET » à la première mission portée, le
  même parcours qu'un freelance direct (nombre d'écrans mesuré et écrit dans le compte rendu), avec le triangle des trois contrats et la garantie
  financière du partenaire visible et poinçonnée. Malt propose le portage par ses partenaires (recherche §2.3) ; ce
  qu'il montre de la garantie est NON VÉRIFIÉ, à relever à la main par le founder.
- **Le passage en micro-entreprise expliqué en cinq étapes** avec les liens officiels, et le retour automatique sur
  Proofseen quand le SIRET existe (contrôle de registre déjà en place).
- **Le porté garde ses faits vérifiés** : la mission portée compte comme mission vérifiée à son nom (confirmation du
  client ou paiement sur Proofseen, vocabulaire de vérité inchangé).
- **La cascade du portage** (V6, L6) : de ce que paie l'entreprise à ce qui arrive chez le porté, chaque marche avec sa
  règle et sa source, dès que le partenaire publie ses frais.
</au_dela>

<definition_of_done>
- [ ] L4.1 à L4.6 prouvés ; Nadia et Bertrand ont relu ; Porte du Trésor PASS.
- [ ] `ANSWER` à L0-012 reçue ; L5321-3 sourcé ou toujours marqué À SOURCER dans le compte rendu.
- [ ] `/portage` mesurée sur le VPS (Lighthouse collé).
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L4, cochés en tête : aucun mot de la liste de Nadia ; aucune commission prélevée sur un porté ;
aucun simulateur en vert ; aucune valeur sociale sans source datée. Puis format du bloc commun. Enchaîner sur L5.
</cloture>

---

## L5, LE REGISTRE : FACTURE ÉLECTRONIQUE, OBLIGATIONS DE PLATEFORME, COMPTABILITÉ · ouvert à la clôture de L4

**Dépend de** : L1 (Factur-X si le moteur PDF le permet, K5), L3 (L3.0 échéances et type `credit_note`, L3.4 grand
livre, L3.5 pièces de l'apporteur), L4 (factures d'un contrat porté) ; D4 pour l'adaptateur réel de plateforme
agréée, D6 (expert-comptable) pour l'usage réel. **D4 n'attend pas L5** : la réception est déjà obligatoire.
**Peut tourner en parallèle de** : L6 (figures). Sa piste T (mentions, format DAC7, e-reporting) peut commencer
pendant L4 ; ses pistes A et B non, car L4 touche les mêmes fichiers (`invoices.ts`, `render.ts`).

<mission>
Rendre Proofseen conforme dès aujourd'hui à la réforme de la facture électronique et à ses obligations de
plateforme, et faire de cette conformité un argument : factures Factur-X, envoi par une plateforme agréée, avoirs,
DAC7, vigilance automatique, FEC et rapprochement.
Pourquoi : la réception par plateforme agréée est obligatoire depuis le 1er septembre 2026, l'émission le sera au
1er septembre 2027 pour les PME et les micro-entreprises, avec 50 EUR d'amende par facture non émise
électroniquement, plafond 15 000 EUR par an (loi de finances 2026, art. 123, recherche §4.1). Contre qui : Malt et
Free-Work (ce qu'ils font de la réforme est à relever en veille, à la main pour Malt), et Pennylane qui se déclare PA
(déclaration de l'éditeur, recherche §4.5). Ce qui change : le freelance n'a plus rien à faire pour être conforme,
l'entreprise reçoit des factures que son outil comptable lit sans ressaisie.
</mission>

<contexte_a_charger>
1. Bloc commun, `research/LEGENDS_P2_REGLEMENTAIRE.md` §4, §5, §6, §7 en entier.
2. `.war-room/tresor/L0_FLUX_ARGENT.md` P6 (avoirs, R4 et R5), §4.3 et §4.4 (écritures, rapprochements nocturnes),
   §8 points 5, 6, 9 et 10 (légende du Trésor).
3. `.war-room/sprints/C11_DECISIONS.md` et la mémoire du 2026-10-07 : **Super PDP choisie par délégation** (seule à
   documenter l'émission par un tiers sous mandat, bac à sable, 0,01 EUR HT par facture), B2Brouter en remplaçant ;
   facture de mission en code 380, pas 389 ; questions ouvertes (PA du mandant, KYC par freelance, e-reporting).
4. `packages/invoicing` (rendu, CII, CSV), `packages/db/src/invoices.ts` (numérotation sans trou), le grand livre (L3).
5. `VigilanceAttestation` et `vigilance-desk.ts` ; `contract-checks.ts` (seuil de 5 000 EUR HT, règle du 2026-10-07).
</contexte_a_charger>

<equipe>
- **Piste A** : interface `EInvoicingPlatform` (envoi, statuts de cycle de vie, annuaire) avec adaptateur de test ;
  Factur-X ; avoirs ; acceptation des factures sous mandat ; `TaxProfile` et agrégats DAC7 ; exports DAS2 et FEC ;
  rapprochement Stripe ; vigilance automatique.
- **Piste T** : `tresor-comptable` (lead, veto sur chaque mention et chaque export), `tresor-partenariats` avec
  Bertrand (comparatif PA pour D4), `tresor-juriste` (règles de libération des fonds dans les CGU, libellé du
  paiement sécurisé), `tresor-conformite` (minimisation des données DAC7).
- **Piste B** : écrans de facturation (statut PA de chaque facture, avoirs), données fiscales du freelance, coffre
  de vigilance côté entreprise.
- Fichiers partagés : `invoices.ts`, `render.ts`, `cii.ts` à la piste A seule ; `missingMentions` ne change que sur
  l'`ANSWER` de Bertrand, citée en commentaire avec l'article.
- Conseil : Bertrand a le veto sur chaque mention et chaque export ; Camille rend la porte du Trésor ; Thomas la
  minimisation DAC7.
</equipe>

<a2a>
- Vague 1 : piste A → Bertrand : `REQUEST` de la liste des mentions par type de facture (mission sous mandat,
  commission, frais de service à l'entreprise si D5 le retient, avoir, apporteur, contrat porté) en règles
  testables ; `ANSWER` sourcée article par article, et `ANSWER` aux points 2 et 3 de L0-010 (avoir sous mandat, TVA
  des frais Stripe) si L3 ne les a pas fermés.
- Vague 1 : Bertrand → piste A : format exact de la déclaration DAC7 (source officielle à trouver) ; s'il est
  introuvable, `ESCALATE` par le Chancelier plutôt que d'inventer.
- Vague 1 : Bertrand → piste A : fréquences et contenu de l'e-reporting des paiements (recherche §4.1 : NON
  CONFIRMÉ sur source officielle) ; à sourcer en vague 1, sinon le lot e-reporting reste une interface sans envoi.
- Vague 1 : Sofia et Bertrand → conseil : `ANSWER` qui confronte le choix délégué du 2026-10-07 (Super PDP) à la liste
  officielle des PA (impots.gouv, data.gouv : immatriculation définitive ou « sous réserve »), page par page, datée ;
  c'est la recommandation de D4.
- Vague 1 : piste A → Inès : `REQUEST` du délai de contestation du mandat de facturation (acceptation tacite,
  recherche §4.1) et de la page de confidentialité (la PA reçoit des données de facture).
- Vague 3 : `CHALLENGE` de Bertrand sur le FEC (18 champs, nom normé, encodage) et le rapprochement.
</a2a>

<livrables>
L5.1 **Factur-X** : chaque facture est un PDF lisible qui contient sa CII ; nouvelles mentions (SIREN du client,
     nature des opérations, option sur les débits, adresse de livraison si différente) exigées par `missingMentions`.
     Critère : tests de chaque mention manquante, fichier relu par Bertrand.
L5.2 **Plateforme agréée** derrière `EInvoicingPlatform` : envoi CII, statuts (déposée, reçue, acceptée, refusée,
     encaissée), annuaire pour router vers la PA du client ; adaptateur de test d'abord, adaptateur réel dès D4 (bac à
     sable du prestataire retenu, jamais un compte ouvert par la Légion). Critère : tests sur l'adaptateur de test,
     statut visible sur chaque facture, une facture refusée par la PA entre dans la file de la Tour (L7).
L5.3 **Avoirs** liés à leur facture, remboursement partiel (P6 cas a et b), signe appliqué après calcul (R4), méthode
     du cumul (R5), numérotation sans trou dans la série décidée par Bertrand. Critère : tests de P6 au centime (avoir
     de mission -2 000,00 HT, avoir de commission -200,00 HT, virement repris 2 160,00), test de `Math.round(-2.5)`.
L5.4 **Acceptation sous mandat** : chaque facture émise au nom du freelance lui est soumise, acceptée tacitement
     après le délai prévu au mandat (valeur dans le fichier de règles, texte d'Inès), contestable avant. Critère :
     tests de l'acceptation tacite, de la contestation dans le délai et après, et journal.
L5.5 **DAC7** : données collectées à l'inscription (minimisées, chiffrées), agrégat trimestriel net des commissions
     (requête sur le grand livre), déclaration annuelle et relevé remis à chaque vendeur avant le 31 janvier
     (recherche §5.1), liens vers impots.gouv et urssaf.fr à chaque transaction (242 bis). Critère : tests de
     l'agrégat sur le parcours rejoué ; format sourcé ou escaladé ; aucun champ DAC7 lu par un autre module (test).
L5.6 **Vigilance automatique** (recherche §5.2 et §5.3) : attestation exigée dès 5 000 EUR HT cumulés avenants compris
     (la recherche recommande le cumul, Camille P8 : recommandation, pas règle lue), relance à J+150, alerte ou blocage
     à J+180, code de sécurité et date de vérification conservés ; jamais « vérifiée » sans contrôle fait sur
     urssaf.fr par un opérateur ; vigilance de Proofseen elle-même envers ses apporteurs et partenaires de portage.
     Critère : tests des échéances, test qui refuse un marquage sans code contrôlé.
L5.7 **FEC et rapprochement** : export FEC depuis le grand livre (18 champs dans l'ordre, nom et encodage selon
     l'`ANSWER` de Bertrand, détails techniques à vérifier sur A47 A-1, recherche §7.1) ; rapprochements nocturnes de
     Camille §4.4 (Stripe égal au grand livre, fonds de tiers égaux à l'argent bloqué, factures égales aux écritures),
     alerte et blocage des versements du tiers en écart. Critère : test sur le parcours rejoué, test d'un écart d'un
     centime qui ouvre l'alerte, fichier relu par Bertrand.
L5.8 **Libellé du paiement** : « paiement sécurisé par Stripe, versé au freelance à la validation » et règles de
     libération écrites (recherche §6), partout où le client lit « séquestre » ; les conditions (C24) qui disent le
     paiement non ouvert sont mises à jour par Inès. Critère : test de vocabulaire.
L5.9 **E-reporting** des paiements des prestations encaissées et des clients étrangers (recherche §4.3 point 2) :
     interface et agrégat, envoi par la PA seulement si l'`ANSWER` de Bertrand source fréquences et contenu.
     Critère : test de l'agrégat, ou interface documentée « en attente de source » dans le compte rendu.
</livrables>

<vagues>
Vague 0 risques (Bertrand, Thomas) · Vague 1 règles, mentions, DAC7, e-reporting, comparatif PA confronté à la
liste officielle · Vague 2 Factur-X, PA, avoirs, DAC7, vigilance, FEC en parallèle, chacun dans ses fichiers
(`invoices.ts` à un seul agent) · Vague 3 audit de Bertrand, red team (avoir qui dépasse la facture, facture modifiée
en base, double envoi à la PA, données DAC7 lues ailleurs) · Vague 4 parcours réel rejoué de bout en bout, avec un
avoir · Portes.
</vagues>

<pieges>
- Une facture est immuable (trigger existant) : on ne la corrige jamais, on émet un avoir.
- La facture de mission sous mandat porte le code 380, jamais 389 (décision du 2026-10-07 : 389 désigne une facture
  établie par l'acheteur).
- Ne jamais se dire « plateforme agréée » ni utiliser le logo officiel (recherche §4.4).
- Ne jamais envoyer par e-mail une facture B2B domestique comme « facture électronique » une fois l'obligation
  applicable à l'émetteur (recherche §4.4).
- DAC7 : date de naissance et NIF servent à DAC7 et à rien d'autre (minimisation, recherche §5.4).
- Le « gel des sanctions en 2026 » lu sur un blog est NON CONFIRMÉ (recherche §4.1) : ne jamais l'écrire.
- La PA est un service externe : page de confidentialité à jour avant le premier appel (bloc commun).
</pieges>

<decisions_founder>
- D4 : « Confirmes-tu Super PDP (choisie par délégation le 2026-10-07, B2Brouter en remplaçant) comme plateforme
  agréée, pour la réception déjà obligatoire et l'émission sous mandat ? » Recommandation : l'`ANSWER` de Sofia et
  Bertrand, liste officielle à l'appui. Ouvrir le compte reste un geste du founder. **Urgent côté réception**,
  indépendamment du code.
- D6 : relecture par un expert-comptable du plan de comptes, des écritures, de l'acompte, des avoirs et du FEC.
</decisions_founder>

<au_dela>
- **La facture électronique offerte au micro-entrepreneur** (Camille §8 point 6) : obligé d'émettre au 1er septembre
  2027 (recherche §4.1), il n'a rien à faire ; ses factures sous mandat partent déjà par la PA de Proofseen. Preuve :
  une facture de test déposée sur le bac à sable de la PA, statut relu.
- **La preuve de solvabilité pour les grands comptes** (Camille §8 point 9) : le rapprochement nocturne prouve que les
  fonds de tiers égalent l'argent bloqué chez Stripe, résumé daté dans le dossier fournisseur. Preuve : la sortie du
  rapprochement sur le parcours rejoué.
- **Le relevé annuel du freelance** (Camille §8 point 5) : obligation DAC7 transformée en document utile, revenus,
  commissions retenues, TVA, par trimestre, avec les liens 242 bis, prêt avant le 31 janvier.
- **L'export FEC du freelance et le pack comptable de l'entreprise** : ses écritures Proofseen en 18 champs, que son
  expert-comptable importe sans ressaisie ; factures, avoirs, CII et CSV pour l'entreprise.
</au_dela>

<definition_of_done>
- [ ] L5.1 à L5.9 prouvés ; Bertrand rend PASS par écrit ; Porte du Trésor PASS.
- [ ] Chaque mention codée cite son article et sa source dans le fichier de règles (test qui le vérifie).
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L5, cochés en tête : aucune mention, aucun format, aucune fréquence non sourcés ; jamais
« plateforme agréée » pour Proofseen ; aucune donnée DAC7 hors DAC7 ; aucune facture modifiée, seulement des avoirs.
Puis format du bloc commun. Enchaîner sur L6 (ou le terminer s'il a démarré en parallèle).
</cloture>

---

## L6, L'OBSERVATOIRE : VISUALISATIONS AVANCÉES · ouvert à la clôture de L2, en parallèle de L3 à L5

**Dépend de** : L1 (`Quote.acceptedAt`, `Payment.heldAt`, primitives `ui/`, poinçon d'empreinte), L2 (événements de
signature, date `hired`) pour V2, V7, V8, V11 ; L3 (apports, grand livre) pour V5 et V10 ; L4 (frais du partenaire,
sourcés par Nadia) pour V6. Aucune décision du founder. Une figure dont la donnée n'existe pas encore attend le
sprint qui la crée : elle n'est jamais dessinée sur une donnée inventée.
**Peut tourner en parallèle de** : L3, L4, L5 (la piste B de la Forge est libre ; la piste A de L6 n'écrit que dans
`packages/db/src/viz/`, en lecture seule sur les tables des autres sprints).

<mission>
Donner à chaque espace des visualisations qui font comprendre en trois secondes l'argent, le temps et la preuve, au
niveau de Stripe et de Linear, rapides, lisibles sans JavaScript et sans jamais noter une personne.
Pourquoi : le founder a demandé « des visualisations avec des components complexes et méga avancés » ; aujourd'hui
seuls des histogrammes SVG faits maison existent (`lib/chart.ts`, `components/insights/BarChart.tsx`). Contre qui :
les tableaux de bord de Malt et Free-Work (à relever en veille, à la main pour Malt) et les figures de Stripe. Ce qui
change : le freelance, l'entreprise et l'apporteur voient la même vérité au centime et à la date près.
</mission>

<contexte_a_charger>
1. Bloc commun ; `.war-room/design/LEGENDS_P2_CONCEPT.md` §C en entier : C.0 (six règles sans exception), C.1 (les
   onze figures V1 à V11, donnée existante ou à créer, sens, public, forme, mouvement, AI Act), C.2 (choix technique
   et budgets) ; §A.5 (couleurs) ; `BRAND_BOOK_V2.md`.
2. `apps/web/src/lib/chart.ts`, `components/insights/*`, `packages/db/src/dashboards.ts`, `freelance-insights.ts`
   (ligne 59 : TVA de commission à 2000 bp en dur, voir pièges), `company-insights.ts`, `audience-stats.ts` ; le grand
   livre (L3) et les dates de L1 et L2.
</contexte_a_charger>

<equipe>
- **Piste B** (lead Shogun ; Sumi, Kaze, Tetsu, Mamori) : `components/viz/` (serveur seulement, aucun `"use client"`,
  tenu par un test), fonctions pures et testées dans `apps/web/src/lib/viz/` (`scale.ts`, `sankey.ts`, `frieze.ts`,
  `calendar.ts`, `lineage.ts`, `cascade.ts`) ; `insights/BarChart.tsx` et `lib/chart.ts` migrent vers `viz/Bars.tsx`
  et `lib/viz/scale.ts` (concept §B.8). `ProofLineage` (V4) dans `components/proof/`.
- **Piste A** : agrégats en lecture (`packages/db/src/viz/`), chaque nombre traçable à sa table et sa colonne.
- **Piste T** : Camille vérifie chaque montant affiché ; Bertrand chaque taux de TVA ; Thomas vérifie qu'aucune
  visualisation ne note une personne.
- Conseil : Shogun a le veto sur chaque figure ; Maxwell sur les dépendances ajoutées.
</equipe>

<a2a>
- Vague 0 : Shogun → piste A : `REQUEST` de chaque série de données de V1 à V11 ; la piste A répond « existe »
  (table et colonne) ou « à créer, par Lx » ; aucune visualisation sur une donnée inventée.
- Vague 0 : piste A → Bertrand et Maxwell : `ANSWER` au CHALLENGE de Shogun sur `freelance-insights.ts:59` (taux de
  TVA en dur) avant toute figure d'argent ; la correction lit `Invoice.vatRateBp`.
- Vague 1 : Tetsu → conseil : `ANSWER` mesurée sur la base actuelle (`next build`, « First Load JS » par route)
  avant tout ajout, puis sur le poids ajouté par figure et le Lighthouse.
- Vague 3 : `CHALLENGE` de Kensa (image par image), de Mamori (équivalent texte, clavier, contraste) et de Thomas
  (aucune comparaison de personnes).
</a2a>

<livrables>
L6.1 **Bibliothèque `viz`** (concept §C.0 et §C.2) : SVG rendu par le serveur, `d3-scale` et `d3-shape` côté serveur
     seulement, **Sankey écrit à la main** (`lib/viz/sankey.ts`, `d3-sankey` refusé : il tire une seconde version de
     d3) ; `<figure>`, `<svg role="img">` avec `<desc>` d'une phrase, tableau de toutes les valeurs dans un
     `<details>` ; forme lisible sans couleur (hachures, plein, filet) ; transform et opacité seulement, une fois,
     sur un événement réel, figé en mouvement réduit ; deux figures au plus par écran, 400 éléments SVG au plus par
     figure. Critère : tests de géométrie sur vecteurs fixes, test qui refuse tout import `d3-*` dans un fichier
     `"use client"`, test qui compte les éléments, 0 Ko de JS client ajouté par les figures (sortie de `next build`).
L6.2 **Les onze figures du concept §C.1**, chacune dans l'espace et pour le public que le concept lui donne : V1 flux
     d'une affaire (Sankey), V2 frise de l'affaire, V3 calendrier de trésorerie, V4 généalogie d'une preuve, V5
     couloirs d'apports, V6 cascade du portage, V7 strates de versions, V8 progression des signataires, V9 âge des
     files, V10 rapprochement, V11 délai jusqu'à la signature. Une figure dont la donnée n'existe pas encore est
     listée « attend Lx » dans le compte rendu, jamais simulée. Critère : chaque nombre affiché retrouvé en base par
     un test ; aucune date déduite (un événement sans date se dessine sans position, concept §C.0 règle 2) ; captures
     regardées sur données de test réelles.
L6.3 **Correction du taux en dur** : `freelance-insights.ts:59` lit le taux de la facture de commission. Critère :
     test rouge avec une facture à un autre taux, puis vert.
L6.4 **Performance** : aucune page publique sous 0,95 mobile (VPS), accessibilité, bonnes pratiques et SEO à 1, CLS
     ≤ 0,05 ; écrans connectés à accessibilité 1, contraste AA. Critère : sorties Lighthouse collées.
</livrables>

<vagues>
Vague 0 données et taux en dur · Vague 1 bibliothèque, mesure de la base, essai de poids · Vague 2 figures en
parallèle, dans l'ordre où leur donnée existe (V1 partiel, V2, V3, V4, V7, V8, V9, V11 d'abord ; V5 et V10 après L3 ;
V6 après L4) · Vague 3 inspection (Kensa, Mamori, Thomas) · Vague 4 mesures sur le VPS · Portes.
</vagues>

<pieges>
- Aucun classement, score ou « top » de personnes, même implicite (couleur, ordre, taille d'un nœud) : AI Act ;
  `Review.rating` n'est jamais agrégé ni dessiné ; `VisibilityResult.top5` n'est montré qu'au freelance concerné
  (concept §C.0 règle 1).
- Coupés par Shogun (concept §G.2) : donut, camembert, jauge, radar, compteur qui roule, carte de chaleur de
  l'activité d'un freelance, téléscripteur de l'argent.
- Une visualisation hydratée en entier gonfle la page : SVG serveur, interaction en îlot.
- Pas de `box-shadow` ni de `filter` animés (règle de la marque v2).
- Vert seulement sur un fait poinçonné lu en base (« Versé le … » seulement si `releasedAt` existe) ; toute nouvelle
  utilisation s'ajoute à sa place triée dans `seal.test.ts`.
- Écrans connectés : non mesurables sans session (`CONNECTED_PLAN.md:333-336`) ; rendus serveur sur données de test.
</pieges>

<decisions_founder>
Aucune. V5 affiche « taux à fixer » tant que D1 n'est pas prise ; V6 n'affiche aucun frais tant que D2 n'a pas
choisi un partenaire.
</decisions_founder>

<au_dela>
- **La démonstration de transparence** (moment M4) : le Sankey de l'argent du parcours payant du 2026-10-21 rejoué
  montant par montant, le même dessin pour le freelance et l'entreprise, commission et TVA comprises. Preuve : la
  figure et le test qui retrouve chaque montant en base.
- **La généalogie d'une preuve sur la page publique** (concept §G.1 point 8) : un badge vert que l'on peut ouvrir
  jusqu'au contrat, au versement et à la facture, sans rien révéler de privé.
- **Le délai jusqu'à la signature** montré à l'entreprise pour ses propres affaires (médiane, n, période), la
  plateforme qui se mesure sur ce qui compte pour le client.
- Un export image ou PDF de chaque figure pour un rapport d'entreprise, rendu par le même moteur que le coffre.
</au_dela>

<definition_of_done>
- [ ] L6.1 à L6.4 prouvés ; porte du chef-d'œuvre rendue CHEF-D'ŒUVRE ; Camille a vérifié les montants.
- [ ] Liste des figures livrées et des figures « attend Lx », avec la raison.
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L6, cochés en tête : aucune figure sur une donnée inventée ; aucune comparaison de personnes ;
aucun `d3-*` côté client. Puis format du bloc commun. Enchaîner sur L7.
</cloture>

---

## L7, LA TOUR DE CONTRÔLE : BACK-OFFICE OPÉRATEUR REFAIT · ouvert à la clôture de L6

**Dépend de** : L1 (primitives `components/ui/`, `AuditTimeline`), L2 (enveloppes de signature), L3 (apports, grand
livre, contrôles), L4 (partenaires de portage), L5 (statuts PA, rapprochements, vigilance), L6 (V9 âge des files, V10
rapprochement). Aucune décision du founder ; un versement manuel depuis la Tour n'existe pas sans son GO.
**Peut tourner en parallèle de** : la piste T de L8 (sourcing de la sous-traitance, du contrat-cadre, des litiges) ;
aucune piste A ni B de L8, qui ajoute la file des litiges de mission dans la Tour.

<mission>
Refaire le back-office opérateur en tour de contrôle : une seule interface, structurée en composants réutilisables,
où un opérateur voit tout ce qui attend une décision humaine, prépare chaque décision au clavier, la motive, et où
chaque décision est journalisée.
Pourquoi : le founder a demandé « un meilleur design et une structuration des composants » ; le back-office actuel
(C19) n'a ni argent, ni contrats, ni documents, ses composants tiennent dans `OperatorParts.tsx`, et **l'argent qui
attend une personne n'a aucun écran** : `Payment.needsReviewAt` et `Payment.disputeOpenedAt` ne sont lus par aucune
page de `apps/web` (concept §B.1, recherche du 2026-10-24). Contre qui : Linear (palette, clavier) et le tableau de
bord de Stripe (frise d'un paiement), souvenirs à revoir en veille. Ce qui change : un opérateur sait en une seconde
s'il peut fermer l'onglet (moment M5).
</mission>

<contexte_a_charger>
1. Bloc commun ; `.war-room/design/LEGENDS_P2_CONCEPT.md` §B en entier (B.1 constats mesurés, B.2 quatre groupes,
   B.3 neuf files, B.4 écrans, B.5 palette, B.6 clavier et WCAG 2.1.4, B.7 arborescence et contrats des primitives,
   B.8 ce qui doit être cassé et ce qui ne se casse pas), §C.1 V9 et V10.
2. `apps/web/src/app/[lang]/app/operateur/**`, `components/operator/*`, `styles/operator.css`,
   `lib/operator-access.ts` (ligne 19 : 40 actions par minute), `lib/roles.ts`, `packages/db/src/back-office.ts`
   (`recordAction`), les `*-desk.ts`, `packages/db/src/retention.ts` (ligne 65 : journal gardé 5 ans).
3. Primitives livrées en L1 (`components/ui/`, `components/tower/journal/AuditTimeline.tsx`).
4. `apps/web/test/operator-access.test.ts` : il ne se casse pas.
</contexte_a_charger>

<equipe>
- **Piste B** (lead Shogun ; Sensei, Tetsu, Kaze, Mamori, Kensa) : `components/tower/` selon le concept §B.7
  (`shell/`, `today/`, `queues/QueueView.tsx` générique et `queue-registry.ts`, `queues/inspectors/`, `dossiers/`,
  `journal/`), styles `styles/ui/*.css` et `styles/tower.css`, palette (`components/ui/command/`, îlot chargé au
  premier `Ctrl+K`, cible 6 Ko compressés), raccourcis (`components/ui/keys/`).
- **Piste A** : files de revue en lecture et actions (`packages/db/src/tower/`), toutes par `recordAction` dans la
  même transaction, nouvelles valeurs de `OperatorActionKind` en migration (dont `personal_data_revealed`), modèle
  de signalement pour la modération (à créer, concept §B.3), mouvements du prestataire de paiement avec montant
  (`StripeEvent` n'en garde aucun).
- **Piste T** : Thomas définit chaque file (ce qui y entre, pièces montrées, décisions possibles, échéance, journal) ;
  Camille et Bertrand les files Versements et Rapprochement.
- Conseil : Shogun a le veto sur les écrans ; Maxwell et `security-reviewer` sur chaque action.
</equipe>

<a2a>
- Vague 0 : Thomas → piste A : `HANDOFF` de la définition des neuf files du concept §B.3 (Modération, Premiers
  contacts, Identités, Attestations, Apports à valider, Signatures, Litiges, **Versements** : `needsReviewAt` posé,
  versement `releasing` bloqué, fonds `held` sans validation après l'échéance, **Rapprochement**) et des factures
  refusées par la PA ; chaque échéance dans un fichier de règles daté, proposée par Thomas.
- Vague 0 : Thomas → Chancelier : les échéances de file qui engagent un délai promis à un utilisateur remontent au
  founder (concept §B.3 : « le founder les valide ») ; les autres sont internes.
- Vague 2 : piste A → piste B : `HANDOFF` des modèles de lecture et des actions.
- Vague 3 : `security-reviewer` : `CHALLENGE` sur chaque action (autorisation, limitation, journal) ; Kensa sur les
  écrans ; Mamori sur le clavier et WCAG 2.1.4.
</a2a>

<livrables>
L7.1 **Architecture des composants** : `components/tower/` et `components/ui/` documentés, `OperatorParts.tsx` éclaté
     (concept §B.8), les 17 tableaux faits main remplacés par `DataTable`, `market/` réparti en `deal/`, `money/`,
     `mission/`, aucun composant de plus de 400 lignes. Critère : arborescence dans le compte rendu, tests de rendu,
     `grep "<table"` hors `ui/table` à zéro (sortie collée).
L7.2 **Aujourd'hui** : une `KpiTile` par file (en attente, plus ancien, en retard), liste unifiée triée par échéance
     puis par ancienneté, jamais par personne ; la référence avant tout nom ; à zéro, « Rien n'attend. Dernière
     décision à … ». Critère : test de l'ordre, test qu'aucune tendance n'apparaît sans historique stocké.
L7.3 **Files de revue** (définies par Thomas), chacune une configuration de `queue-registry.ts`, avec inspecteur dans
     l'adresse (`?voir=`, lisible sans JS), pièces du coffre en métadonnées, décision motivée, journal. Critère : un
     test par file (entrée, action, écriture au journal dans la même transaction).
L7.4 **Argent en revue humaine** : la file Versements lit enfin `Payment.needsReviewAt` et `Payment.disputeOpenedAt` ;
     actions : relancer la validation, signaler au Trésor ; **jamais un versement manuel depuis l'écran sans le GO du
     founder**. Avec le grand livre, le rapprochement (V10), les commissions, les factures et leurs statuts PA.
     Critère : test qui pose `needsReviewAt` sur un paiement de test et le retrouve dans la file ; test qui prouve
     qu'aucune action de la file ne crée de virement.
L7.5 **Documents** : recherche d'un document par empreinte ou par affaire, dossier de preuve, métadonnées seulement.
L7.6 **Dossiers sans fuite** : l'adresse e-mail d'une personne masquée par défaut, révélée par un bouton qui écrit
     `personal_data_revealed` au journal (concept §B.4 point 3). Critère : test de la ligne de journal.
L7.7 **Palette et clavier** (concept §B.5 et §B.6) : `Ctrl+K` trouve et **prépare**, n'exécute jamais une décision
     d'une seule touche ; recherche de personne par adresse complète seulement ; raccourcis d'une lettre actifs
     seulement quand la liste a le focus, et un réglage les coupe ; sans JS, `/operateur/recherche`. Critère : tests
     clavier, test qu'aucune commande n'écrit sans formulaire et motif, accessibilité 1.
L7.8 Les écrans existants (contacts, vérifications, modération, utilisateurs, journal, entonnoir, mesures, retours,
     communauté) migrés dans la Tour sans perte de fonction, anciennes adresses en 308. Critère : tests existants
     verts, `operator-access.test.ts` inchangé et vert, parcours joués.
</livrables>

<vagues>
Vague 0 files et échéances (Thomas) · Vague 1 architecture et storyboard (Sensei), modèle de données relu · Vague 2
écrans et actions en parallèle, écrans après le HANDOFF de la piste A · Vague 3 revue sécurité, inspection, red team
(un non-opérateur, une adresse non vérifiée, une rafale au-delà de 40 actions par minute, une action sans motif) ·
Vague 4 parcours réel opérateur, joué par le founder sur son compte opérateur · Portes.
</vagues>

<pieges>
- Le rôle opérateur vient d'une liste d'adresses **vérifiées** (`OPERATOR_EMAILS`) ; il a été accordé par une adresse
  non vérifiée jusqu'au 2026-10-16 ; tout autre visiteur reçoit 404 (`operator-access.ts:6`) ; limitation à 40
  actions par minute (`operator-access.ts:19`) : ne pas la perdre dans la migration.
- Le journal des opérateurs est en ajout seul et gardé 5 ans (`retention.ts:65`) : aucune action sans écriture.
- Coupés par Shogun (concept §G.2) : Kanban et glisser-déposer dans les files, aurore et bords lumineux dans la Tour,
  téléscripteur de l'argent ; le seul violet de la Tour est le focus et la sélection.
- Le vert existant de l'attestation vérifiée (`VerificationQueues.tsx`) se garde tel quel dans son nouvel
  inspecteur.
</pieges>

<decisions_founder>
Aucune pour le code. Si Thomas propose une échéance qui engage un délai envers un utilisateur (« une attestation est
revue sous N jours »), elle se pose au founder avec sa recommandation ; d'ici là, aucune échéance n'est affichée à
l'utilisateur.
</decisions_founder>

<au_dela>
- **La Tour au calme** (moment M5) : « Rien n'attend. Dernière décision à … par vous » sur des données réelles,
  et l'âge de chaque file lisible d'un regard. Preuve : capture d'une Tour vide et d'une Tour chargée.
- **La confiance vaut aussi à l'intérieur** : aucune adresse e-mail vue sans trace au journal. Aucun back-office de
  marketplace connu ne le montre publiquement (à confirmer en veille).
- **Le journal qui ne se réécrit pas, même par nous** : l'empreinte racine quotidienne du journal opérateur publiée
  avec celle des signatures, si Maxwell l'a validée en L2.
- Mode « tour de nuit » : un résumé quotidien par courriel au founder de ce qui attend, sans donnée personnelle ;
  annuler une décision opérateur dans les 30 secondes, journalisée comme telle.
</au_dela>

<definition_of_done>
- [ ] L7.1 à L7.8 prouvés ; `security-reviewer` sans CRITIQUE ni HAUT ; porte du chef-d'œuvre.
- [ ] La file Versements montre un paiement en revue réel du bac à sable (capture regardée).
- [ ] Trois portes ; bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L7, cochés en tête : aucune action sans motif ni journal ; aucun versement manuel ; aucune
signature apposée à la place d'une personne ; aucune comparaison d'opérateurs entre eux. Puis format du bloc commun.
Enchaîner sur L8.
</cloture>

---

## L8, LES SCÉNARIOS PROFESSIONNELS · ouvert à la clôture de L7, durée cible deux à trois semaines

**Dépend de** : L1 (coffre, PV de recette), L2 (Sceau pour avenants, CRA et contrat-cadre), L3 (L3.0 échéances
`BillingItem`, grand livre), L5 (avoirs, vigilance), L7 (file Litiges de la Tour) ; décisions **D8** (mode de paiement
du mensuel, bloque L8.2), **D9** (perte après versement, conditionne L8.8 et le GO PAIEMENT LIVE), D6 pour l'usage
réel des clauses. Le code avance sans elles, fermé par drapeau.
**Peut tourner en parallèle de** : la préparation de L9 par Scenario Hunter (liste des scénarios d'attaque à rejouer) ;
aucun autre sprint.

<mission>
Couvrir les situations réelles des entreprises et des freelances que Malt et Free-Work gèrent mal ou pas du tout :
contrat-cadre et bons de commande, CRA mensuel signé et payé, jalons, avenants et renouvellements, sous-traitance et
équipes de freelances, pack conformité fournisseur, assurance RC Pro, litiges arbitrés sur pièces.
Pourquoi : les grands comptes achètent par contrat-cadre et bons de commande, la régie se paie au mois, et aujourd'hui
un contrat `monthly` ne se paie pas (`payments.ts:221`, Camille P4), un contrat n'a qu'une facture de chaque sorte
(K4). Contre qui : Malt (contractualisation, portage), Free-Work (qui n'est pas partie aux contrats,
`TEAM_MEMORY.md:605`, cité par Camille). Ce qui change : le service achats d'un grand compte trouve tout son circuit, sans tableur.
</mission>

<contexte_a_charger>
1. Bloc commun ; passations L1 à L7 ; `research/LEGENDS_P2_REGLEMENTAIRE.md` (§5.2 vigilance, §6 libération des
   fonds, §3.2 niveau de signature par document).
2. `.war-room/tresor/L0_FLUX_ARGENT.md` P4 (mensuel, options A, B, C de D8), P5 (jalons, méthode du cumul), P6
   (avoirs), P7 (litiges), P8 (contrat-cadre et ses trois compteurs), R7 (arrondi du mois).
3. C10 et C11 dans `PROMPTS_CONQUETE.md` (relevés mensuels, validation à deux niveaux, centres de coûts) et
   `sprints/C11_DECISIONS.md`.
4. `Timesheet`, `ContractApproval`, `contracts.ts`, `payments.ts` (les contrats `monthly` ne sont pas encore
   payables), `apps/web/src/app/api/conversations/[id]/quotes/route.ts` (drapeau `PROOFSEEN_MONTHLY_BILLING`).
</contexte_a_charger>

<equipe>
- **Piste T d'abord** : Inès source la sous-traitance (acceptation du sous-traitant et agrément de ses conditions de
  paiement par le client : texte de loi **à sourcer en vague 1**, sur Légifrance, il n'est pas dans la recherche), le
  contrat-cadre, l'avenant, la règle de médiation dans les CGU ; Bertrand les jalons, le mensuel et les avoirs ;
  Thomas les litiges et la fraude par sous-traitance ; Nadia la frontière entre équipe de freelances et prêt de main
  d'oeuvre (à sourcer en vague 1).
- **Piste A** et **piste B** ensuite, scénario par scénario, chacun avec son contrat de passation ; un seul agent par
  fichier (`payments.ts`, `invoices.ts`, `contracts.ts`) sur toute la durée du sprint.
- Conseil : Victoria a le veto sur l'ordre des scénarios ; Camille sur chaque flux.
</equipe>

<a2a>
- Vague 0 : Victoria → conseil : `REQUEST` de classement des scénarios par valeur pour l'utilisateur (pas par
  facilité), avec sa raison ; les scénarios se livrent dans cet ordre, sauf dépendance technique écrite par Maxwell
  (L8.2 et L8.3 avant L8.1, qui en hérite).
- Avant chaque scénario : `ANSWER` sourcée du Trésor ; aucune règle légale codée sans elle.
- Avant L8.2 : `ESCALATE` du Chancelier si D8 n'est pas prise ; la piste A code l'option A recommandée derrière le
  drapeau, sans l'ouvrir.
- Avant L8.8 : Inès → piste A : `ANSWER` sur la clause des CGU qui autorise la reprise de virement (L0-011 point 1).
</a2a>

<livrables>
L8.1 **Contrat-cadre et bons de commande** (P8) : un contrat-cadre signé fixe TJM, plafond global, durée, payeur et
     taux de commission ; chaque bon est un contrat qui en hérite et suit P1, P4 ou P5. Critère : test d'un bon qui
     dépasse le plafond (refusé), des trois compteurs (plafond, vigilance à 5 000 EUR HT cumulés, fenêtre de
     l'apporteur), et d'un changement de taux du cadre qui ne touche pas un bon signé.
L8.2 **CRA mensuel signé et payé** (P4, option de D8) : le relevé validé devient un document signé et une demande de
     paiement ; `HT du mois` arrondi selon R7 et figé sur le relevé ; plafond : le cumul des HT validés ne dépasse
     jamais `totalCents`. Critère : test R7 (TJM 600,01 sur 37 demi-journées), test du plafond, parcours de deux mois
     joué en bac à sable ; `PROOFSEEN_MONTHLY_BILLING` reste fermé en production jusqu'à D8.
L8.3 **Jalons** (P5) : financement jalon par jalon, PV de recette daté au coffre, libération partielle, commission par
     la méthode du cumul, dernier jalon qui absorbe le reste. Critère : test 333,33 / 333,33 / 333,34 dont la somme des
     commissions vaut 100,00 (Camille R5), écritures au grand livre retrouvées.
L8.4 **Avenants et renouvellements** signés par le Sceau, versions comparables dans le coffre ; un avenant qui baisse
     le prix produit l'avoir (P6). Critère : test d'un avenant de réduction de bout en bout.
L8.5 **Sous-traitance et équipes** : un freelance meneur, des freelances associés, partage écrit, acceptation du
     sous-traitant par le client selon la règle sourcée par Inès, vigilance de toute la chaîne. Critère : test qui
     refuse un sous-traitant non accepté, test de la vigilance par maillon.
L8.6 **Pack conformité fournisseur** : en un clic, l'entreprise télécharge le dossier à jour d'un freelance
     (registre, vigilance, assurance, NDA signé), **une liste de pièces datées, jamais un pourcentage de complétude**
     (score de personne déguisé, concept §G.2). Critère : test du contenu et de la date de vérification de chaque
     pièce ; une pièce échue est marquée échue, jamais verte.
L8.7 **RC Pro** : attestation déposée, vérifiée par un opérateur (file Attestations), échéance suivie. Critère :
     tests de l'échéance et du refus d'une attestation non vérifiée.
L8.8 **Litiges** (P7) : ouverture, pièces du coffre, médiation opérateur selon la règle écrite des CGU (jamais sans
     règle contractuelle préalable, recherche §6), décision motivée et journalisée, lien avec les litiges Stripe,
     commission d'apporteur suspendue. Critère : un test par ligne du tableau P7 de Camille.
Critère commun : chaque scénario joué de bout en bout entre les comptes de test, le founder basculant d'un compte à
l'autre, preuves collées.
</livrables>

<vagues>
Vague 0 cadrage et classement de Victoria · Vague 1 sourcing de la piste T pour tous les scénarios · puis un lot par
scénario, dans l'ordre retenu, chacun avec ses vagues 2 (TDD), 3 (revues, red team argent) et 4 (parcours joué) et sa
porte du Trésor · Trois portes à la fin.
</vagues>

<pieges>
- Un scénario non sourcé juridiquement ne se code pas : il attend l'`ANSWER` du Trésor.
- Ne jamais présenter la médiation comme un arbitrage juridique ; Proofseen ne décide jamais seule de bloquer ou de
  libérer des fonds sans règle contractuelle préalable (recherche §6).
- La régie est fermée par `PROOFSEEN_MONTHLY_BILLING` depuis le 2026-10-07, exprès : ne pas l'ouvrir pour un test en
  production.
- Avoirs : `Math.round(-2.5)` vaut -2 (Camille R4) : calcul sur la valeur absolue, signe ensuite.
- La durée maximale de détention des fonds chez Stripe est NON VÉRIFIÉE (Camille P4, option C) : pas de provision
  unique longue sans la lire.
</pieges>

<decisions_founder>
- D8 : « Comment paie-t-on un contrat mensuel : provision du mois libérée au CRA validé (A), paiement après le CRA (B),
  ou provision unique (C) ? » Recommandation : A (Camille P4).
- D9 : « Litige perdu ou remboursement après versement : reprise du virement, perte absorbée sous un plafond que tu
  fixes, ou les deux ? » Recommandation : reprise d'abord, plafond, revue humaine au-delà.
- Si un scénario suppose un prix (frais de jalon, frais de pack) : il reste gratuit jusqu'à décision, question posée
  avec la recommandation de Camille.
</decisions_founder>

<au_dela>
- **Le pack fournisseur que les achats demandent sans le demander** : partageable par lien signé à durée limitée,
  consultable sans compte, avec la preuve de solvabilité de la plateforme (rapprochement nocturne de L5) ; c'est le
  dossier que demandent les services achats soumis à Sapin II (recherche §1.1, seuil NON CONFIRMÉ). Preuve : le
  dossier d'un freelance de test ouvert sans compte, lien expiré refusé.
- **L'avoir en un clic, sans tableur** (Camille §8 point 7) : une réduction convenue produit en même temps l'avenant,
  le remboursement partiel, les deux avoirs, le recalcul de la commission et celui de l'apporteur. Preuve : le
  parcours rejoué et les écritures.
- **La trésorerie du freelance en clair** (Camille §8 point 3) : sommes sous séquestre et dates de libération prévues
  au contrat, sans prévision inventée.
- Le meneur d'équipe voit la marge de son équipe, calculée sur les montants signés, jamais sur une note de personne.
</au_dela>

<definition_of_done>
- [ ] Chaque scénario livré et prouvé ; porte du Trésor PASS par scénario ; trois portes à la fin.
- [ ] Les textes de loi utilisés (sous-traitance, prêt de main d'oeuvre) sourcés par Inès et Nadia avec URL et date,
  ou le scénario reporté et dit tel quel.
- [ ] Bus fermé.
</definition_of_done>

<cloture>
Interdits propres à L8, cochés en tête : aucune règle légale non sourcée ; aucun pourcentage de complétude ;
aucune médiation présentée comme un jugement ; aucun drapeau de paiement ouvert en production sans décision. Puis
format du bloc commun. Enchaîner sur L9.
</cloture>

---

## L9, LA PORTE DES LÉGENDES : INSPECTION TOTALE ET MISE EN PRODUCTION · ouvert à la clôture de L8

**Dépend de** : L1 à L8 clos (terminés et prouvés, ou partiels avec ce qui manque écrit) ; D7 (GO DEPLOY) pour la mise en production ; l'état
de D1 à D12 décide quels drapeaux restent fermés. Le GO PAIEMENT LIVE n'est demandé que si la porte du Trésor est PASS
sur K2, K3, K5 et D9.
**Peut tourner en parallèle de** : rien ; c'est la porte finale. La préparation (liste des attaques, procédure de
retour arrière) commence pendant L8.

<mission>
Inspecter toute la phase 2 comme un adversaire, la corriger, la mettre en production sur GO DEPLOY et prouver
qu'elle tient en vrai.
Pourquoi : neuf sprints ajoutent des migrations, des services externes, des drapeaux et de l'argent ; un seul défaut
de production sur un contrat signé ou un virement coûte la confiance que la marque promet. Contre qui : Malt et
Free-Work tels qu'ils sont ce jour-là, relevés à la main par le founder pour Malt. Ce qui change : la phase 2 est
vraie en production, pas seulement sur une branche.
</mission>

<contexte_a_charger>
1. Bloc commun (en particulier les pièges : migrations, Railway, Caddy, clés de bac à sable) ; toutes les passations
   et tous les bus de L1 à L8.
2. `sprints/C7_DEPLOY.md`, `sprints/DEPLOY_GO.md` et la procédure de déploiement du VPS (`deploy/vps/`).
3. La mémoire du 2026-10-18 sur le Caddy de DEMOMEA (fichier monté par inode : jamais `sed -i`, réécrire sur place).
4. Le tableau des décisions D1 à D12 de ce fichier et leur état réel.
</contexte_a_charger>

<equipe>
Toutes les maisons. Kensa et Mamori sur chaque écran ; `security-reviewer` sur signature, OTP, documents, argent ;
`database-reviewer` sur toutes les migrations de la phase ; Thomas et Scenario Hunter en red team ; Bertrand audite
factures, avoirs, FEC sur le parcours rejoué ; Inès relit la liste des documents à faire relire et la page de
confidentialité ; Camille rend la porte du Trésor finale ; Shogun le verdict ; DEVOPS OPERATOR le déploiement.
Chaque inspecteur écrit son rapport dans son propre fichier `a2a/L9/handoffs/` ; le Chancelier seul consolide L9.1.
</equipe>

<a2a>
- Un bus unique `a2a/L9/BUS.md` où chaque maison dépose ses `CHALLENGE` ; aucun déploiement tant qu'un seul est ouvert.
- Avant le GO DEPLOY : `HANDOFF` de DEVOPS OPERATOR (liste des migrations, durée mesurée à blanc, retour arrière
  répété, nouvelles variables d'environnement à poser par le founder) ; `ACK` de Maxwell et de Camille.
- Après le déploiement : `ANSWER` de QA GUARDIAN avec les parcours joués en production et leurs preuves.
</a2a>

<livrables>
L9.1 Rapport d'inspection (défauts bloquants, majeurs, mineurs) et leurs corrections, chacun avec son test.
L9.2 Migrations jouées à blanc sur une copie de la base, temps mesuré, retour arrière écrit et répété. Critère :
     sortie de `migrate deploy` sur la copie, depuis un `main` local à jour (piège du 2026-10-18).
L9.3 Lighthouse sur le VPS de toutes les pages publiques touchées (`/verifier`, `/apporteurs`, `/portage` et les
     pages existantes) : performance ≥ 0,95, accessibilité, bonnes pratiques et SEO à 1, CLS ≤ 0,05.
L9.4 GO DEPLOY demandé avec la liste des migrations et des nouvelles variables ; déploiement ; vérification de la
     production (routes, journaux sans donnée personnelle, parcours réels, `marketplace-verify` ou vérification réseau
     des pages publiques) ; remesure de la part de citations IA dans les plafonds existants (au-delà, GO API).
L9.5 État des drapeaux en production : chaque fonction de la phase 2 ouverte ou fermée, avec la décision qui la
     ferme. Critère : tableau dans le compte rendu, relu en production.
L9.6 Si la porte du Trésor est PASS : question GO PAIEMENT LIVE prête, avec le plan d'un premier versement réel d'un
     petit montant, la rotation des clés de bac à sable et l'effacement du compte de versement de test du profil du
     founder (pièges du 2026-10-21).
</livrables>

<vagues>
Inspection (toutes les maisons en parallèle) · corrections en TDD · répétition des migrations et du retour arrière ·
GO DEPLOY · production · vérification · question GO PAIEMENT LIVE si la porte du Trésor l'autorise.
</vagues>

<pieges>
- Production : `app.prev` garde la version précédente ; le retour arrière se répète avant, il ne s'invente pas après.
- Ne jamais déployer sans le founder joignable.
- `migrate-deploy.cjs` lit le dépôt principal (2026-10-18) ; migrations parallèles redatées (2026-10-15) ;
  `connect_timeout=30` (2026-10-07).
- Caddy de DEMOMEA monté par inode : jamais `sed -i` (2026-10-18) ; sauvegarde avant toute modification, d-ai.fr
  contrôlé après.
- Une nouvelle variable d'environnement (clé de chiffrement du coffre, secrets d'horodatage, de PA) est posée par le
  founder ; la Légion ne la lit ni ne l'affiche.
- Bonnes pratiques Lighthouse faussées sur l'adresse d'aperçu (2026-10-21) : mesurer en production après déploiement.
</pieges>

<decisions_founder>
- D7 (GO DEPLOY), avec la liste des migrations et des variables.
- Rappel, en une seule question groupée, de toutes les décisions D1 à D12 encore ouvertes, chacune avec ce qu'elle
  garde fermé en production.
- GO PAIEMENT LIVE, seulement si L9.6 est prêt.
</decisions_founder>

<au_dela>
- **« Comment Proofseen protège votre argent et vos contrats »** : page publique sourcée (signature simple et dossier
  de preuve, `/verifier`, paiement sécurisé par Stripe et règles de libération, facture électronique, vigilance),
  chaque affirmation avec sa source, sans promesse, citable par les IA. Preuve : Lighthouse et données structurées
  valides.
- **La preuve publique que la phase 2 tient** : un contrat signé, vérifié sur `/verifier` par un inconnu, payé et
  facturé par la PA en bac à sable, dont le Sankey et la généalogie se lisent de bout en bout. Preuve : la suite de
  captures, datée.
- **Le chiffre qui dit si on gagne** : le délai jusqu'à la signature (L2.9) et la part de citations IA, mesurés en
  production et comparés à leur valeur de départ, sans projection.
</au_dela>

<definition_of_done>
- [ ] Zéro défaut bloquant ou majeur ouvert ; production vérifiée ; mémoire et tableau de bord à jour.
- [ ] Migrations répétées à blanc, retour arrière répété, sorties collées.
- [ ] Tableau des drapeaux relu en production.
- [ ] Bus L9 fermé.
</definition_of_done>

<cloture>
Interdits propres à L9, cochés en tête : aucun déploiement sans GO DEPLOY du jour ; aucun paiement réel sans GO
PAIEMENT LIVE ; aucune variable secrète lue ou affichée ; aucun drapeau ouvert sans sa décision. Puis format du bloc
commun. Le Scribe propose la phase 3 au même format.
</cloture>
