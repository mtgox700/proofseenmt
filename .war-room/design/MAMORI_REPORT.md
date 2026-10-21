# Mamori, vague 7 : mesures de l'aperçu privé de main (Legends League)

Date : 2026-10-21. Cible : conteneur `proofseen-preview` (VPS, `127.0.0.1:3200`), image créée le 2026-10-21 à 13:06:57 UTC.
`origin/main` au moment de la mesure : `8d9e789` (merge PR #77). Le conteneur ne porte pas de label de commit :
la correspondance exacte image = `8d9e789` n'est pas vérifiée.
Aucun fichier du dépôt modifié hors ce rapport, aucun conteneur touché, production lue en `curl` seulement.

Fiche profil retenue : `/fr/profils/fr-rvvua` (seul profil publié, trouvé dans `/fr/freelances`).
Article retenu : `/fr/blog/comment-fixer-son-tjm`.

---

## 1. Lighthouse mobile, 3 passages, lancé sur le VPS

Commande : `docker run --rm --network host -v /root/lh:/lh node:22-bookworm-slim`, chromium installé une seule fois,
puis `npx -y lighthouse@12.8.2 <url> --chrome-flags='--headless=new --no-sandbox' --output=json` enchaîné 18 fois dans
le même conteneur (via un script `/root/lh/w7/run.sh`, mêmes paramètres que la commande du mandat). Réglages relevés
dans les JSON : `formFactor=mobile`, `throttlingMethod=simulate`. 18/18 rapports produits, 0 échec.
Rapports bruts : `/root/lh/w7/*.json` sur le VPS.

| Page | Passage | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS |
|---|---|---|---|---|---|---|---|---|---|
| `/fr` (accueil) | 1 | 0,98 | 1 | 0,96 | 1 | 1359 | 2336 | 70 | 0 |
| `/fr` | 2 | 0,96 | 1 | 0,96 | 1 | 1358 | 2661 | 53 | 0 |
| `/fr` | 3 | 0,96 | 1 | 0,96 | 1 | 1356 | 2667 | 69 | 0 |
| `/fr/profils/fr-rvvua` | 1 | 0,99 | 1 | 0,93 | 1 | 905 | 1280 | 0 | 0 |
| `/fr/profils/fr-rvvua` | 2 | 1 | 1 | 0,93 | 1 | 904 | 1279 | 0 | 0 |
| `/fr/profils/fr-rvvua` | 3 | 0,99 | 1 | 0,93 | 1 | 904 | 1279 | 0 | 0 |
| `/fr/freelances` | 1 | 0,99 | 1 | 1 | 1 | 904 | 1354 | 0 | 0,0010 |
| `/fr/freelances` | 2 | 0,99 | 1 | 1 | 1 | 905 | 1355 | 0 | 0,0010 |
| `/fr/freelances` | 3 | 0,99 | 1 | 1 | 1 | 904 | 1354 | 0 | 0,0010 |
| `/fr/missions` | 1 | 0,99 | 1 | 1 | 1 | 904 | 1504 | 0 | 0,0003 |
| `/fr/missions` | 2 | 0,99 | 1 | 1 | 1 | 903 | 1503 | 0 | 0,0003 |
| `/fr/missions` | 3 | 0,99 | 1 | 1 | 1 | 905 | 1355 | 0 | 0,0003 |
| `/fr/barometre/tjm` | 1 | 1 | 1 | 1 | 1 | 904 | 1279 | 0 | 0 |
| `/fr/barometre/tjm` | 2 | 1 | 1 | 1 | 1 | 902 | 1277 | 0 | 0 |
| `/fr/barometre/tjm` | 3 | 1 | 1 | 1 | 1 | 905 | 1280 | 0 | 0 |
| `/fr/blog` | 1 | 1 | 1 | 1 | 1 | 903 | 1428 | 0 | 0 |
| `/fr/blog` | 2 | 1 | 1 | 1 | 1 | 904 | 1429 | 0 | 0 |
| `/fr/blog` | 3 | 1 | 1 | 1 | 1 | 905 | 1430 | 0 | 0 |

### Audits fautifs (scores < 1)

**Accueil, best-practices 0,96 (3/3 passages)** : un seul audit pondéré en échec, `errors-in-console`, avec exactement
deux entrées : `400` sur `https://clerk.proofseen.com/v1/client?...` et `400` sur `https://clerk.proofseen.com/v1/environment?...`.
Aucune autre cause. C'est la clé Clerk de production qui refuse l'origine `127.0.0.1` : artefact de l'aperçu.

**Profil, best-practices 0,93 (3/3 passages)** : deux audits en échec, une seule cause.
- `errors-in-console` : `net::ERR_BLOCKED_BY_RESPONSE.NotSameSite` sur `https://proofseen.com/fichiers/8fc5542e-...`.
- `inspector-issues` : « Blocked by cross-origin policy », même URL.
La photo est servie en URL absolue `https://proofseen.com/fichiers/...` (`<img class="avatar">`, HTML serveur) et la
production répond `Cross-Origin-Resource-Policy: same-site` (vérifié en `curl -I`). Depuis `127.0.0.1` la ressource est
d'un autre site, donc bloquée ; depuis `proofseen.com` elle est same-origin. Artefact de l'aperçu, mais **non vérifié par
un Lighthouse sur la production** (pas lancé : hors mandat).

Pas d'audit a11y ni SEO en échec sur aucune page.

### Diagnostics de performance (non bloquants, perf >= 0,96 partout)

- Accueil : `render-blocking-resources` 370 ms estimés (4 CSS Next : 303, 303, 303, 153 ms) ; `unused-javascript`
  128 Kio estimés. LCP = `p.hero-lead` (texte), TTFB simulé 453 ms. L'accueil est la page la plus proche du seuil
  (0,96 sur 2 passages sur 3, LCP 2,66 s).
- Pages du hub : `uses-text-compression` 20 à 25 Kio estimés et `unused-css-rules` 11 à 15 Kio. La compression manque
  parce que l'aperçu n'a pas Caddy devant lui : en production, `/root/DEMOEMA/Caddyfile:72` (`encode @compress zstd gzip`)
  compresse tout sauf `/api/messages/stream`, et `https://proofseen.com/fr/freelances` répond bien `Content-Encoding: gzip`.
  Les scores du hub ci-dessus sont donc mesurés sans compression : la production devrait faire au moins aussi bien.
- LCP du hub : toujours un paragraphe texte (`p.lede`, `p.headline`, `div.blank > p`), jamais une image.
- Speed Index du profil instable (3722, 2102, 3474 ms) sans effet sur le score (0,99 à 1) ; cause non investiguée.

---

## 2. Lecture sans JavaScript (HTML serveur, `curl`)

| Page | HTTP | `<script>` total | dont `ld+json` | autres `<script>` | h1 | Contenu principal dans le HTML serveur |
|---|---|---|---|---|---|---|
| `/fr` | 200 | 46 | 0 | 46 (Next.js) | 1 | oui : h1, chiffres du relevé (780 réponses, 26,5 %, 90,8 %, 12,7 %), tableau de répartition (total 780), 9 h2, 14 h3 ; 9 779 caractères de texte hors scripts |
| `/fr/profils/fr-rvvua` | 200 | 1 | 1 | 0 | 1 | oui : identité, TJM 550 € / jour, lieu, disponibilité datée, description, faits vérifiés |
| `/fr/freelances` | 200 | 1 | 1 | 0 | 1 | oui : filtres (formulaire GET), 1 carte `fiche-card` (1 profil publié) |
| `/fr/missions` | 200 | 0 | 0 | 0 | 1 | oui : état vide honnête « Aucune mission n'est ouverte aujourd'hui » (0 mission en base) |
| `/fr/barometre/tjm` | 200 | 1 | 1 | 0 | 1 | oui : date de calcul, seuil n >= 10, effectifs réels (1 profil, 1 mission), aucun chiffre sous le seuil |
| `/fr/blog` | 200 | 1 | 1 | 0 | 1 | oui : 3 articles datés avec résumé |
| `/fr/blog/comment-fixer-son-tjm` | 200 | 1 | 1 | 0 | 1 | oui : article complet, sommaire, 6 sources ; 4 174 caractères dans `<main>` |

- **Hub (profil, freelances, missions, baromètre, blog, article) : zéro `<script>` hors `application/ld+json`.** PASS.
- L'accueil est une page Next.js (46 scripts) : c'est attendu, mais tout son contenu est dans le HTML serveur.
- `display:none` / `opacity:0` / `visibility:hidden` dans le HTML :
  - hub : une seule occurrence par page (freelances, missions), `.drawer>summary::-webkit-details-marker{display:none}`,
    qui masque le triangle natif de `<details>`, pas du contenu. Aucun style inline masquant.
  - accueil : aucun style inline masquant ; un `<div hidden="">` qui ne contient que `<!--$--><!--/$-->` (marqueur
    Suspense vide). Les états cachés de l'animation (`[data-armed]`, `[data-play]`, `[data-playing]`) n'apparaissent pas
    dans le HTML serveur (0 occurrence) : ils ne sont posés que par JS. La règle
    `.showcase-shot:not([data-active]){display:none}` est compensée par `@media (scripting:none){.showcase-tabs{display:none}
    .showcase-view .showcase-shot{display:block}}` : sans JS les deux captures sont affichées.
- Liens internes : 48 chemins distincts sur ces 7 pages, tous 200 sauf 2 en 307 attendus (redirection vers connexion) :
  `/fr/app/contact/FR-RVVUA`, `/fr/app/missions/nouvelle`.

Contrôle navigateur à 375x812 (puppeteer-core + chromium du VPS, JS actif, `no-preference` puis `reduce`, 7 pages) :
`scrollWidth = 375` partout, aucun débordement de page. Les éléments au-delà de 375 px sont dans des conteneurs
défilants voulus (`nav.nav` en `overflow-x:auto`, tableau de l'accueil dans `div.rg-scroll` en `overflow-x:auto`).
Cibles < 24 px relevées : 7 `input.sr-only` 1x1 de l'accueil (radios visuellement masquées, la cible est leur `label`)
et 8 cases à cocher 18x18 de `/fr/freelances`, enveloppées dans `label.check{min-height:2.75rem}` (44 px). Le contrôle
JS coupé n'a pas pu être fait au navigateur (puppeteer ne peut pas évaluer avec JS désactivé) : il repose sur le `curl`
ci-dessus.

---

## 3. SEO / GEO

### Fichiers racine (aperçu et production)

| Fichier | Aperçu | Production | Écart |
|---|---|---|---|
| `/sitemap.xml` | 200, `application/xml`, 696 o, index de 8 sous-sitemaps | 200, 696 o | identique |
| `/robots.txt` | 200, 1 478 o | 200, 1 478 o | identique |
| `/llms.txt` | 200, 4 809 o | 200, 4 809 o | identique |

`robots.txt` : 7 blocs (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `*`),
chacun `Allow: /`, `Allow: /api/profiles.json`, `Disallow: /api/`, `/fr/app`, `/en/app`, `/fr/espace`, `/en/espace`,
et 8 lignes `Sitemap:`.

### Sous-sitemaps : aperçu contre production

| Sous-sitemap | URL aperçu | URL prod | Absentes de l'aperçu | Nouvelles |
|---|---|---|---|---|
| pages | 28 | 28 | 0 | 0 |
| profiles | 2 | 2 | 0 | 0 |
| missions | 0 | 0 | 0 | 0 |
| skills | 0 | 0 | 0 | 0 |
| blog | 9 | 9 | 0 | 0 |
| companies | 0 | 0 | 0 | 0 |
| job-titles | 0 | 0 | 0 | 0 |
| posts | 0 | 0 | 0 | 0 |

**Aucune route de la production ne disparaît des sitemaps.** Les 39 URL listées (pages, profiles, blog) répondent toutes
200 sur l'aperçu, aucune ne contient `noindex` (y compris les pages héritées `/contact/`, `/methode/`,
`/n/ayoub-hammoudi/`, `/p/FR-7H2XK/` et leurs versions `/en/`). Les 33 URL de `llms.txt` répondent 200 (les deux 404
vus au premier passage venaient d'une virgule collée à l'URL dans mon extraction ; `/barometre/tjm.json` et
`/barometre/competences.json` répondent 200 `application/json`).

### Indexation de l'accueil

- Aperçu `/fr` : `<meta name="robots" content="index, follow">`, canonical `https://proofseen.com/fr`, hreflang
  `fr`, `en`, `x-default` (attribut `hrefLang`). `/en` : `index, follow`, canonical `https://proofseen.com/en`.
  Source : `apps/web/src/app/[lang]/page.tsx:29-30`.
- Production `/fr` actuelle : `noindex, nofollow` et pas de canonical, alors que `/fr` figure déjà dans le sitemap.
  Le déploiement corrigera cette contradiction.

### Canonical, hreflang, JSON-LD par page (aperçu)

| Page | canonical | hreflang | JSON-LD (parsé avec `json.loads`) |
|---|---|---|---|
| `/fr` | `/fr` | fr, en, x-default | **absent** |
| `/fr/profils/fr-rvvua` | oui | fr, en, x-default | valide, `ProfilePage` > `mainEntity` `Person` (identifier, jobTitle, address, knowsAbout x8, knowsLanguage x2, image), 978 o |
| `/fr/freelances` | oui | fr, en | valide, `CollectionPage`, 373 o |
| `/fr/missions` | oui | fr, en | absent |
| `/fr/barometre/tjm` | oui | fr, en | valide, `Dataset`, 1 579 o |
| `/fr/blog` | oui | fr, en | valide, `Blog`, 1 010 o |
| `/fr/blog/comment-fixer-son-tjm` | oui | aucun (pas de version EN : `/en/blog/comment-fixer-son-tjm` = 404, cohérent) | valide, `BlogPosting` (headline, datePublished, dateModified, author, publisher, mainEntityOfPage, citation), 1 972 o |

Réciprocité vérifiée sur `/en/freelances`, `/en/profils/fr-rvvua`, `/en/barometre/tjm` : `lang="en"`, canonical EN,
hreflang fr et en. Les 7 pages ont `lang="fr"`, une meta description, une meta viewport, 9 balises `og:` (12 sur
l'article).

Écarts SEO/GEO relevés :
1. **Accueil sans JSON-LD** (ni `Organization` ni `WebSite`), aucune occurrence de `schema.org` dans
   `apps/web/src` sur `origin/main`. La production non plus n'en a pas : pas une régression, mais une page désormais
   indexable sans données structurées, alors que `llms.txt` affirme « with schema.org JSON-LD » pour toute page publique.
2. `/fr/missions` sans JSON-LD (`packages/hub/src/job-index.ts`), même remarque vis-à-vis de `llms.txt`.
3. `x-default` présent sur accueil, profil (`packages/hub/src/profile-page.ts:214`), `pages.ts:53`, `job-page.ts:189`,
   mais absent sur freelances (`profile-directory.ts:169`), missions (`job-index.ts:238`), baromètre et blog
   (`page-frame.ts:59`, piloté par `o.alternates`). Mineur.

---

## 4. Poids

HTML : « brut » = octets décompressés ; « fil aperçu » = octets reçus avec `Accept-Encoding: gzip` sur l'aperçu ;
« gzip -6 » = estimation locale de ce que Caddy enverra en production.

| Page | HTML brut | Fil aperçu | gzip -6 | CSS | CSS gzip |
|---|---|---|---|---|---|
| `/fr` | 189 579 | 41 592 (gzip par Next) | 41 375 | 4 fichiers externes : 25 025 + 17 898 + 23 389 + 340 = 66 652 | fil : 4 622 + 4 510 + 4 591 + 340 = 14 063 |
| `/fr/profils/fr-rvvua` | 31 107 | 31 107 (non compressé) | 7 966 | inline 23 361 | 5 301 |
| `/fr/freelances` | 34 080 | 34 080 (non compressé) | 8 644 | inline 24 721 | 5 427 |
| `/fr/missions` | 27 536 | 27 536 (non compressé) | 6 602 | inline 23 101 | 5 023 |
| `/fr/barometre/tjm` | 33 153 | 33 153 (non compressé) | 8 383 | inline 24 031 | 5 283 |
| `/fr/blog` | 30 850 | 30 850 (non compressé) | 7 593 | inline 22 654 | 5 064 |
| article | 36 809 | 36 809 (non compressé) | 9 065 | inline 24 012 | 5 214 |

Production actuelle (référence, ancien code) : `/fr/freelances` 6 291 o et `/fr/barometre/tjm` 5 235 o sur le fil.
Le CSS inline du hub est passé d'environ 7 à 12,5 Ko bruts en prod à 22,7 à 24,7 Ko bruts sur main (+2,1 à 3,1 Ko gzip
par page). Lighthouse estime 11 à 15 Kio de règles CSS inutilisées par page du hub.

Total transféré mesuré par Lighthouse (aperçu, sans compression du hub) : accueil 445 679 o (16 scripts 300 806 o dont
tiers Clerk 134 703 o sur 6 requêtes, CSS 17 433 o, document 42 359 o, polices 50 536 o) ; profil 86 400 o ;
freelances 89 366 o ; missions 82 820 o ; baromètre 88 443 o ; blog 86 129 o. Hub : 0 script, 0 feuille externe.

Polices (identiques sur les 6 pages mesurées) :
- PS Display `/fonts/ps-display-v1.woff2` : 38 340 o (37,4 Kio), **préchargée** (`<link rel="preload" as="font"
  crossorigin>`) sur les 7 pages, `font-display:swap`.
- PS Mono `/fonts/ps-mono-v1.woff2` : 11 260 o (11,0 Kio), **non préchargée**, `font-display:swap`, chargée sur toutes
  les pages mesurées.
- Repli métrique déclaré (`PS Display Fallback` sur Georgia/Times, `PS Mono Fallback` sur Consolas/Courier New avec
  `size-adjust` et `*-override`) : CLS mesuré 0 à 0,0010.

---

## 5. Reduced motion (CSS servi)

Analyse des feuilles servies (accueil : 4 fichiers `/_next/static/css/*.css` ; hub : `<style>` inline) en suivant
l'imbrication des at-rules.

Accueil :
- `01d8790cd36cd6ad.css` : 2 `@keyframes`, 5 blocs `@media (prefers-reduced-motion:no-preference)` (17 règles, 8
  déclarations animation/transition). Hors garde : 3 transitions d'interface (`.profiles-grid>li`, `.welcome-choice`,
  `.thread-row`, couleur de bordure et transform au survol).
