# PIVOT « PROFIL ANONYME » — arbitrage du board (2026-09-20)

> Saisine du founder : héberger chez Proofseen un **profil pseudonyme riche** (« Ayoub.H », `FR-8F42K`), indexable par Google et
> cité par les LLM, **sans nom, sans LinkedIn, sans GitHub**, pour que l'entreprise soit **obligée de passer par nous**.
> Conséquence proposée : abandonner le hub/portfolio du freelance.
> Ce document prime sur les passages « anonymat » de PRODUCT_THESIS et MODELE_PASSERELLE.
> Règle appliquée : aucune affirmation sans source datée ; tout le reste est marqué **HYPOTHÈSE**.

## 1. Verdict

**ADOPTÉ SOUS CONDITIONS, MAIS PAS POUR LA RAISON AVANCÉE.** Le **but** (contrôler la relation commerciale, empêcher le
contournement) est validé. Le **mécanisme** (« l'anonymat rend citable et force le passage par nous ») est **réfuté par les
données disponibles**. L'anonymat ne crée pas la découvrabilité : il supprime précisément les signaux qui la produisent.

**Qui avait tort ?** Les deux, sur des points différents — et il faut le dire précisément :

| Position | Ce qui était faux | Preuve |
|---|---|---|
| **Board du 18/09** : « un profil anonyme ne peut pas être cité par les IA » | **Trop absolu.** Google prévoit explicitement qu'un *handle* serve de `name` quand c'est le seul identifiant du site, plus `alternateName` et `identifier` internes | Doc `ProfilePage`, maj **2026-09-08** ; robots.txt Fiverr : `/{username}` indexable (vérifié 2026-09-20) |
| **Pivot du 20/09** : « le profil pseudonyme sera récupéré et cité » | **Faux sur le mécanisme.** Sur les requêtes « trouve-moi 5 freelances », ce sont les **pages catégorie** qui sortent (`upwork.com/hire/nodejs-developers/fr/paris/`), pas les fiches. **Aucune citation documentée** d'une URL de profil Upwork/Malt/Toptal dans une réponse ChatGPT ou Perplexity | Recherche du 2026-09-20 ; vérification directe : la requête `site:upwork.com` « Node.js Paris » ne remonte que des pages catégorie |

**Le point qui tue le mécanisme** : ce qui corrèle le mieux aux citations, ce sont les **mentions tierces cohérentes**
(Spearman **0,664**, contre 0,218 pour les backlinks — notre propre `RESEARCH_GROUND_TRUTH` §2). Un profil anonyme en a **zéro
par construction**. Et côté LinkedIn, **75 % des citations IA viennent des profils individuels** (Meltwater/LinkedIn, 9,5 M de
citations, 2026) — c'est-à-dire de pages **nominatives et corroborées**, exactement le contraire du pivot.

**Vent contraire supplémentaire** : Google a massivement **désindexé les profils de marketplaces** — Upwork 242 309 → 13 358
pages indexées (−94 %), Fiverr 1 712 113 → 19 612 (−99 %) (Loganix, **2026-07-22**). Le format « annuaire de profils » est en
défaveur, **indépendamment** du pseudonymat. S'y ajoutent les politiques *scaled content abuse* et *doorway* (Search
Essentials, maj **2026-08-28**) : des gabarits « métier × ville » en volume tombent dedans.

**À proscrire définitivement** : « référencé à 100 % ». Ni Google ni aucun LLM ne garantit l'affichage. Notre seule promesse
tenable reste **mesurée** : SoRV@5 avec intervalle de confiance.

## 2. Les trois mécanismes possibles, classés par solidité

| # | Mécanisme | Verdict | Pourquoi |
|---|---|---|---|
| **A** | Fiche pseudonyme individuelle citée nommément par les LLM | **Réfuté en l'état** | Aucune corroboration tierce possible ; unité citée = page catégorie ; désindexation des annuaires de profils |
| **B** | **Nos** pages d'entrée (catégorie/comparatif à données vérifiées) citées → le client atterrit chez nous → contact via nous | **Plausible, coûteux** | C'est le format réellement cité, mais on affronte Upwork/Toptal sur leur terrain, avec un domaine neuf. Semrush (10/12/2025, domaine AS 84) : 42 % des pages citées à J+30, **58 % jamais**. Et c'est l'« annuaire programmatique » que `PRODUCT_THESIS` refuse : à rouvrir explicitement si on y va |
| **C** | Être une **source branchée dans l'assistant** (connecteur MCP, app ChatGPT) | **La vraie réponse au problème économique** | C'est le seul canal où « le client passe forcément par nous » est structurellement vrai. Upwork l'a fait le **2026-04-09** ; SeekOut expose un MCP. Barrière **technique basse** (soumission connecteur Anthropic, Apps SDK OpenAI), **barrière de distribution haute** (mise en avant discrétionnaire) |

