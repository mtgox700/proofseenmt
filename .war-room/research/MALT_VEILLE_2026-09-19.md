# VEILLE MALT n° 1 — 2026-09-19

> Consigne du founder (2026-09-19) : **Malt est la cible à battre. On les contournera un jour.** Veille à refaire à chaque cycle
> (revue design, nouvelle page, nouvelle offre, revue de sprint). Pages **publiques** uniquement, consultées dans un navigateur comme un visiteur,
> sans compte, sans automatisation et sans contourner de protection. `WebFetch` et `help.malt.com` renvoient 403 ; le navigateur passe.
> Aucun texte ni visuel de Malt n'est copié : on note des faits (sourcés et datés) et on en tire des décisions.

## 1. Faits relevés (sources primaires, consultées le 2026-09-19)

| # | Fait | Source |
|---|---|---|
| F1 | **`robots.txt` : `User-agent: GPTBot` → `Disallow: /`.** Malt refuse le robot d'**entraînement** d'OpenAI sur tout le site. Les autres robots (dont `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`) suivent les règles `*` : les profils `/profile/…` sont autorisés ; la recherche `/s?`, `/portfolio` et `/missions` sont interdites | https://www.malt.fr/robots.txt |
| F2 | Accroche d'accueil orientée **entreprise** et **IA** (« talents de l'ère IA »), vocabulaire achats : « Freelance Management System (FMS) », plus de 85 intégrations (SAP Fieldglass, Coupa, Workday) | https://www.malt.fr/ |
| F3 | **Chiffres incohérents sur la même page** : « 1M+ » freelances dans le hero, « 850 000 » plus bas ; « 90 000 » clients ; « 80 % des projets démarrent en 6 jours » ; « 10 fois moins de temps » d'administratif (sans source) | https://www.malt.fr/ |
| F4 | **AI Search** : assistant de sélection qui génère des listes de candidats présélectionnés et des descriptifs de projet, **uniquement sur la base Malt**. Complété par un ATS, la gestion de budget et les intégrations achats | https://www.malt.fr/c/product-release |
| F5 | La barre de recherche suggère « SEO GEO » : Malt vend des freelances en **GEO** (optimisation pour les moteurs génératifs). Le marché du sujet existe chez eux, côté prestation | https://www.malt.fr/ |
| F6 | Page profil publique (un exemple, structure seulement) : rendue côté serveur, JSON-LD `ProfilePage` + `Product` + `BreadcrumbList`, meta `noimageindex`, ~595 Ko de DOM, ~250 ressources. **La page du freelance affiche une section « d'autres profils correspondent également »** : chaque profil renvoie vers ses concurrents | profil public Malt (consulté une fois, aucune donnée personnelle relevée) |
| F7 | Les profils Malt ressortent dans les moteurs de recherche avec nom, titre, localisation et **TJM** dans l'extrait | recherche web du 2026-09-19 |
| F8 | Frais (source secondaire, la page officielle est en 403) : freelance 10 % HT (5 % HT après 3 à 6 mois selon la source), client 5 % (Starter) à 9 % (Advanced) | parrainduweb.fr, misterportage.fr (2026) — **à confirmer** sur la page officielle |
| F9 | Design : aplat corail plein écran, titre sans empattement, chiffre mis en avant dans une pastille, gros moteur de recherche, bandeau cookies qui masque le hero sur mobile, témoignages de grands comptes (Schneider, L'Oréal, Accor…) | https://www.malt.fr/ (capture) |

Performance mesurée (Lighthouse 12 local, une passe, indicatif) : voir §4.

## 2. Ce que ça veut dire pour Proofseen

1. **F1 est notre meilleur argument, à formuler sans le surjouer.** Refuser `GPTBot` signifie que les pages Malt ne servent pas à
   **entraîner** les modèles d'OpenAI : ce que ChatGPT « sait de mémoire » d'un freelance ne vient pas de son profil Malt. En revanche,
   la recherche web de ChatGPT (`OAI-SearchBot`, index Bing) **peut** trouver et citer Malt. **Ne jamais écrire « Malt vous rend invisible
   sur ChatGPT »** : c'est faux. Ce qui est vrai et vérifiable : « votre profil Malt n'entre pas dans la mémoire des modèles d'OpenAI ;
   dans les réponses avec recherche, il est en concurrence avec les autres profils. » → **À mesurer à J0** : part des citations `malt.fr`
   par moteur (le simulateur la calcule déjà via le domaine des sources citées).
2. **F4 : Malt a construit « le recruteur qui demande à une IA »… dans son jardin fermé.** Leur IA ne voit que Malt. Notre terrain,
   ce sont les IA ouvertes que le recruteur utilise **hors** de Malt. Positionnement public inchangé (R2 §4, complémentaire : « Malt couvre
   l'endroit où vous postulez, nous couvrons celui où l'on vous cherche ») ; ambition stratégique : l'étage 2 (passerelle) attaque leur
   commission.
3. **F6 est la faiblesse de conception à exploiter.** Une page de freelance qui redirige vers ses concurrents, c'est l'inverse d'une page
   qui vous fait retenir. **Règle pour les pages vérifiées Proofseen (étage 2) : aucun lien vers un autre freelance, jamais.** Une seule
   personne, ses preuves, un contact.
4. **F3 : leurs chiffres se contredisent.** Notre règle « aucun chiffre sans source ni intervalle » devient un argument visible. Sur notre
   landing, chaque chiffre a sa méthode ou son étiquette « fictif ».
5. **F5 : du GEO se vend déjà en prestation sur Malt.** Notre différence doit sauter aux yeux : eux optimisent, **nous mesurons** (avant
   et après, contre des offres témoins). Le mot « mesure » doit être le cœur visuel du hero.
6. **F7 : le TJM s'affiche publiquement dans les moteurs.** Pour l'étage 2, décider (founder + juriste) si le TJM est public, masqué
   ou donné en fourchette.

## 3. Pistes design (passer « à une autre ligue »)

Le founder juge la landing actuelle « ligue amateur ». Face à Malt (aplat de couleur, recherche, logos de clients), notre avantage ne se
situe ni dans le volume ni dans les logos : c'est **la preuve en direct**. Décisions pour l'itération suivante :

- **D1 — Le hero montre le produit qui fonctionne** : un simulateur en direct (données fictives et étiquetées). Une demande de recruteur
  se tape, l'IA répond par une liste de cinq profils, « vous » y êtes ou non. Tirage après tirage, les points s'accumulent et
  l'intervalle de confiance se resserre. C'est le concept « du bruit à la preuve », rendu visible en quelques secondes. Malt ne peut pas montrer ça.
- **D2 — Un hero « salle de mesure » sombre et lumineux**, la suite éditoriale en clair : contraste fort, instrument de précision, pas un site
  de plus en aplat de couleur.
- **D3 — Chaque chiffre porte sa méthode.** Nos intervalles de confiance deviennent un élément graphique à part entière.
- **D4 — Une seule personne par page** (étage 2), cf. §2.3.

## 4. Performance comparée (Lighthouse 12 local, indicatif)

Une passe par page (indicatif ; `benchmarkIndex` entre 774 et 1 086), même machine et même outil que pour Proofseen.

| Page | Mobile perf / access. / BP / SEO | LCP mobile | TBT mobile | Desktop perf | Poids | Requêtes |
|---|---|---|---|---|---|---|
| malt.fr (accueil) | **27** / 88 / 82 / 92 | 10,7 s | 4 640 ms | 47 | ≈ 2,3 Mo | ≈ 320 |
| Profil public Malt | **29** / 87 / 79 / 100 | 17,8 s | 6 220 ms | 64 | ≈ 2,2 Mo | ≈ 570 |
| Landing Proofseen (hero « salle de mesure », 2026-09-19) | **96-99** / 100 / 100 / 100 | 1,4 s | 130-160 ms | 100 | ≈ 120 Ko (HTML 12,8 Ko gzip + 2 polices latines 106 Ko ; worker 1,8 Ko sur desktop seulement) | < 10 |

Lecture : sur un téléphone moyen, un profil Malt met plusieurs secondes à afficher son contenu principal. **Règle pour nos pages vérifiées
(étage 2) : même budget que la landing, contenu intégralement dans le HTML.** C'est bon pour l'humain et pour les robots qui lisent les pages.
Ne pas publier ces chiffres comme une attaque : c'est une mesure locale, en une passe.

## 5. Décisions appliquées le jour même

- **D1 et D2 livrés** : hero « salle de mesure » sombre (header compris) avec simulateur en direct (données fictives, étiquette visible,
  résumé accessible, état final rendu côté serveur). Le champ WebGL devient une ambiance de fond, sans cible ni boucle sur le thread principal.
- Preuve : `sprints/S3_DESIGN_REVIEW.md` §7.

## 6. Prochaine veille (checklist)

1. `robots.txt` : GPTBot toujours bloqué ? Nouveaux robots d'IA bloqués ou autorisés ?
2. Accueil et page produit : évolution d'AI Search (ouverture aux LLM externes ? API ? MCP ?).
3. Frais : page officielle lisible dans le navigateur ? (F8 est encore de source secondaire.)
4. Un profil public : structure, JSON-LD, section « autres profils », performance mobile.
5. Toute offre « visibilité IA » ou « GEO » vendue **aux freelances** (ce serait une attaque directe contre notre étage 1).