- `367c36b152652659.css` : 2 `@keyframes`, 3 blocs `no-preference`, 2 blocs `reduce` qui posent
  `--ps-dur-strike/ink/reveal/trace:0ms` et `*,:after,:before{animation-duration:.01ms!important;
  animation-iteration-count:1!important;transition-duration:.01ms!important}`. Hors garde : `.btn,.cta` (transition).
  `html{scroll-behavior:smooth}` est sous `no-preference`.
- `695e4ad5ad3c1246.css` : 4 `@keyframes`, toutes les animations (`rg-descend`, `pc-trace`, `pc-strike`, `pc-ink`) sous
  `(scripting:enabled) and (prefers-reduced-motion:no-preference)` ou `no-preference`. Hors garde : 4 transitions
  d'interface (`.rg-cat`, `.rg-chips label`, `.showcase-tabs button`, `.faq summary:after`).
- Toutes les transitions hors garde sont neutralisées par la remise à zéro globale `reduce` du fichier `367c...`, chargé
  sur la même page. Aucune `animation` hors garde. Aucun `@view-transition` sur l'accueil.

Hub :
- Profil : 3 `@keyframes` (`ps-trace`, `ps-strike`, `ps-ink`), utilisés uniquement dans
  `@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){...}}`.
  `@view-transition{navigation:auto}` sous `no-preference`.