**Conséquence directe** : le pivot ne doit pas être arbitré sur « anonyme ou pas », mais sur « **quel canal** rend le passage
par nous obligatoire ». L'anonymat n'est **pas** un moteur de découverte ; c'est une **option de confidentialité**.

## 3. Ce qui est tranché

1. **L'anonymat total est refusé comme moteur de croissance.** Il reste possible comme **réglage de confidentialité** du
   freelance, avec le nom partiel déjà décidé (« Ayoub H. ») — inchangé par rapport à `MODELE_PASSERELLE` étage 2.
2. **On ne supprime pas le hub ni la surface nominative.** Le founder proposait de les abandonner : les données disent
   l'inverse — c'est la corroboration (site perso + GitHub + LinkedIn + mentions) qui rend une personne citable. Supprimer
   la surface, c'est supprimer le carburant.
3. **La mesure reste le cœur.** Elle est même l'**arbitre de ce pivot** : on ne tranchera pas par opinion, on mesurera (§5).
4. **Aucun code de marketplace avant la gate du 2026-11-27.** Inchangé.
5. **J0 du 2026-09-28 n'est pas décalé.** Il devient la ligne de base contre laquelle le test du pivot sera lu.
6. **JSON-LD n'est pas un levier vendable.** Le pivot s'appuie beaucoup sur `ProfilePage` : notre étude causale (1 885 pages)
   ne montre **aucun gain**, et Google écrit qu'aucun fichier ni balisage supplémentaire n'est requis pour les fonctions IA
   (maj **2025-12-10**). On le pose pour l'hygiène d'entité, jamais comme promesse.

## 4. Inconnues levées / non levées

**Levées** : le pseudonyme est conforme aux specs Google (`name` = handle autorisé) ; le balisage doit refléter le visible,
sous peine d'action manuelle ; les annuaires de profils sont en défaveur algorithmique ; les requêtes « hire » sont servies
par des pages catégorie ; la voie connecteur existe et est techniquement accessible ; les profils Upwork **sont** crawlables
(robots.txt vérifié le 2026-09-20 : `/search/profiles/*` bloqué, fiches individuelles non bloquées) — donc « crawlable » n'est
pas « cité ».

**Non levées (à mesurer, pas à débattre)** : part de citation réelle d'une fiche pseudonyme *versus* nominative sur nos propres
JD ; délai d'indexation Brave (pas de console webmaster) ; effet d'un volume de pages catégorie sur un domaine neuf ; capacité
à entrer dans un annuaire de connecteurs et à y être visible ; seuil de ré-identification acceptable pour nos profils.

## 5. Le test qui peut tuer le pivot (pré-enregistré)

Trois bras, **mêmes faits**, sur un domaine que nous contrôlons, publiés le même jour, tous ouverts aux robots d'IA, sitemap
soumis (Bing/IndexNow + Brave URL submit + GSC) :

| Bras | Contenu | Rôle |
|---|---|---|
| **A — nominatif** | Profil complet, nom réel, `sameAs` GitHub/LinkedIn | Témoin haut |
| **B — pseudonyme** | **Mêmes faits**, « A.H. · FR-8F42K », aucun `sameAs`, aucun lien externe | Le pivot |
| **C — page d'entrée** | « Freelances TypeScript/Node.js à Paris — profils vérifiés », données uniques et vérifiées | Mécanisme B |

