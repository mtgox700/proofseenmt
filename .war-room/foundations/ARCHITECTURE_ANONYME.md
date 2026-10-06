# ARCHITECTURE « IDENTITÉ PSEUDONYME » — contraintes fondatrices (2026-09-20)

> Donneur d'ordre : le founder, 2026-09-20. Ces 12 points sont des **contraintes d'architecture**, pas des options à ajouter
> à la fin. Ce document les traduit en règles exécutables et fixe la **classification honnête** exigée au point 12.
> Il complète `PIVOT_ANONYME.md` (arbitrage) et ne le contredit pas : l'objectif est validé, le mécanisme reste à mesurer.
> Décision du founder confirmée : **aucun portfolio de freelance à construire pour le moment**. Le hub existant reste
> uniquement comme **bras témoin nominatif** de l'expérience (il sert la mesure J0), et n'est plus un produit à développer.

## 1. Classification obligatoire (contrainte 12)

Toute fonctionnalité qui prétend « améliorer le référencement » doit être rangée dans une de ces trois colonnes, **dans son
code et dans le rapport client**. Une fonctionnalité non classée ne se livre pas.

| Colonne | Définition | Exemples pour Proofseen |
|---|---|---|
| **CONTRÔLÉ** — nous en répondons | Dépend uniquement de notre code ou de notre serveur. Vérifiable par un test automatique. | HTML servi sans JavaScript · robots.txt ouvert aux robots d'IA · sitemap complet et à jour · balisage conforme au visible · maillage interne · temps de réponse · pas d'identité réelle dans la page (**Identity Firewall**) · score de ré-identification calculé avant publication · `.well-known` de possession |
| **OPTIMISÉ** — nous augmentons la probabilité, sans la fixer | Pratique appuyée par des données, dont l'effet dépend d'un tiers. | Fraîcheur du contenu · densité de faits sourcés · pages d'intention par compétence/ville · soumission Bing/IndexNow et Brave · cohérence d'entité (même pseudonyme partout) · corroboration par des preuves vérifiées |
| **NON GARANTI** — jamais promis | Décidé par Google, OpenAI, Anthropic, Perplexity. | Être **indexé** · **apparaître** dans une réponse · **être cité** nommément · le **rang** · la survie d'un contenu après une mise à jour d'algorithme · l'usage de notre MCP par un assistant |

**Règle de langage, opposable en interne** : on écrit « mesuré à X % [IC 95 % : a-b] à la date D », jamais « garanti »,
jamais « 100 % ». L'objectif de **90 %+ est un KPI cible**, pas une promesse contractuelle (contrainte 5, acceptée telle quelle).

## 2. Les couches (contrainte 6), et ce qu'elles valent

| Couche | Statut | Ce qui est vérifié automatiquement |
|---|---|---|
| Profil individuel pseudonyme (`/p/<id>`) | CONTRÔLÉ (publication) / NON GARANTI (citation) | Texte complet en HTML, aucune fuite d'identité, score de ré-identification sous le seuil |
| Pages d'intention (`/freelances/<compétence>-<ville>`) | OPTIMISÉ | Données uniques et vérifiées, pas de gabarit vide, `noindex` si trop peu de profils |
| Maillage interne | CONTRÔLÉ | Chaque profil est atteignable en ≤ 2 clics depuis la racine |
| Sitemap + robots | CONTRÔLÉ | Toutes les URL publiables listées, robots ouvert aux 6 robots d'IA |
| Données structurées | CONTRÔLÉ (conformité) / **AUCUN GAIN DÉMONTRÉ** (effet) | `ProfilePage`/`Person`, `name` = pseudonyme, `identifier`, **jamais `sameAs`**, strictement conforme au visible |
| API / MCP (contrainte 7) | CONTRÔLÉ (exposition) / NON GARANTI (usage) | Schéma stable, lecture seule, profils consentants uniquement |

## 3. Identity Firewall (contraintes 8 et 10)

Règle unique, vérifiée par des tests : **le rendu public ne peut pas contenir un champ privé**, par construction et non par
discipline. Concrètement : deux types distincts (`PrivateIdentity`, `PublicProfile`), aucune fonction de rendu n'accepte
`PrivateIdentity`, et un test parcourt chaque page produite pour y chercher le nom réel, l'e-mail, le téléphone, les URL
LinkedIn/GitHub et le SIRET. Un seul hit = build en échec.

**Limite dite franchement** (contrainte 10) : nous contrôlons ce que **nous** publions. Nous ne pouvons pas empêcher un
client de recouper des indices ailleurs. C'est pourquoi le score de ré-identification existe (§4) et pourquoi la
non-circumvention est **contractuelle**, pas technique.

## 4. Score de ré-identification (contrainte 9)

Avant publication, on calcule la **rareté de la combinaison** publiée (compétences + séniorité + ville + secteur + TJM +
signaux rares). Plus la combinaison est rare, plus la ré-identification est facile. Le score bloque la publication au-delà
d'un seuil et **propose la généralisation** (« 5 ans chez Stripe » → « scale-up internationale » ; « janv. 2021 → mars 2026 »
→ « 5+ ans »). Le seuil et les pondérations sont des **HYPOTHÈSES** calibrées sur nos propres profils, à réviser avec des
données réelles.

## 5. LLM Discoverability Rate (contraintes 4, 5, 11)

**Définition** : pour un profil `p` et un ensemble de requêtes éligibles `Q`, part des tirages où le profil est **cité**
(URL de sa page ou son pseudonyme) dans la réponse, mesurée par moteur, avec intervalle de Wilson, sur `n` tirages répétés.
On publie **toujours** l'intervalle, jamais le point seul. Décomposition mesurée séparément, car les causes diffèrent :

| Étage mesuré | Source de la mesure | Colonne |
|---|---|---|
| E1 indexation Google/Bing | Search Console, Bing WMT, `site:` | NON GARANTI |
| E2 présence dans la recherche web | SERP relevée | NON GARANTI |
| E3 récupéré par le moteur | journaux serveur : `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `BraveBot` | **CONTRÔLÉ** (on sait s'il est venu) |
| E4 cité dans la réponse | Recruiter Simulator (API officielles) | NON GARANTI |
| E5 requêtes qui déclenchent la découverte | Recruiter Simulator, par JD et formulation | NON GARANTI |

**LDR global Proofseen** = moyenne des LDR par profil, pondérée par le nombre de requêtes éligibles, avec IC — et **jamais**
publiée sans la date, le nombre de tirages et la liste des moteurs.

## 6. Ce qui est interdit, même si ça « marcherait »

Texte caché ou balisage non visible · prompt injection dans les pages · faux avis, fausses missions, faux chiffres ·
gabarits vides multipliés (politique *scaled content abuse*) · `sameAs` vers l'identité réelle · automatisation ou scraping
de LinkedIn et Malt · promesse de rang ou de citation.

## 7. Ordre d'exécution

1. **Socle identité** : schémas public/privé, Identity Firewall testé, score de ré-identification. *(en cours)*
2. **Rendu public** : profil pseudonyme + pages d'intention + maillage + sitemap + robots, zéro JavaScript.
3. **Mesure** : LDR dans `stats`, rapport par profil et global, journaux de robots.
4. **Exposition** : API de lecture puis connecteur MCP (contrainte 7), profils consentants uniquement.
5. **Test à 3 bras** (`PIVOT_ANONYME.md` §5) : c'est la même infrastructure qui sert de banc d'essai.