- Freelances : 0 `@keyframes`, `@view-transition{navigation:auto}` sous `no-preference`.
- Missions, baromètre, blog, article : 0 `@keyframes`, 0 `@view-transition`.
- Sur les 6 pages du hub, les transitions hors garde (`.btn,.cta`, `.card`, `.entry` ou `.fiche-card`) sont neutralisées
  par `@media (prefers-reduced-motion:reduce){*{transition:none!important}}` et les durées à `0ms`.

Contrôle au navigateur (375x812, `prefers-reduced-motion: reduce` émulé, après défilement complet) :
`document.getAnimations().length = 0` sur les 7 pages ; en `no-preference` l'accueil a 3 animations `rg-descend`, toutes
`finished`. Seul élément de texte invisible dans `<main>`, dans les deux modes : la 2e capture de la vitrine
(`figure.showcase-shot`, `display:none`), qui est l'onglet inactif d'un `tablist` accessible par son bouton, pas un
état d'animation. Image finale complète en `reduce`. Captures pleine page : `/root/lh/w7/pp/{home,freelances}-{no-preference,reduce}.png`
sur le VPS (pas regardées une par une).

**Verdict : chaque `animation` et chaque `@view-transition` est sous `no-preference` ; les transitions d'interface hors
garde sont neutralisées sous `reduce`.** PASS.