**Mesure** : le Recruiter Simulator déjà construit, vague réduite (5 JD × 2 formulations × 3 moteurs × 5 tirages = **150
tirages**, ≈ **12 $** au pire cas), à **J+30 (2026-10-28)** et **J+60 (2026-11-27)**, plus les journaux serveur (hits
`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `BraveBot`).

**Seuils fixés à l'avance — on ne les rediscute pas après coup :**
- **Le mécanisme A est réfuté** si, à J+60, le bras B est cité dans **moins d'un tiers** des tirages où le bras A est cité,
  ou s'il reste à **zéro citation** alors que A a une borne basse d'IC > 0.
- **Le mécanisme B est retenu** si le bras C est cité dans **≥ 5 %** des tirages sur ses JD cibles, borne basse > 0.
- **Si A et B et C échouent tous les trois**, la voie « on se fait citer » est close pour P0 : le seul chemin restant est le
  canal C (connecteur), à traiter comme un produit distinct.

**Coût total** : ≈ 24 $ d'API (deux points de mesure) + le domaine déjà prévu. **Aucun développement de marketplace.**

## 6. Bloquants juridiques avant toute publication (orientation, à valider par un avocat)

1. **RGPD** : le pseudonyme reste une donnée personnelle **pour nous** (clé de ré-identification) — EDPB *Guidelines 01/2025*,
   16/01/2025 ; CJUE C-413/23 P, 04/09/2025 (approche relative, sans bénéfice pour le responsable). Base légale =
   **consentement explicite et révocable** ; information art. 13 ; **AIPD probable**.
2. **Test de ré-identification obligatoire** avant publication (k-anonymat sur stack + ville + séniorité + secteur + ex-clients
   + TJM). Interdits : nom de client, école, dates exactes.
3. **Retrait du consentement** : dépublication sous 72 h, en sachant que **l'indexation par les LLM est irréversible** →
   avertissement écrit au freelance.
4. **AI Act** : l'annexe III point 4 couvre explicitement l'« accès à l'emploi **indépendant** » : notre sourcing est dans le
   champ. Un **tri déterministe sans score** reste hors haut risque (HYPOTHÈSE, art. 6 §3) ; obligations haut risque reportées
   au **2027-12-02** (règlement omnibus (UE) 2026/1744). **Aucun scoring automatique en V1.**
5. **Portage** : il transforme le freelance en **salarié** du porteur → risque de qualification en **placement privé**
   (déclaration préfectorale, **gratuité obligatoire pour le travailleur**, L5321-3). ⇒ **Pas de portage en V1** ; la
   commission est **facturée à l'entreprise**, jamais prélevée sur le consultant. *Correction directe du volet D de
   `MODELE_PASSERELLE`.*
6. **Non-contournement** : 12 mois est raisonnable ; l'indemnité doit réparer le **manque à gagner** (clause pénale révisable,
   art. 1231-5 C. civ.) et non punir, sous peine de déséquilibre significatif (L442-1 C. com.).
7. **Identité révélée avant tout engagement** (devoir d'information précontractuelle, art. 1112-1 C. civ.) : le modèle
   « révélation après accord mutuel » ne tient que si elle précède la signature.

## 7. Corrections à apporter aux documents existants

| Document | Correction |
|---|---|
| `PRODUCT_THESIS.md` | Remplacer « refus : pas de profil anonyme » par : **anonymat = option de confidentialité, jamais moteur de découverte** ; ajouter le canal C (connecteur) à la veille concurrentielle |
| `foundations/MODELE_PASSERELLE.md` | Étage 2 : nom partiel confirmé ; **volet D (portage) suspendu** jusqu'à l'avis de l'avocat sur le placement privé ; commission facturée au client |
| `ROADMAP.md` | Ajouter le test 3 bras (publication en S2, lectures à J+30 et J+60) ; aucune ligne de code marketplace avant la gate |
| `foundations/CONFORMITE.md` | Ajouter : consentement explicite, AIPD, test de ré-identification, dépublication 72 h, avertissement « indexation irréversible », interdiction de scoring en V1 |
| `BUDGET_P0_INVESTISSEUR.md` | + ≈ 24 $ pour les deux vagues réduites du test |

## 8. Sources

Doc `ProfilePage` (maj 2026-09-08) · Structured Data General Guidelines (maj 2026-07-10) · Spam policies (maj 2026-08-28) ·
« AI features and your website » (maj 2025-12-10) · Loganix, parasite SEO sur les marketplaces (2026-07-22) · Meltwater ×
LinkedIn, 9,5 M de citations (2026) · Semrush, vitesse de citation d'un contenu neuf (10/12/2025) · Upwork dans ChatGPT
(2026-04-09) · EDPB *Guidelines 01/2025* (16/01/2025) · CJUE C-413/23 P (04/09/2025) · AI Act annexe III + règlement omnibus
(UE) 2026/1744 · C. trav. L5321-1, L5321-3, L5323-1 · C. civ. 1231-5 et 1112-1 · notre `RESEARCH_GROUND_TRUTH.md` §2 et §3.

## 9. Décisions du founder (2026-09-20, après lecture de cet arbitrage)

| Question | Décision |
|---|---|
| Anonymat | **Option de confidentialité** (nom partiel), pas moteur de découverte. Le hub et la surface nominative sont **maintenus**. |
| Pages d'entrée (mécanisme B) | **Une seule** page d'entrée, incluse comme 3e bras du test. L'annuaire programmatique reste refusé tant que la preuve n'est pas là. |
| Connecteur (mécanisme C) | **Prototype en P0** : connecteur MCP en lecture seule, profils consentants, soumis à l'annuaire Anthropic. |
| Portage (volet D) | **Suspendu** jusqu'à l'avis de l'avocat ; commission facturée à l'entreprise, jamais prélevée sur le consultant. |

Ces quatre décisions sont reportées dans `PRODUCT_THESIS.md`, `foundations/MODELE_PASSERELLE.md`, `foundations/CONFORMITE.md`,
`ROADMAP.md` et `BUDGET_P0_INVESTISSEUR.md`.

## 10. CORRECTION du 2026-09-20 (soir) — contre-preuve apportée par le founder

Le founder a posé une offre d'emploi à ChatGPT et a obtenu **cinq profils Malt individuels, nommés, sourcés `malt.fr`**
(capture du 2026-09-20). Vérification indépendante faite dans la foulée : `site:malt.fr/profile` renvoie des dizaines de
**fiches individuelles indexées**, dont plusieurs à **nom partiel** (« Christophe D. », « Baptiste R. », « Michaël A. »).

**Ce qui est corrigé dans ce document :**

| Affirmation initiale (§1 et §2) | Statut après contre-preuve |
|---|---|
| « Aucune citation documentée d'une URL de profil Upwork/Malt/Toptal » | **FAUX.** C'était une absence de preuve dans la recherche menée, pas une preuve d'absence. La citation de fiches individuelles est maintenant **documentée** (capture du founder). |
| « L'unité citée est la page catégorie, pas la fiche » | **Trop absolu.** Les deux formats sortent. Sur un domaine à forte autorité, la **fiche individuelle est citée nommément**. |
| Mécanisme **A** « réfuté en l'état » | **Requalifié : partiellement validé.** Une fiche individuelle **peut** être récupérée et citée. |

**Ce qui n'est PAS corrigé, et qui reste l'inconnue centrale :** Malt cumule deux avantages que nous n'avons pas —
**autorité de domaine** (des milliers de pages, des avis, une marque connue) et **corroboration** (avis, missions, entreprise).
La capture prouve que *la fiche* est une unité citable ; elle ne prouve **pas** qu'une fiche **pseudonyme** sur un
**domaine neuf** le soit. Les deux variables restent confondues.

**Ce que ça change pour la décision :** l'objection la plus forte du board tombe (« ce n'est pas la fiche qui est citée »).
L'objection restante, elle, tient toujours : **les mentions tierces** (0,664) et la corroboration sont ce qui fait citer, et
un profil sans nom ni lien externe en est dépourvu. Le pivot redevient **plausible**, et le test à 3 bras devient
**indispensable** — c'est lui qui sépare « anonymat » de « autorité ».

**Renfort du protocole de test (§5)** : ajouter un **bras témoin externe** = suivre en parallèle, sur les mêmes JD, la citation
de fiches **Malt à nom partiel** (observation seule, aucune automatisation sur Malt : relevé manuel dans l'échantillon du
protocole). Il donne le point de référence « autorité forte + nom partiel » que nos trois bras ne peuvent pas produire.

**Rappel de méthode, qui vaut pour nous comme pour cette capture** : c'est **un tirage**, sur **un moteur**, à un instant donné.
Il suffit à réfuter un « jamais », il ne fixe aucun taux. Notre propre doctrine impose un **échantillonnage répété avec
intervalle de confiance** avant d'en tirer un chiffre.

## 11. Défaut de méthode du test à 3 bras, et ce qu'on en fait (2026-09-20)

**Constat du board en préparant l'infrastructure** : les bras A (nominatif) et B (pseudonyme) portent **les mêmes faits** et
désignent **la même personne**. Publier les deux le même jour permet à quiconque de les rapprocher : **le bras B n'est pas
anonyme pendant l'expérience**. Le test mesurerait la citation en détruisant l'anonymat qu'il prétend évaluer.

**Décision** : on l'assume et on l'écrit, plutôt que de le masquer.
- Le sujet est **le founder lui-même**, qui consent explicitement à cette exposition. **Jamais un profil de client.**
- Ce que le test mesure reste valable : **la mécanique de citation** d'une fiche pseudonyme sur un domaine neuf, comparée à
  une fiche nominative avec corroboration (`sameAs`).
- Ce que le test **ne mesure pas** : la **robustesse de l'anonymat**. Elle se teste séparément, sur des profils dont aucun
  jumeau nominatif n'existe, avec le score de ré-identification comme garde-fou.
- Conséquence opérationnelle : à la fin de l'expérience, le bras A **et** le bras B sont dépubliés, et l'on conserve le
  souvenir que **l'indexation par les LLM est irréversible** — ce qui a été vu peut rester cité longtemps après.

## 12. Statut des bloquants du §6 (2026-09-21)

| # | Bloquant | Statut |
|---|---|---|
| 1 | RGPD : consentement explicite, information art. 13, AIPD | **Consentement encodé** (révocable, daté) ; information art. 13 et AIPD **à rédiger avec l'avocat** |
| 2 | Test de ré-identification | **Imposé par le code** : la commande `profiles` refuse d'écrire sans auto-recherche `not_found` de moins de 90 jours, postérieure au consentement ; k-anonymat sur les quasi-identifiants du §6.2, indicatif sous 50 profils puis bloquant (k < 2) |
| 3 | Retrait du consentement | **Imposé par le code** : consentement impossible à encoder sans `irreversibilityAcknowledged: true` ; profil retiré exclu du site, pages déjà générées supprimées, échéance de 72 h calculée et signalée si dépassée |
| 4 | AI Act | **Respecté par construction** : aucun score, tri et maillage par identifiant ; qualification finale à valider |
| 5–7 | Portage, non-contournement, révélation avant engagement | **Juridique pur** : CGV et contrats, rien à coder avant l'avis de l'avocat |

Ce qui reste **non garanti** malgré le code : une auto-recherche négative ne prouve pas qu'un adversaire motivé échouera ; elle
prouve seulement que les requêtes évidentes, tirées de la page, ne mènent pas à la personne.


## 13. Le pseudonyme du bras B porte le vrai prénom (2026-09-26)

**Constat**, en vérifiant la preuve de possession du domaine : la fiche du bras B est publiée sous le pseudonyme
`Ayoub.H`, et c'est aussi la variante de nom par laquelle l'appariement la reconnaît.

Le §11 dit déjà que le bras B **n'est pas anonyme** pendant l'expérience, parce qu'il porte les mêmes faits que le bras
A. Le présent constat est plus précis, et il touche la **mécanique** que le §11 déclarait mesurable : le lien n'a pas
besoin d'être déduit des faits, il est **lisible sur la page**.

**Ce que cela fait au verdict.** Si le bras B est cité, deux causes restent indiscernables :

1. la mécanique de citation d'une fiche pseudonyme fonctionne — ce que le test veut mesurer ;
2. le moteur a rapproché `Ayoub.H` de `Ayoub Hammoudi`, présent sur le bras A, sur le même domaine.

**Pourquoi c'est commercialement important.** Le produit publierait des fiches sous identifiant **opaque**
(`FR-7H2XK`), sans prénom. Un résultat positif sur `Ayoub.H` ne se transporte donc pas tel quel à ce produit.

**Décision : on ne corrige pas, on borne.** Changer le pseudonyme changerait le contenu des pages et remettrait à zéro
la fenêtre de mesure ouverte le 2026-09-24 — J+30 le 24/10, J+60 le 23/11, quatre jours avant la gate. Le coût dépasse
le gain.

**Ce que le verdict J+60 aura le droit de dire, et pas plus :**

- ✅ « Une fiche sous pseudonyme **léger**, sur un domaine neuf qui porte aussi la fiche nominative, est citée à tel taux. »
- ❌ « Une fiche sous identifiant opaque est citée. » — non mesuré ici.
- ❌ « L'anonymat résiste. » — déjà exclu par le §11.

**À mesurer séparément, après la gate** : un bras sous identifiant opaque, sans jumeau nominatif sur le même domaine.
C'est ce bras-là qui vaut pour le produit ; celui-ci vaut pour la mécanique.
