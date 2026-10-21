# KENSA : revue adverse de la refonte « Legends League » (vague 7, 2026-10-21)

> Périmètre : `origin/main` au commit 8d9e789 (PR #72 à #77), servi par l'aperçu privé http://127.0.0.1:3200.
> Méthode : HTML brut par curl (= rendu sans JS), Playwright Chromium 1208 (1440x900 et 375x812, sombre, JS, sans JS,
> `reducedMotion: reduce`), images figées par `getAnimations({subtree:true})` + `currentTime`, lecture du code extrait
> de `origin/main`. Scripts et captures : scratchpad `kensa/` (hors dépôt).
> Non comptés (déjà connus) : best-practices 0,96 dû à Clerk ; captures `/shots/*.webp` de l'ancienne interface ;
> menu d'en-tête coupé sur « Ent » à 375 ; photo de profil bloquée (`ERR_BLOCKED_BY_RESPONSE.NotSameSite`, URL absolue
> `https://proofseen.com/fichiers/...` appelée depuis 127.0.0.1 : artefact de l'aperçu).

## Bloquants

### B1. Vitrine à 375 px : ouvrir « Lire le relevé en tableau » fait déborder toute la page de 59 px
- Mesure : `/fr` et `/en`, 375x812, `<details>` ouvert : `document.documentElement.scrollWidth = 434` pour 375.
  Éléments hors cadre : `figcaption.rg-head`, `div.rg-board`, `div.rg-engines`, tous à 418 px de large.
- Cause : `apps/web/src/styles/home.css:26` `.registre { display: grid; ... }` sans `grid-template-columns` : la piste
  implicite prend la largeur min-content du tableau (418 px) malgré `.rg-scroll { overflow-x: auto }` (ligne 88).
  C'est le premier défaut de la liste de `masterpiece-gate.md` (grille sans `minmax(0,1fr)`).
- Reproduction : téléphone 375, `/fr`, toucher « Lire le relevé en tableau » : la page glisse latéralement, la colonne
  Perplexity du registre et la colonne « Total » sortent de l'écran (capture `kensa/shots/rg375-table.png`).
- Correctif : `home.css:26` `.registre { grid-template-columns: minmax(0, 1fr); }` et `.rg-table { min-width: 0; }` ;
  ajouter au test mobile un passage « tous les `<details>` ouverts » (le contrôle actuel ne mesure que l'état replié).

### B2. Huit routes du hub servent une 404 brute, hors marque, sans viewport, en français même sous /en
- Mesure : `/fr/profils/nexiste-pas` répond 404 avec 147 octets :
  `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Profil introuvable</title><p>...</p></html>`.
  Fond blanc, Times New Roman 16 px, pas de `<meta name="viewport">` (rendu à 980 px sur téléphone), aucun en-tête,
  aucune sortie (capture `kensa/shots/_fr_profils_inconnu-375-dark.png`). `/en/missions/zzz` rend le même texte français.
- Sources : `apps/web/src/app/[lang]/profils/[slug]/route.ts:25`, `missions/[id]/route.ts:23`,
  `entreprises/[slug]/route.ts:23`, `blog/[slug]/route.ts:22`, `metiers/[key]/route.ts:22`, `postes/[key]/route.ts:23`,
  `missions/ville/[city]/route.ts:22`, `publications/[id]/route.ts:25`.
- Pourquoi bloquant : le lot g promettait les 404 ; c'est la page que voit quiconque suit un lien de profil retiré
  (cas courant sur une marketplace), et elle casse la marque d'un coup.
- Correctif : une fonction `notFoundPage(lang, kind)` dans `packages/hub` qui rend `pageFrame` (en-tête, pied, tokens)
  avec le contenu de `app/[lang]/not-found.tsx` (« Aucune marque frappée ici », liens Accueil, Missions, Freelances),
  `lang` de la route, `noindex` ; les huit `NOT_FOUND` l'appellent.

### B3. Les pages statiques héritées, liées depuis chaque fiche, sont dans l'ancienne marque, avec des tirets cadratins et une affirmation fausse
- Pages servies et listées dans `sitemap-pages.xml` : `/methode/`, `/en/method/`, `/contact/`, `/en/contact/`,
  `/n/ayoub-hammoudi/`, `/p/FR-7H2XK/`. Toutes : `--bg:#070b14` (bleu nuit), accent `#3fcf9c`, rayon 16 px, ancien
  favicon, 0 token `--ps-*` (capture `kensa/shots/_methode_-1440-dark.png`). Source : `packages/profiles/src/render.ts:22,26`.
- Le lien « Comment nous vérifions » de chaque fiche de preuve y mène (`packages/hub/src/profile-proofs.ts:105`) : le
  visiteur passe du bureau de garantie en noir et blanc à l'ancien site bleu nuit au moment exact où il cherche la méthode.
- Tirets cadratins visibles : titres (« Comment nous vérifions [U+2014] Proofseen ») et corps
  (`render.ts:131,156-160` : « Facture [U+2014] nous contrôlons... »), 2 à 3 occurrences par page.
- Vérité : `/methode/` dit « Chaque mission publiée sur Proofseen a été contrôlée sur au moins une pièce » et, pour
  l'attestation, « Son nom n'est jamais publié ». Le produit vérifie aussi par confirmation du client ou par paiement
  sur la plateforme, sans pièce (`profile-proofs.ts:74-77`), et affiche le nom du client quand il l'a autorisé
  (`profile-proofs.ts:23-24`). La page de méthode contredit la page de preuve.
- Correctif : porter `/methode/` dans le hub (gabarit `pageFrame`, mêmes libellés que `profile-proofs.ts:72-77`, trois
  modes de vérification), puis soit migrer `/contact/`, `/n/...`, `/p/...` vers la marque, soit les rediriger (308) vers
  `/fr/profils/<slug>` et les retirer du sitemap. Ajouter un test qui interdit U+2014 dans tout HTML servi.

## Majeurs

### M1. Le simulateur dit « Vous » pour une mesure qui est celle du fondateur
- `/fr`, section « Une question, suivie jusqu'au compte » : en-tête « Relecture de notre propre mesure », puis
  « Vous : absent de cette réponse » et « Vous apparaissez 0 fois sur 200 » (`apps/web/src/i18n/fr.ts:73-74`, idem en.ts).
  Un visiteur lit un résultat sur lui-même qui n'a jamais été mesuré.
- Correctif : « Notre fondateur : absent de cette réponse », « Notre fondateur apparaît 0 fois sur 200 ».

### M2. Trois pourcentages sans effectif, à côté d'un tableau qui compte autre chose
- « part des citations observées, par domaine : malt.fr 39 %, linkedin.com 26,5 %, github.com 2,9 % »
  (`fr.ts:108-115`) n'a ni n ni date dans le bloc, alors que la figure juste au-dessus compte des réponses
  (malt.fr 231 sur 780, soit 29,6 %). Deux dénominateurs différents dans le même écran, et la page dit elle-même
  « Un pourcentage seul ment par omission ».
- Vérifié cohérent : totaux du tableau (260 par moteur, 780), « sans source » 69/260 = 26,5 %, 236/260 = 90,8 %,
  33/260 = 12,7 % ; borne haute 1,9 % = Wilson à 95 % pour 0/200 (1,88 %).
- Correctif : « malt.fr 39 % (N citations sur M) · vague J0, 23 et 24 septembre 2026 » avec les comptes bruts tirés de
  la même source que le tableau, ou remplacer les barres par les parts de réponses du tableau.

### M3. La carte de profil cache la compétence principale du freelance
- `/fr/freelances` : la fiche « Développeur full stack TypeScript et systèmes IA » affiche Docker, Kafka, Node.js,
  PostgreSQL, Python, React, « +2 » ; TypeScript est dans le « +2 ». La fiche publique les liste dans l'ordre déclaré,
  TypeScript en tête.
- Cause : tri alphabétique `packages/db/src/profile-search.ts:259` et `freelance-lists.ts:150`, puis
  `slice(0, MAX_CARD_TAGS)` dans `packages/hub/src/profile-card.ts:169`.
- Correctif : garder l'ordre déclaré par le freelance (ou faire remonter les compétences filtrées), couper ensuite.

### M4. Un tri « Nombre de faits vérifiés » classe des personnes par un score
- `apps/web/src/i18n/market/search-fr.ts:48` « Nombre de faits vérifiés » ; `packages/db/src/profile-search-ids.ts:87-98`
  ordonne par la somme missions vérifiées + adresses prouvées + SIRET actif + URSSAF. C'est le « tri par nombre de
  preuves » refusé par CONCEPT §5 et la contradiction directe de la phrase publique « Aucun score, aucun classement
  de personnes ». Relevé comme « à regarder » dans la passation ; mon avis : à retirer.
- Correctif : supprimer ce tri ; garder les filtres booléens existants (« Mission vérifiée sur pièce », etc.).

### M5. Le vert sort du vérifié
- Pages publiques du hub : la légende met un carré vert (`ledger.ts:30,73`, `profile-card.ts:250`) sur `/fr/missions`
  et `/fr/entreprises`, qui n'ont aucune mission ni entreprise, et sur l'annuaire dont le seul profil n'a aucune pièce.
  CONCEPT §1 : « Une page sans preuve n'a pas de vert ». Correctif : n'afficher la clé verte que si la page porte au
  moins un élément vert ; sinon la ligne « déclaré » seule.
- CSS de l'application (servi sur toutes les pages `[lang]`, non visible sans session, lu dans le code) : disponibilité
  en vert `discovery.css:123` (`.badge.now`, interdit par STORYBOARD c.3 point 4) ; puces de filtre `discovery.css:69` ;
  cases `discovery.css:39`, `market.css:38`, `workspace.css:132`, `landing.css:21` ; lien `discovery.css:54` ; anneau de
  focus vert `market.css:13` (doit être `--ps-focus`) ; non-lus `market.css:76,77,85` ; messages `workspace.css:266` ;
  survol `workspace.css:253` ; codes E1 à E5 `workspace.css:52` ; graphiques `insights.css:12`, `visibility.css:14,24` ;
  offre mise en avant `landing.css:11` ; `community.css:4`.
- Correctif : `--ps-text`, `--ps-line-strong` ou `--ps-focus` selon le cas ; test qui liste les sélecteurs autorisés à
  lire `--ps-proof` et échoue sur tout autre.

### M6. Quatre bords gauches différents à 1440 px
- Mesuré : en-tête, pied, vitrine, annuaire, entreprises, 404 à x=112 (76rem) ; missions et fiche profil à x=144
  (72rem, `packages/hub/src/job-index.ts:129`, `profile-styles.ts:10`) ; baromètres, blog, article, mentions légales,
  simulateur, métiers, postes à x=256 (58rem centré, `html.ts:21`). `.wrap.wide` est défini deux fois avec deux valeurs
  (`job-index.ts:129` 72rem, `directory-cards.ts:40` 76rem). Le cas missions était connu ; il est systémique.
- Correctif : un seul conteneur `width:min(100% - 2*var(--ps-gutter), var(--ps-max))` pour `main` ; la mesure de
  lecture (`--ps-measure`) s'applique aux blocs de texte, alignés à gauche sur la grille.

### M7. Tirets cadratins dans l'espace connecté (textes visibles)
- `components/insights/BarChart.tsx:44`, `CompanyHomeBoard.tsx:27,80`, `CompanySpend.tsx:74`, `FreelanceMoney.tsx:25,56`,
  `market/Invitations.tsx:15`, `operator/VerificationQueues.tsx:33`, `profile/CredentialSections.tsx:180`.
  Aucun dans les 24 pages publiques du hub et de React servies.
- Correctif : « · » ou « : » selon le cas, valeur vide « non renseigné » ; test de vocabulaire étendu aux composants.

## Mineurs

- m1. Deux pieds de page : React porte « Proofseen mesure votre visibilité dans le recrutement assisté par IA. » et
  « Conditions de vente... sur la page Commander. » (`fr.ts:281-282`, `SiteFooter.tsx:16,25`), le hub non
  (`market-shell.ts:96`). La première phrase raconte l'ancien positionnement ; la seconde renvoie à une page non liée
  qui affiche 49 € et 490 € (`/fr/commande`, noindex). Correctif : un pied unique dans `packages/brand`, phrase alignée
  sur « la preuve de ce qu'un freelance a vraiment livré », ligne Commander retirée ou liée.
- m2. Registre : « autres plateformes » et « domaines non retenus » ont la même hauteur (4 px) et ne diffèrent que par
  le ton, contraste entre eux 1,37:1 (sombre) et 1,49:1 (clair) (`home.css:48-49,77-78`), contre la règle « ton et
  forme ». Correctif : 3 px pour l'un, ou un motif pointillé.
- m3. Poids de la vitrine : HTML `/fr` 189 579 o (dont 155 432 o de scripts RSC), 41 343 o en gzip ; cible du
  storyboard : 60 Ko bruts. `workspace.css` (25 Ko de styles de l'espace connecté) chargé sur toutes les pages `[lang]`
  par `app/[lang]/layout.tsx:6`. Lighthouse non remesuré par moi.
- m4. Arbitrage 6 non appliqué dans l'espace connecté : révélations depuis une opacité nulle `workspace.css:156-157,173,203-204,237` ;
  `CountUp` encore utilisé `app/[lang]/app/page.tsx:49` (refusé par CONCEPT §5). Sur la vitrine, le simulateur efface
  un texte déjà visible puis le réécrit et fait rouler le compteur de 0 à 200 (`home.css:222`, `Simulator.tsx:64-66`) :
  défendable (c'est l'accumulation de n), à trancher face à CONCEPT §5.
- m5. `/en/profils/fr-rvvua` : contenu du freelance en français dans une page `lang="en"` sans `lang="fr"` sur le
  résumé et le titre (WCAG 3.1.2).
- m6. Typographie française : espace ordinaire avant les deux-points, d'où des lignes qui commencent par « : » (méthode
  du baromètre « : une seule entreprise », encart de l'annuaire « : ce qu'il écrit ») ; apostrophes droites côté React,
  courbes dans certains textes du hub. Correctif : espace fine insécable (U+202F) avant les ponctuations doubles au
  rendu, une seule forme d'apostrophe.
- m7. Cibles : « CSV » de `/fr/blog` 22x44 px (largeur sous 24, WCAG 2.5.8) ; « 6 sources » de l'article 67x15 px.
- m8. Baromètre : « 1 mission en propose un » alors que `/fr/missions` dit « Aucune mission n'est ouverte » ; la méthode
  l'explique plus bas. Écrire « 1 mission publiée depuis le 23 juillet 2026 ».
- m9. `.rg-scroll` (tableau du relevé) défile sans `tabindex="0"`, `role="region"` ni nom.
- m10. Carte de profil à 375 : « · confirmée le... » passe à la ligne avec le séparateur en tête (capture
  `lotc/out/recherche-375-light.png`) ; les faits verts de la carte n'ont pas de date (la fiche les a).
- m11. Transition vitrine vers annuaire (STORYBOARD b.11) absente : aucune règle `@view-transition` côté React.
- m12. 1440 : vide d'environ 620 px sous le spécimen (section La pièce) et sous le chapeau (section simulateur).
  Spécimen en `position: sticky` dans sa colonne.

## Ce qui tient (mesuré)

- Hub : 0 script hors JSON-LD sur 17 pages ; aucune chaîne d'opacité nulle, `visibility:hidden` ni `font-size:0` dans
  le HTML ; les deux occurrences `display:none` et `content-visibility` visent `::-webkit-details-marker` et
  `::details-content` (légitimes).
- M1 le relevé : 3 animations `rg-descend` de 1 200 ms décalées de 120 ms, départ après 800 ms ; images figées à 0,
  300, 700, 1 100 et 1 440 ms : la règle descend, aucune case ne change. Sans JS et mouvement réduit : 0 animation,
  règle posée en pied de colonne.
- M2 la frappe : `pc-trace` 640 ms, `pc-strike` 400 ms à 500 ms, `pc-ink` 240 ms à 780 ms ; images figées à 0, 320,
  560, 700, 900 et 1 100 ms conformes au storyboard ; « Rejouer la frappe » fonctionne ; sans JS et réduit : fil tracé,
  cartouche posé. Spécimen étiqueté « données fictives ». Sur le hub (CSS `animation-timeline`), non observable :
  aucune mission vérifiée en base.
- M3 le guichet : `pagereveal.viewTransition` présent à 1440 et à 375 (aller et retour), absent sous mouvement réduit.
  Carte entièrement cliquable (15 points testés, tous dans le lien).
- Contrastes des tokens recalculés : papier et encre AA partout, vert 10,1:1 sur surface (sombre), 5,47:1 sur fond
  vérifié (clair), `--ps-line-strong` de 3,26 à 3,84:1 pour les bords de contrôles.
- Aucun débordement horizontal à 375 sur 17 pages avec `<details>` fermés ; aucun prix sur la vitrine ; « Claude »
  n'apparaît que dans la liste des marques (pied et mentions légales) ; aucun tiret cadratin dans les 24 pages
  publiques servies par le hub et React.

## Non vérifié

Lighthouse (non relancé) ; Safari et Firefox (Chromium seul) ; parcours clavier complet et lecteur d'écran ; thème
clair page par page (vu seulement sur les captures `after-b` et `lotc`) ; espace connecté en rendu (Clerk 400 sur
l'aperçu, revu dans le code seulement) ; M2 du hub sur données réelles ; vrai téléphone.

## Verdict de la porte du chef-d'œuvre : FAIL

La marque, le registre des 780 réponses et la frappe du spécimen tiennent : c'est sobre, vrai, et chaque geste a un
sens. Mais un toucher sur la figure d'ouverture casse la vitrine sur téléphone, un profil introuvable tombe sur une page
blanche sans marque, et le lien « Comment nous vérifions » ramène à l'ancien site avec une méthode qui contredit la fiche.

## Correctifs, dans l'ordre

1. B1 `home.css:26` en `minmax(0, 1fr)`, plus un test mobile avec tous les `<details>` ouverts.
2. B2 404 du hub dans la marque, localisée, avec viewport (8 routes).
3. B3 `/methode/` dans le hub avec les trois modes de vérification réels ; migrer ou rediriger `/contact/`, `/n/`,
   `/p/` ; test anti U+2014 sur tout HTML servi.
4. M1 « Vous » remplacé par « Notre fondateur » dans le simulateur (fr et en).
5. M2 n et date sur les parts de citations.
6. M4 retrait du tri par nombre de faits vérifiés.
7. M3 ordre déclaré des compétences sur la carte.
8. M5 vert : légende conditionnelle, purge des usages hors preuve, test de liste blanche.
9. M6 conteneur unique aligné sur l'en-tête.
10. M7 tirets cadratins de l'espace connecté.
11. Mineurs m1 à m12, en commençant par m1 (pied unique) et m6 (espaces insécables).