---

## Tableau PASS/FAIL contre les budgets du mandat

| Budget | Mesure | Verdict |
|---|---|---|
| Perf mobile >= 0,95 | minimum sur 18 passages : 0,96 (accueil, passages 2 et 3) ; hub 0,99 à 1 | PASS (marge faible sur l'accueil) |
| Accessibilité = 1 | 1 sur 18/18 passages | PASS |
| Best practices = 1 | accueil 0,96 (2 x 400 Clerk, clé de prod refusant 127.0.0.1, seule cause) ; profil 0,93 (photo bloquée par `CORP: same-site` depuis 127.0.0.1) ; 4 autres pages 1 | FAIL sur l'aperçu, imputable à l'origine de l'aperçu dans les deux cas ; à confirmer en production après GO DEPLOY |
| SEO = 1 | 1 sur 18/18 passages | PASS |
| CLS <= 0,05 | maximum 0,0010 | PASS |
| Lisible sans JS | contenu principal dans le HTML serveur sur 7/7 pages ; 0 script hors `ld+json` sur le hub ; aucun masquage de contenu | PASS |
| Reduced motion | 0 animation hors `no-preference` ; `getAnimations() = 0` en `reduce` | PASS |
| Sitemaps sans perte | 0 URL de la production absente ; 39/39 en 200 sans `noindex` | PASS |
| Accueil indexable | `index, follow` + canonical + hreflang | PASS |
| JSON-LD accueil | absent | FAIL (écart, pas régression : absent aussi en prod) |

## Ce qui n'a pas été vérifié

- Lighthouse sur la production (non lancé) : la disparition des deux causes best-practices reste une déduction.
- Contraste AA en thème clair (`prefers-color-scheme: light`) : Lighthouse n'a testé que le thème par défaut.
- Correspondance exacte entre l'image du conteneur `proofseen-preview` et `origin/main 8d9e789`.
- Les captures pleine page produites sur le VPS n'ont pas été examinées visuellement.
- Pages `/en/*` : seulement statut, canonical, hreflang et `robots` ; pas de Lighthouse.
