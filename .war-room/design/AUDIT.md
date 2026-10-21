# AUDIT DU DESIGN ACTUEL : Proofseen (Vague 0, Kage, 2026-10-21)

> Lecture seule du code de `main` (dernier commit `9aa7f5c`) et mesures réseau sur https://proofseen.com le 2026-10-21.
> Chaque fait porte sa source (fichier:ligne, entrée de `TEAM_MEMORY.md` par numéro de ligne, ou requête `curl` datée).
> « Non vérifié » signale ce qui ne l'est pas. Les contradictions sont listées en §6, jamais tranchées ici.
> Comptages : script Python sur `apps/web/src/styles/*.css`, `apps/web/src/**/*.tsx|ts`, `packages/hub/src/*.ts`,
> `apps/landing/src/**` (fichiers de build `.next*`, `dist` et `node_modules` exclus).

---

## 1. Inventaire du système visuel existant

### 1.1 Trois surfaces, trois systèmes

| Surface | Rendu | Où vivent les styles | Polices | Statut |
|---|---|---|---|---|
| `apps/web`, écrans React (vitrine `/[lang]`, espace connecté `/[lang]/app/*`, connexion, commande, inscription) | Next.js 15.5, React 19 | 12 fichiers CSS, 1 251 lignes (`apps/web/src/styles/`) | Inter Variable + Newsreader Variable (fontsource) | **en production** |
| `packages/hub`, pages publiques en HTML brut (missions, profils, freelances, entreprises, métiers, postes, simulateur, blog, baromètres, publications, pages légales) | chaînes HTML servies par des `route.ts` de `apps/web` | CSS en ligne dans chaque document, construit par concaténation de chaînes (`html.ts`, `market-shell.ts`, `page-frame.ts`, `directory-cards.ts`, plus 6 blocs locaux) | **polices système** (Iowan Old Style / Palatino / Georgia et `system-ui`) | **en production** |
| `apps/landing` (Astro 7) | statique | `src/styles/global.css` (20 027 o) | Inter + Newsreader (fontsource) | **non déployée** (voir 1.9) |
| Pages héritées du premier site (`/n/ayoub-hammoudi/`, `/p/FR-7H2XK/`, `/methode/`, `/contact/` et `/en/...`) | HTML figé dans `apps/web/public/legacy/`, servi par réécriture (`apps/web/src/lib/legacy-pages.ts`) | 7 455 o de CSS en ligne par page | Iowan / Palatino | **en production**, 8 pages |

### 1.2 Tokens CSS (`apps/web/src/styles/tokens.css`)

- **Couleurs** (lignes 3-25) : `--bg #070b14`, `--bg-raised #0a111f`, `--surface #0e1626`, `--ink #edf1f7`, `--muted #a3aec2`,
  `--line #1f2a40`, `--line-strong #7c8aa8`, `--proof #3fcf9c` (vert preuve), `--on-proof #06110c`, `--signal #f5a524`,
  `--info #8ab0ff` ; six couleurs de sources pour le champ de réponses (`--src-malt`, `--src-linkedin`, `--src-code`,
  `--src-platform`, `--src-other`, `--src-none`) ; quatre teintes dérivées par `color-mix` (`--proof-wash`,
  `--signal-wash`, `--surface-hi`, `--scrim`). Aucun token `--danger` côté CSS (le rouge `#f97066` n'existe que dans
  `AuthProvider.tsx:21`, pour Clerk).
- **Échelle typographique** : 7 pas fluides `--step--2` à `--step-4` (`clamp`, lignes 36-42), de 0,75 rem à 5,2 rem.
- **Espacements** : `--space-1/2/3/4/6/8/12/16` (base 4 px), `--gutter` fluide, `--max: 76rem`.
- **Rayon** : un seul, `--radius: 6px` (ligne 55, « an instrument has edges, not bubbles »).
- **Ombres** : aucun token. **Mouvement** : `--ease-out`, `--ease-in-out`, `--dur-press 120ms`, `--dur-ui 180ms`.
- **Couches** : `--z-header 10`, `--z-skip 20`.
- `color-scheme: dark` : **thème sombre unique**, aucun thème clair (décision founder du 2026-09-19, `foundations/DESIGN_WEB.md` §5).

Le hub redéclare la même palette sous d'**autres noms** (`packages/hub/src/html.ts:16-18`) : `--raised`, `--strong`,
`--accent`, `--on-accent`, `--warn`, `--focus` au lieu de `--bg-raised`, `--line-strong`, `--proof`, `--on-proof`,
`--signal`, `--info`. Aucune échelle typographique, aucun espacement, aucun rayon en token côté hub.

`apps/landing/src/styles/global.css:3-30` redéclare la palette (noms de `apps/web`) avec **une autre échelle**
(`--step-4` à 6,4 rem au lieu de 5,2 rem) et **un autre rayon** (`--radius: 10px`), plus `--shadow` et `--glow`.

### 1.3 Polices

| Où | Familles | Chargement | Mesure |
|---|---|---|---|
| `apps/web` | Inter Variable, Newsreader Variable | `import "@fontsource-variable/.../wght.css"` dans `apps/web/src/app/[lang]/layout.tsx:1-2` | CSS servie en prod : **12 `@font-face`** (cyrillique, grec, vietnamien, latin-ext, latin), `font-display: swap` ; **aucun préchargement** de police dans le HTML de `/fr` (curl 2026-10-21) |
| fichiers latins | Inter latin 48 256 o, Newsreader latin 58 084 o (woff2) | | `node_modules/@fontsource-variable/*/files/` |
| graisses | wght variable seul, **aucun fichier italique** | | `landing.css:18` met `.hero h1 em` en `font-style: italic` : italique **synthétisé** par le navigateur sur le mot « trouvé ? » du titre principal |
| secours | `Newsreader Fallback` (Georgia, `size-adjust 94%`), `Inter Fallback` (Arial, 107 %) | `tokens.css:71-86` | calés pour CLS nul |
| `--mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas` (pas de JetBrains Mono) | | |
| `packages/hub` | Iowan Old Style / Palatino Linotype / Georgia et `system-ui` | aucune requête, choix assumé : « System fonts only: zero network request » (`html.ts:11-13`) | même page vue en React et en hub : deux serifs différents |

Écart avec le budget écrit : `foundations/MARQUE.md` §5 et `DESIGN_WEB.md` §3 demandent « sous-ensemble latin, préchargement
de la seule police LCP » ; le code charge tous les sous-ensembles sans préchargement.

### 1.4 Échelle typographique réellement utilisée (tailles distinctes, `font-size` et raccourci `font:`)

| Périmètre | Tailles distinctes | Hors échelle (littérales) |
|---|---|---|
| `apps/web/src/styles/*.css` | 18 | 11 (`16px` x7 pour les champs, `1.15rem`, `0.92em`, `1.05em`, `1.12rem`, `1rem`, `11px`, `0.875rem`, `0.9375rem`, deux `clamp()` de titres) |
| `packages/hub/src/*.ts` | **25** | **25** (aucune ne passe par une échelle : `.72rem`, `.74rem`, `.76rem`, `.78rem`, `.8rem`, `.85rem`, `.88rem`, `.9rem`, `.92rem`, `.95rem`, `.98rem`, `1rem`, `1.0625rem`, `1.05rem`, `1.12rem`, `1.15rem`, `1.2rem`, `1.35rem`, `1.6rem`, 4 `clamp()`, `16px`, `.9em`) |
| `apps/landing` | 15 | 9 |
| `apps/web/src/lib/pwa/offline-page.ts` | 2 | 2 |

Graisses : `apps/web` 400/500/600/700 ; hub 400/500/600/700 ; titres en 500 côté React (`base.css` h1-h3), en **600** côté hub (`html.ts` h1-h3).

### 1.5 Rayons et ombres

| Périmètre | Rayons distincts | Valeurs | Ombres distinctes |
|---|---|---|---|
| `apps/web` CSS | 9 | `var(--radius)` x45, `calc(var(--radius) + 4px)` x18, `50%` x10, `999px` x5, `1px`, `2px`, `calc(+6px)`, `8px`, `10px` | 4 (toutes des halos colorés `color-mix(... --proof ...)` ou `--info`) |
| `packages/hub` | 9 | `12px` x9, `999px` x8, `14px` x4, `8px` x4, `50%` x4, `10px` x3, `16px` x2, `4px`, `6px` | 3 `box-shadow` + 1 `text-shadow` lumineux (`html.ts:74`, `.fact .v`) |
| `apps/landing` | 9 | `999px` x9, `50%` x6, `6px`, `14px`, `18px`, `12px`, `7px`, `4px`, `var(--radius)` | 7 |

Conséquence visible : le bouton principal est un **rectangle à 6 px** en React (`base.css`, `.btn-primary`) et une **pilule à
999 px avec halo vert** sur les pages du hub (`html.ts:45`, `.cta`) ; capture `before/desktop-03-profil.png`.

### 1.6 Composants partagés

- `apps/web/src/components/` : 101 fichiers `.tsx` en 18 dossiers (landing 12, market 25, insights 12, visibility 8, search 7,
  profile 7, community 5, live 5, operator 4, app 2, motion 2, pwa 2, workspace 2, auth/intake/order/settings 1 chacun,
  plus `EmptyState`, `LangSwitch`, `Logo`, `NextSteps`, `SiteFooter`, `SiteHeader` à la racine). 24 composants `"use client"`.
- Primitives CSS de `base.css` : `.btn`, `.btn-primary`, `.tag` (`-proof`, `-signal`, `-quiet`), `.kicker` (le glyphe
  intervalle en surtitre), `.bullets`, `.wrap`, `.skip`, `.sr-only`, `.site-header`, `.nav`, `.site-footer`.
- Pas de bibliothèque de composants, pas de Tailwind, pas de bibliothèque d'icônes (dépendances : `apps/web/package.json`).
- Côté hub, l'équivalent est une collection de classes en chaînes : `.top`, `.foot`, `.cta`, `.card`, `.fact`, `.links`,
  `.context`, `.status`, `.tags`, `.pcard`, `.chips`, `.prose`, `.toc`, `.table`, `.note`.

### 1.7 Icônes

- **Aucun système d'icônes.** 2 SVG en ligne dans tous les composants React : `Logo.tsx` et `insights/BarChart.tsx`.
- Côté hub, les seuls signes graphiques sont des pseudo-éléments CSS : le glyphe intervalle (`h2::before`, `html.ts`),
  la flèche texte « → » (`.links a::after`) et la pastille `.status i`.

### 1.8 Logo, favicon, icônes PWA, carte de partage

| Élément | Fichier | Constat |
|---|---|---|
| Symbole en en-tête React | `apps/web/src/components/Logo.tsx` (viewBox 40x20, point r=4,6) + mot « Proofseen » en Newsreader 600 (`base.css`, `.brand`) | Pas de logotype dessiné : le mot est du texte. |
| En-tête du hub | `packages/hub/src/market-shell.ts`, `<a class="me">Proofseen</a>` | **Texte seul, sans symbole.** |
| Favicon React | `apps/web/src/app/[lang]/icon.svg` | Couleurs de l'**ancien thème clair** de `MARQUE.md` §6 (`#0f1b2d`, `#0b6e54`), pas de la palette sombre en service. |
| Favicon hub | `packages/hub/src/pages.ts:8-13`, data-URI | Troisième dessin : carré arrondi `rx=9` fond `#070b14`, point `#3fcf9c`. |
| Favicon landing | `apps/landing/public/favicon.svg` | Quatrième fichier (non comparé en détail). |
| Icônes PWA | `apps/web/public/icons/` (192, 512, maskable 192/512, badge 96) + `apps/web/src/app/[lang]/app/apple-icon.png` (180) | Générées par `apps/web/scripts/pwa-icons.ts` depuis le tracé de `icon.svg`, recolorées en sombre ; vues : barre blanche, point vert, fond nuit. |
| Carte de partage (og:image, twitter:card) | **aucune** | `grep og:image|openGraph|twitter:card` sur `apps/web/src`, `packages/hub/src`, `apps/landing/src` : 0 résultat. |
| Livrables de marque | **aucun** | Pas de `public/brand/`, pas de logotype, pas de version monochrome. |

### 1.9 Thème, `theme-color`, `color-scheme`

- Thème **sombre seul** partout. `theme-color` unique `#070b14` : `apps/web/src/app/[lang]/layout.tsx:27` (et `colorScheme: "dark"`, ligne 25).
- Le hub a **12 constructeurs de document** (`<!doctype html>` dans 12 fichiers : `city-page`, `company-directory`,
  `company-page`, `job-index`, `job-page`, `page-frame`, `pages`, `post-page`, `profile-directory`, `profile-page`,
  `skill-index`, `skill-page`). **Un seul** déclare `theme-color` (`pages.ts:39`, pages héritées). 11 sur 12 déclarent
  `color-scheme: dark` ; aucun n'a de variante claire.

### 1.10 `apps/landing` (Astro) : déployée ou morte ?

**Non déployée.** Preuves :
- `Dockerfile:14` ne construit que `pnpm --filter @proofseen/web build` ; `Dockerfile:16` ne lance que `@proofseen/web`.
- `deploy/vps/Caddyfile.proofseen` ne proxifie que `proofseen-web:3100` ; `deploy/vps/docker-compose.yml` n'a qu'une image `proofseen-web`.
- `TEAM_MEMORY.md:685` (2026-10-20) : « `apps/landing` n'est plus déployée : laissée telle quelle ».
- Dernier commit touchant `apps/landing` : `a946a75`, 2026-10-06.
- La vitrine servie sur https://proofseen.com/fr est `apps/web/src/app/[lang]/page.tsx` (composants `components/landing/*`).
- Restent dans le dépôt : `apps/landing/dist/` (build ancien) et les scripts `landing:*` de `package.json:25-27`.

### 1.11 Poids mesurés en production (curl, 2026-10-21)

| Page | HTML | CSS | Scripts |
|---|---|---|---|
| `/fr` (vitrine React) | **240 875 o** (38 569 o gzip), dont **214 378 caractères de charge RSC** (`self.__next_f.push`) : les 780 points du champ de réponses sérialisés pour `AnswerField` (783 occurrences de `control`) | 1 feuille externe de **53 292 o** (10 202 o gzip) qui contient `landing.css` **et** `workspace.css` (importées pour toutes les routes par `layout.tsx:5-6`) | 35 balises `<script>`, dont `ui.browser.js` de Clerk préchargé (`clerk.proofseen.com`) sur la vitrine publique |
| `/fr/freelances` (hub) | 19 915 o | 12 535 o en ligne | 1 (JSON-LD) |
| `/fr/entreprises` | 16 821 o | 12 535 o | 1 |
| `/fr/simulateur` | 28 831 o | 9 255 o | 1 |
| `/fr/barometre/tjm` | 15 239 o | 8 447 o | 1 |
| `/fr/blog` | 14 458 o | 8 447 o | 1 |
| `/fr/mentions-legales` | 15 327 o | 8 844 o | 1 |
| `/fr/missions` | 11 570 o | 7 671 o | 0 |
| `/fr/metiers` | 9 596 o | 6 714 o | 1 |
| pages héritées | 10 034 à 11 483 o | 7 455 o | 1 |

Sur une page du hub, la CSS en ligne pèse **58 % à 70 %** du document, répétée à chaque page (pas de cache partagé).

---

## 2. Carte des écrans, par lot de la refonte

Légende du rendu : **R** = React (Next.js), **H** = hub HTML brut (`packages/hub` via `route.ts`), **L** = HTML figé hérité.
« Sans JS » = doit rester lisible sans JavaScript (hors JSON-LD), vérifié par tests du hub et `marketplace-verify`.

### a. Tokens, polices, logo, layout global

| Élément | Fichier(s) | Rendu |
|---|---|---|
| Tokens, base, primitives | `apps/web/src/styles/tokens.css`, `base.css` | R |
| Layout racine (html, skip link, Clerk, CSS globale, metadata, viewport) | `apps/web/src/app/[lang]/layout.tsx` (il n'existe pas de `app/layout.tsx`) | R |
| En-tête, pied, logo, langue | `components/SiteHeader.tsx`, `SiteFooter.tsx`, `Logo.tsx`, `LangSwitch.tsx` | R |
| Coquille de l'espace connecté | `app/[lang]/app/layout.tsx`, `components/app/AppShell.tsx`, `components/workspace/WorkspaceNav.tsx` | R |
| Habillage Clerk (couleurs codées en dur) | `components/auth/AuthProvider.tsx:13-21` | R |
| Favicon, icônes PWA, manifeste | `app/[lang]/icon.svg`, `public/icons/*`, `app/[lang]/app/apple-icon.png`, `scripts/pwa-icons.ts`, `lib/pwa/manifest.ts`, `app/[lang]/app.webmanifest/route.ts` | R |
| Socle du hub (palette, en-tête, pied, cadre) | `packages/hub/src/html.ts`, `market-shell.ts`, `page-frame.ts`, `directory-cards.ts`, `pages.ts` (favicon) | H |
| Socle de la landing Astro | `apps/landing/src/styles/global.css`, `layouts/Base.astro`, `components/Logo.astro` | Astro (non déployée) |

Note : l'en-tête React compte 7 liens + bouton (sans « Entreprises », `SiteHeader.tsx`) ; l'en-tête du hub en compte 9
(avec « Entreprises », `market-shell.ts`). Le menu change selon la page qu'on ouvre.

### b. Vitrine

| Route | Fichier | Rendu | Sans JS |
|---|---|---|---|
| `/fr`, `/en` (accueil public servi) | `app/[lang]/page.tsx` : `Hero` (avec `AnswerField`, client), `Journey` (`Simulator`, client), `Method`, `Study`, `Deliverable` (`Showcase`), `Offers`, `Companies`, `Charter`, `Faq` | R | contenu en composants serveur ; `InView` n'arme l'animation qu'avec JS (`motion/InView.tsx`) ; noindex aujourd'hui (voir §4.1) |
| `/fr/commande` | `app/[lang]/commande/page.tsx` | R | non exigé |
| `/fr/simulateur` | `app/[lang]/simulateur/route.ts` → `renderSimulatorPage` (`hub/src/simulator-page.ts`) | H | **oui** (formulaire GET) |
| `/methode/`, `/en/method/`, `/contact/`, `/en/contact/` | `public/legacy/...` | L | oui |
| Landing Astro (`/`, `/en/`, `/commande/`) | `apps/landing/src/pages/*` | Astro | non déployée |

### c. Accueil de la marketplace

| Route | Fichier | Rendu | Sans JS |
|---|---|---|---|
| `/` | redirection 307 vers `/fr` (`next.config.ts`, `redirects`) | | |
| `/fr`, `/en` | idem lot b : aujourd'hui **la vitrine est l'accueil de la marketplace**, il n'y a qu'une page d'accueil publique | R | voir b |
| `/fr/app` (accueil connecté freelance ou entreprise) | `app/[lang]/app/page.tsx`, `components/insights/FreelanceHomeBoard.tsx`, `CompanyHomeBoard.tsx`, `visibility/FirstSteps.tsx`, `NextSteps.tsx` | R | non exigé (noindex) |
| `/fr/app/bienvenue`, `/fr/inscription` | `app/[lang]/app/bienvenue/page.tsx`, `app/[lang]/inscription/page.tsx` (`intake.css`) | R | non exigé |
| `/fr/connexion`, `/fr/creer-un-compte` | `app/[lang]/connexion/[[...rest]]/page.tsx`, `creer-un-compte/...` (Clerk) | R | non |

### d. Profil et page de preuve

| Route | Fichier | Rendu | Sans JS |
|---|---|---|---|
| `/fr/profils/[slug]` (page publique d'un profil) | `app/[lang]/profils/[slug]/route.ts` → `renderProfilePage` (`hub/src/profile-page.ts`, `profile-sections.ts`) | H | **oui**, `ProfilePage` JSON-LD |
| `/fr/freelances` (annuaire) | `app/[lang]/freelances/route.ts` → `renderProfileDirectory` (`profile-directory.ts`, `directory-cards.ts`) | H | **oui** |
| `/n/ayoub-hammoudi/`, `/p/FR-7H2XK/` (+ `/en/`) | `public/legacy/...` | L | oui |
| `/fr/espace/[reference]` (espace client par lien signé) | `app/[lang]/espace/[reference]/page.tsx` | R | noindex |
| `/fr/confirmer-mission/[id]` (le client confirme une mission déclarée, sans compte) | `app/[lang]/confirmer-mission/[id]/page.tsx` | R | noindex |
| Espace connecté : profil, preuves, visibilité IA, confirmations, contact | `app/[lang]/app/{profil,preuves,visibilite,confirmations,contact/[reference]}/page.tsx`, `components/profile/*`, `components/visibility/*` | R | non exigé |

### e. Missions et entreprises

| Route | Fichier | Rendu | Sans JS |
|---|---|---|---|
| `/fr/missions`, `/fr/missions/[id]`, `/fr/missions/ville/[city]` | `route.ts` → `renderJobIndex`, `renderJobPage` (`JobPosting`), `renderCityPage` | H | **oui** |
| `/fr/entreprises`, `/fr/entreprises/[slug]` | `renderCompanyDirectory`, `renderCompanyPage` | H | **oui** |
| `/fr/metiers`, `/fr/metiers/[key]`, `/fr/postes`, `/fr/postes/[key]` | `renderSkillIndex`, `renderSkillPage`, `renderJobTitleIndex`, `renderJobTitlePage` | H | **oui** |
| Espace connecté missions (liste, pour vous, enregistrées, nouvelle, modifier, postuler, candidatures) | `app/[lang]/app/missions/**/page.tsx` (7 pages) | R | non exigé |
| Recherche, listes, entreprises suivies, annuaire connecté | `app/[lang]/app/{recherche,recherche/enregistree/[id],listes,listes/[id],entreprises,entreprises-suivies}/page.tsx` (`discovery.css`) | R | non exigé |
| Messages, contrats, factures, facturation, équipe, page publique d'entreprise, invitations | `app/[lang]/app/{messages,messages/[id],contrats,contrats/[id],factures,facturation,equipe,equipe/page-publique,invitations,invitations/[id]}/page.tsx` | R | non exigé |

### f. Baromètre et blog

| Route | Fichier | Rendu | Sans JS |
|---|---|---|---|
| `/fr/barometre/tjm`, `/fr/barometre/competences` | `renderRateBarometer`, `renderSkillBarometer` (`barometer-rates.ts`, `barometer-skills.ts`, cadre `page-frame.ts`) | H | **oui**, `Dataset` JSON-LD |
| `/barometre/{tjm,competences}.{csv,json}` | `app/barometre/*/route.ts` | données | |
| `/fr/barometre` (index) | **n'existe pas** : 404 mesuré en prod le 2026-10-21 | | |
| `/fr/blog`, `/fr/blog/[slug]`, `/fr/blog/rss.xml` | `renderBlogIndex`, `renderArticlePage`, flux RSS | H | **oui** |
| `/fr/publications/[id]` | `renderPostPage` (`post-page.ts`) | H | **oui** |
| Espace connecté : fil, abonnements, articles (rédaction) | `app/[lang]/app/{fil,fil/[id],abonnements,articles,articles/[id],articles/nouveau}/page.tsx` (`community.css`) | R | non exigé |
| Pages légales | `/fr/{mentions-legales,confidentialite,conditions}` → `lib/legal-route.ts` → `hub/src/legal-*.ts` | H | **oui** |

### g. États vides, erreurs, chargement, 404, hors ligne

| État | Fichier | Constat |
|---|---|---|
| 404 sous `[lang]` (appel à `notFound()`) | `app/[lang]/not-found.tsx` | Toujours en **français** (`dictionary("fr")`, commentaire ligne 4). |
| 404 d'une adresse inconnue | **aucun `app/not-found.tsx`** | Mesuré en prod (`/fr/n-existe-pas`, `/fr/barometre`, 2026-10-21) : page Next par défaut, fond blanc, « This page could not be found. », en anglais, 5 311 o. Captures `before/desktop-06-barometre.png` et `desktop-09-404.png` identiques (même MD5 `9a37f427...`). |
| Erreur | **aucun** `error.tsx` ni `global-error.tsx` | |
| Chargement | **aucun** `loading.tsx` | |
| Hors ligne (PWA) | `app/offline/route.ts` → `lib/pwa/offline-page.ts` | HTML autonome, palette recopiée en dur (ligne 15). |
| États vides | `components/EmptyState.tsx` (utilisé dans 15 fichiers), états vides des annuaires du hub | Honnêtes, sans chiffre fictif. |
| Indisponibilités | `components/app/AuthUnavailable.tsx`, `components/market/MarketUnavailable.tsx`, `app/[lang]/app/suspendu/page.tsx` | |

Hors lots (suivent le lot a) : réglages, notifications, alertes, back-office opérateur (`app/[lang]/app/operateur/**`, 11 pages, `operator.css`). L'espace connecté compte **52 `page.tsx`**.

---

## 3. Ce qui est mauvais, chiffré

### 3.1 Absence de marque
1. **Pas de logotype** : le nom est du texte en Newsreader (React) ou en Iowan/Palatino (hub). **Quatre dessins** du symbole qui divergent (`Logo.tsx`, `icon.svg`, favicon data-URI `hub/src/pages.ts:8-13`, `apps/landing/public/favicon.svg`), dont un aux couleurs d'un thème abandonné (`icon.svg`).
2. **Le hub n'affiche aucun symbole** (`market-shell.ts`, `<a class="me">Proofseen</a>`) : les pages les plus visitées par les robots et les recruteurs (profils, missions) n'ont pas de marque visuelle.
3. **Aucune carte de partage** (0 `og:image`) : un lien collé sur LinkedIn ou Slack n'a pas d'aperçu.
4. Aucun livrable de marque (`public/brand/` absent).

### 3.2 Incohérences entre surfaces
5. **Deux typographies** pour un même produit : Newsreader + Inter (React) et Iowan/Palatino + `system-ui` (hub, `html.ts:17`). Titres en 500 d'un côté, 600 de l'autre.
6. **Deux jeux de noms de tokens** pour la même palette (`tokens.css` contre `html.ts:16`) et un troisième jeu d'échelle et de rayon dans `apps/landing`.
7. **La palette est recopiée en dur dans 11 fichiers sources** (`#070b14` trouvé dans : `tokens.css:4`, `layout.tsx:27`, `AuthProvider.tsx:15`, `lib/pwa/manifest.ts:12`, `lib/pwa/offline-page.ts:15,34`, `scripts/pwa-icons.ts:17`, `hub/src/html.ts:16`, `hub/src/pages.ts:11,39`, `packages/profiles/src/render.ts:26,288`, `apps/landing/src/styles/global.css:4`, `apps/landing/src/layouts/Base.astro:61`). Hors `tokens.css` : 10 occurrences hex dans les `.tsx` (7 valeurs distinctes, toutes dans `AuthProvider.tsx` et `layout.tsx`), 9 dans les `.ts` de `apps/web` (`offline-page.ts`, `manifest.ts`), 15 dans le hub (11 valeurs), 15 dans `apps/landing` (13 valeurs).
   À l'inverse, **les 12 fichiers CSS de `apps/web` ne contiennent aucune couleur hex hors `tokens.css`** et aucun `rgb()` : la discipline des tokens y est tenue.
8. **25 tailles de police littérales dans le hub**, aucune sur une échelle (§1.4), contre 7 pas d'échelle en React.
9. **Rayons** : 9 valeurs distinctes dans chacune des trois surfaces ; le principe « un seul rayon » de `tokens.css:54` est contredit par le hub (12, 14, 16, 999 px) et par `apps/web` lui-même (`calc(var(--radius) + 4px)` x18, `999px` x5, `8px`, `10px`).
10. **Bouton principal** : rectangle 6 px (React) contre pilule 999 px avec halo (hub `.cta`, `html.ts:45`).
11. **Carte de profil définie deux fois** : `.pcard` dans `apps/web/src/styles/discovery.css:89-119` et dans `packages/hub/src/directory-cards.ts:64-77`, avec des valeurs différentes (focus `--info 60%` contre `--focus`, ombres différentes). 41 noms de classes communs aux deux CSS (`pcard`, `pc-head`, `pc-name`, `avatar`, `tone-1..4`, `post-body`, `chips`, `badge`...), définis deux fois.
12. **En-têtes différents** : 7 liens + bouton (React) contre 9 liens + pilule de langue (hub). « Entreprises » absent du menu React.
13. **12 constructeurs de document HTML** dans le hub, chacun avec son `<head>` (§1.9) : tout changement de marque (favicon, `theme-color`, police) se fait en 12 endroits plus `pages.ts`.

### 3.3 Effets décoratifs contraires à l'anti-slop du mandat
14. Halo radial vert en fond de **toutes** les pages du hub (`html.ts:21`, `radial-gradient(... --accent 13% ...)`), dégradé sur les cartes (`html.ts:50`), `text-shadow` lumineux sur les chiffres (`html.ts:74`), halos colorés sur 4 ombres de `apps/web` et 7 de la landing.
15. En-tête React en `backdrop-filter: blur(10px)` (`base.css`, `.site-header`) : flou décoratif.

### 3.4 Accessibilité visible dans le code
16. **Contrastes** (calcul WCAG 2.x, 2026-10-21, sur `--bg #070b14` / `--surface #0e1626`) : `ink` 17,36 / 15,95 ; `muted` 8,80 / 8,09 ; `line-strong` 5,68 / 5,22 ; `proof` 9,95 / 9,14 ; `signal` 9,64 ; `info` 9,12 ; `on-proof` sur `proof` 9,71. **Douteux** : `--src-other #465573` 2,63 / 2,42 et `--src-none #3a4a6b` 2,22 / 2,04 (points du champ de réponses, sous 3:1 si on les considère comme objets graphiques porteurs de sens, WCAG 1.4.11 : à trancher par Mamori) ; `--src-linkedin #4f74c8` 4,37 / 4,02 (passe 3:1, échoue 4,5:1 s'il sert à du texte, usage non vérifié) ; `--line #1f2a40` 1,37 (décoratif seulement : aucun champ de formulaire ne l'utilise comme bordure, vérifié par grep).
17. **Pas de lien d'évitement sur les pages du hub** (0 `class="skip"` dans `packages/hub/src`, vérifié sur `/fr/freelances` en prod) : 11 arrêts de tabulation avant le contenu. Le React en a un (`layout.tsx`, `.skip`).
18. **Focus** : global en React (`base.css`, `:focus-visible`, 2 px `--info`) ; dans le hub, seul `a:focus-visible` est défini dans le socle (`html.ts:23`), le reste au cas par cas (`directory-cards.ts:48,53,58`, `simulator-page.ts:21`) ; le formulaire de filtres des missions (`job-index.ts:97`) s'appuie sur le focus par défaut du navigateur.
19. **Survol non réservé aux appareils qui survolent** : 8 règles `:hover` dans le hub pour 1 seule requête `(hover:hover)` (`html.ts` x5 dont `.card:hover` avec `translateY(-2px)`, `market-shell.ts` x1, `directory-cards.ts` x2). Côté `apps/web` : 24 `:hover`, 19 sous `(hover: hover)` ; les 5 restants (`discovery.css` 3, `operator.css` 1, `base.css` 1) non vérifiés un par un.
20. **Italique synthétisé** dans le titre de la vitrine (`landing.css:18`, aucun fichier italique chargé).
21. **Tiret cadratin dans du texte visible** : 22 lignes de code (hors commentaires) dans `packages/hub/src` (dont le suffixe « [U+2014] Proofseen » de **chaque `<title>`** : `page-frame.ts:61`, `city-page.ts:137`, `company-directory.ts:226`, `company-page.ts:149`, `job-index.ts:189`, `post-page.ts:204`, `profile-directory.ts:349`, `skill-index.ts:71`, `skill-page.ts:161`, plus `job-page.ts:117`, `profile-page.ts:230`, `pages.ts:129,169`, `blog-feed.ts:11-12`, `barometer-*.ts`, `legal-notice.ts:27,35`), 18 dans `apps/web/src` (dont les niveaux de langue `profile-sections-fr.ts:105` « C1 [U+2014] autonome » et les valeurs vides « [U+2014] » des tableaux), 16 dans `apps/landing/src`.

### 3.5 Performance et poids
22. **Vitrine `/fr` : 240 875 o de HTML**, dont 214 378 caractères de charge RSC pour les 780 points de `AnswerField` (§1.11). Le LCP reste du texte, mais la page porte 10 fois le poids d'une page du hub.
23. **CSS globale de 53 292 o** chargée sur toutes les routes React : `layout.tsx:5-6` importe `landing.css` (23 872 o source) et `workspace.css` (24 727 o) partout, y compris dans l'espace connecté et sur la connexion.
24. **12 `@font-face`** (cyrillique, grec, vietnamien inclus), aucun préchargement (§1.3).
25. **Script de Clerk préchargé sur la vitrine publique** (`ui.browser.js`, `clerk.proofseen.com`), alors que la vitrine ne demande aucune session.
26. CSS du hub **répétée en ligne à chaque page** : 6,7 à 12,5 Ko par document (§1.11).
27. Captures `before/desktop-01-accueil.png` : grandes zones vides sous « Cinq étapes » et plus bas. Hypothèse non vérifiée : `content-visibility: auto` (`landing.css:4`) non rendu par la capture pleine page ; à confirmer par une capture défilée.

### 3.6 États manquants
28. **404 par défaut de Next, blanc et en anglais**, sur toute adresse inconnue (mesuré). `not-found.tsx` sous `[lang]` toujours en français.
29. **Aucun `loading.tsx`, `error.tsx`, `global-error.tsx`** dans tout `apps/web/src/app`.
30. **Pas de page `/fr/barometre`** : l'adresse naturelle du baromètre répond 404.

---

## 4. Contraintes intouchables

### 4.1 SEO et GEO (mesuré en prod le 2026-10-21)
- `robots.txt` (`app/robots.txt/route.ts`, généré par le hub) : autorise explicitement Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, Claude-User et les autres robots d'IA ; interdit `/api/` (sauf `/api/profiles.json`), `/fr/app`, `/en/app`, `/fr/espace`, `/en/espace`.
- `llms.txt` (`app/llms.txt/route.ts` → `hub/src/llms-txt.ts`) : décrit le produit, liste les pages publiques, les articles et les sitemaps. Il affirme que « every public page is plain server-rendered HTML ... readable without JavaScript, with schema.org JSON-LD ».
- **9 sitemaps** : index `sitemap.xml` + `pages`, `missions`, `profiles`, `skills`, `blog`, `companies`, `job-titles`, `posts`.
- **JSON-LD** émis par le hub : `ProfilePage`, `Person`, `JobPosting`, `Organization`, `CollectionPage`, `ItemList`, `FAQPage`, `Blog`, `BlogPosting`, `Dataset`, `DataDownload`, `SocialMediaPosting`, `WebApplication`, `EducationalOccupationalCredential` et types imbriqués (30 types distincts). Règle : **aucune note agrégée** dans `ProfilePage` (`TEAM_MEMORY.md:631`).
- **Routes `[lang]`** : `generateStaticParams` sur `fr` et `en`, `dynamicParams = false` (`layout.tsx`) ; adresses publiques identiques dans les deux langues (`/fr/missions`, `/en/missions`) ; `hreflang` sur les pages du hub.
- **Pages héritées** servies à leur adresse indexée, avec barre oblique finale, octet pour octet depuis `public/legacy/` (`lib/legacy-pages.ts`, `next.config.ts`, `skipTrailingSlashRedirect`) : y toucher change ce que Google a indexé.
- **IndexNow** à chaque publication (`indexnow-key.txt`, `data/indexnow.ts`).
- **Constat à arbitrer** : `/fr` et `/en` sont dans `sitemap-pages.xml` mais portent `<meta name="robots" content="noindex, nofollow">` en prod, hérité de `layout.tsx:38` (aucune `metadata` dans `page.tsx`). Voir §6, conflit 2.

### 4.2 `marketplace-verify` (`packages/hub/src/marketplace-verify.ts:94-110`)
Contrôles qui doivent rester verts sur chaque page publique : HTTP 200 ; `text/html` ; **faits de la base présents dans le HTML** (comparaison de chaînes sur le texte décodé) ; **aucun script exécutable hors JSON-LD** ; **aucun noindex** (balise ou en-tête) ; `<link rel="canonical" href="<url exacte>">` littéral ; **mêmes octets pour 6 robots d'IA et un navigateur** (aucun cloaking) ; `robots.txt` et sitemaps déclarés. Conséquence pour le design : **aucun îlot JavaScript, aucune animation scriptée, aucun contenu variant** sur les pages du hub ; tout effet y est en CSS pur, sans masquer de texte.

### 4.3 Règle du hub : rien de caché
`packages/hub/test/hub.test.ts:93` et `profile-sections.test.ts:82` refusent `display:none`, `visibility:hidden`, `opacity:0` et `font-size:0` **dans tout le HTML produit, CSS comprise**. Un menu mobile replié par `display:none`, une entrée en fondu depuis `opacity:0` ou un texte visuellement masqué cassent ces tests. (`.sr-only` existe côté React seulement.)

### 4.4 Tests qui casseront si le markup change
| Test | Ce qu'il fige |
|---|---|
| `packages/hub/test/hub.test.ts:86,93,113,116,165,187` | nombre de `<script>`, CSS sans masquage, `<html lang>`, absence de `<h2>Missions</h2>` en EN, absence de `class="more"` |
| `packages/hub/test/job-page.test.ts:27-29` | **exactement 1 `<script>`** ; `<h1 class="title">` |
| `packages/hub/test/job-index.test.ts:27` | **aucun `<script`** sur l'index des missions |
| `packages/hub/test/nearby.test.ts:122` | exactement 1 `<script>` |
| `packages/hub/test/blog.test.ts:59,83` | `<h1 class="title">` ; `aria-current="page">Blog</a>` |
| `packages/hub/test/legal-pages.test.ts:15,28,50,75` | `<footer class="foot">` ; `<h1 class="title">` ; `<main>` ; pas de script dans le pied |
| `packages/hub/test/profile-page.test.ts:50,77` | `<h1 class="title">` ; absence de `<dd>Disponible` |
| `packages/hub/test/profile-directory.test.ts:75,156` | `<span class="avatar tone-N" aria-hidden="true">AB</span>` ; lien de menu `aria-current` exact |
| `packages/hub/test/company-directory.test.ts:50,79` | `<span class="avatar sq tone-N" ...>` ; lien de menu exact |
| `packages/hub/test/job-title-page.test.ts:47` | `<a href="/fr/postes" aria-current="page">Postes</a>` |
| `packages/hub/test/barometers.test.ts:42` | ligne de tableau `<th scope="row">...<td class="num">` |
| `packages/hub/test/simulator-page.test.ts:23` | `<form class="sim" method="get" action="/fr/simulateur">` |
| `packages/hub/test/markdown.test.ts:16,55-56` | titres d'article `<h2 id>`, pas de `<h1>` |
| `packages/hub/test/marketplace-verify.test.ts` | contrat de `marketplace-verify` |
| `apps/web/test/pwa.test.ts:15-16,37-40,57-70` | lit `tokens.css` par regex `--<nom>:\s*(#[0-9a-f]{6});` : **renommer `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--proof`, `--on-proof` ou passer en `oklch()` casse le test** ; manifeste et page hors ligne doivent recopier ces valeurs ; tailles des PNG d'icônes (192, 512, 96, 180) ; `<section lang="fr"><h1>Hors ligne</h1>` |
| `apps/web/test/legal-pages.test.ts:30-33,45,115-116` | canonical exact, SIREN, hébergeurs, sitemap |
| `apps/web/test/pseudonymous-copy.test.ts`, `visibility-dictionary.test.ts`, `apps/landing/test/landing.test.ts` | textes des dictionnaires (vocabulaire interdit, structure FR = EN, « fictives ») |
| `apps/web/test/e2e/audit-page.js:33` | le contrôle de contraste ne lit que `rgb()/rgba()` : des couleurs en `oklch()` ou `color()` risquent de ne plus être lues (comportement de `getComputedStyle` non vérifié) |

Gate de référence : 2 228 tests sur 249 fichiers au 2026-10-19 (`TEAM_MEMORY.md:684`).

---

## 5. Faits produit utilisables par le design, et interdits

### 5.1 Ce que Proofseen fait vraiment (source)
| Fait | Source |
|---|---|
| Marketplace de missions freelance tech, FR + EN ; profils jamais notés ni classés | `llms.txt` en prod (2026-10-21), `hub/src/llms-txt.ts` |
| **Missions prouvées** sur un profil : rôle, type de client, durée, résumé, **nature de la preuve** (facture, contrat, attestation du client, accès au dépôt de code, livrable public), date de vérification, confirmation par le client (inscrit ou contact chez lui, par lien signé sans compte) ou « payée sur Proofseen » | `hub/src/profile-page.ts:39-50,86-91`, `app/[lang]/confirmer-mission/[id]/page.tsx` |
| **Adresses dont la possession est prouvée** (sites, dépôts) | `profile-page.ts:78`, capture `before/desktop-03-profil.png` |
| **Faits vérifiés datés** : entreprise active au répertoire officiel (SIRET contrôlé, revérifié tous les 30 jours, jamais publié), identité vérifiée par le prestataire de paiement, payé par N entreprises différentes, attestation URSSAF vérifiée par un opérateur | `TEAM_MEMORY.md:649` (C8), `profile-page.ts:207-210` |
| **Disponibilité datée**, « non confirmée » au-delà de 30 jours | `TEAM_MEMORY.md:682` |
| **Avis de missions payées sur Proofseen**, affichés un par un (« N / 5 · date »), sans note agrégée | `profile-page.ts:215-219`, `TEAM_MEMORY.md:631` |
| **Mesure de visibilité IA** : questions de recruteurs posées par API à OpenAI, Anthropic et Perplexity, plusieurs tirages, fourchette de confiance ; plafonds de dépense ; 2 mesures par freelance et par 30 jours, profils publiés avec adresse prouvée | `TEAM_MEMORY.md:669,677` |
| **Mesure J0 du founder** : 780 réponses, 15,79 $, 0 % de citations [0 ; 1,9 %], Malt 39 %, LinkedIn 26,5 % ; données réelles déjà affichées dans le hero (`AnswerField`) | `TEAM_MEMORY.md:367`, `app/[lang]/page.tsx:21` |
| **Mesure de conquête du 2026-10-07** : 312 tirages, 0 erreur, 5,89 $ ; proofseen.com **0 citation sur 872** ; Malt 35,4 %, LinkedIn 28,8 % | `TEAM_MEMORY.md:647` |
| **Rapprochement expliqué**, déterministe, chaque proposition affiche sa raison ; aucun score d'IA sur une personne | `TEAM_MEMORY.md:679` |
| Paiement **sous séquestre** (Stripe), joué de bout en bout en **mode test** ; versement au freelance non joué ; aucun paiement réel avant « GO PAIEMENT LIVE » | `TEAM_MEMORY.md:689` |
| Facture électronique CII (EN 16931), relevés de régie, API entreprise, export comptable | `TEAM_MEMORY.md:654,658` |
| Application installable (PWA) côté freelance **et** entreprise, notifications poussées | `TEAM_MEMORY.md:674` |
| Baromètre TJM et compétences : médiane et quartiles, n affiché, publié seulement au-dessus d'un n minimal (groupes adossés à au moins 3 entreprises), données CSV/JSON en CC BY | `llms.txt`, `TEAM_MEMORY.md:671-672` |
| Simulateur de revenu net, chaque taux daté et lié à sa source officielle | `llms.txt` |
| Pages publiques à 100 en performance, accessibilité et SEO (profil, mission, métier, 2026-10-06) | `TEAM_MEMORY.md:633` |
| **La marketplace publique est vide** : aucun profil publié, aucune entreprise publique, aucune mission ouverte (2026-10-17 et 2026-10-18) | `TEAM_MEMORY.md:676,681` ; l'unique profil vu en capture (FR-RVVUA, 2026-10-21) n'a « aucune adresse prouvée » |
| Charte d'honnêteté publique en 8 points | `foundations/MARQUE.md` §8 |

### 5.2 Ce qui est interdit
- **Aucun chiffre inventé** : pas de compteur d'utilisateurs, de missions, de citations ou de « taux de réussite ». Les seuls chiffres de mesure publiables sont ceux de §5.1 avec leur date. Toute donnée d'illustration porte « exemple illustratif, données fictives » (`DESIGN_WEB.md` §1, `apps/landing/test/landing.test.ts:31-33`).
- **Aucun faux témoignage, aucun faux logo client, aucune photo présentée comme un utilisateur** (mandat `<images>`, `MARQUE.md` §5).
- **Aucun classement automatique de personnes** : ni score, ni note agrégée, ni « % compatible », ni « top freelances » ; un ordre explicite et expliqué est permis, un score opaque ou calculé par une IA ne l'est pas (`TEAM_MEMORY.md:679`, AI Act annexe III point 4).
- **Aucune promesse de résultat** (« garanti », « n°1 », « boostez »...), vocabulaire banni testé (`landing.test.ts:20-28`, `MARQUE.md` §4).
- **Aucun nom ni adresse sur un profil pseudonyme** (`TEAM_MEMORY.md:631`), aucune coordonnée dans le contenu public (filtre de coordonnées, `TEAM_MEMORY.md:638`).
- **Aucun prix public de la marketplace** avant les premières données réelles (`TEAM_MEMORY.md:657`).
- Iconographie interdite par la marque : robots, cerveaux lumineux, loupes clichés, cadenas « hacker », fusées, œil, radar, flèche montante (`MARQUE.md` §5).
- Marques tierces citées avec la mention de non-affiliation déjà présente dans les deux pieds de page.

---

## 6. Contradictions relevées (non tranchées)

1. **Vitrine Astro ou vitrine React ?** Le mandat dit « `apps/landing` : Astro. C'est la vitrine » et prévoit le lot b « vitrine Astro » et des SVG dans `apps/landing/public/brand/`. Le code dit : landing non déployée depuis au moins le 2026-10-20 (§1.10), vitrine servie par `apps/web/src/app/[lang]/page.tsx`. Lots b et c portent donc aujourd'hui sur **la même page**. À arbitrer par le Shogun.
2. **Accueil dans le sitemap mais en noindex.** `sitemap-pages.xml` liste `/fr` et `/en` ; la prod les sert en `noindex, nofollow` (`layout.tsx:38`, mesuré 2026-10-21). Le mandat dit de garder le SEO « intact ou amélioré ». Corriger est-il dans le périmètre de la refonte ? À arbitrer.
3. **Thème clair.** `MARQUE.md` §6 définit un thème clair « papier » et un sombre ; `DESIGN_WEB.md` §5 (founder, 2026-09-19) a supprimé le clair ; le mandat exige des contrastes « en clair et en sombre » et « un `theme-color` par thème ». Le mandat du 2026-10-20 est postérieur.
4. **Logo.** Brief de `MARQUE.md` §5 : wordmark Newsreader + intervalle de confiance, « à éviter : œil, loupe ». Mandat : nouveau monogramme sur une métaphore de sceau, empreinte, tampon, signature ou horodatage. Le mandat est postérieur et donne l'autonomie ; l'intervalle de confiance est déjà le motif de `.kicker`, des `h2` du hub et des icônes PWA.
5. **Polices du hub.** Le hub est en polices système par choix de performance (`html.ts:11-13`, Lighthouse 100 mesuré avec elles). Unifier sur deux familles servies localement ajoute des requêtes aux pages publiques. Arbitrage performance contre cohérence.
6. **Offres à 49 € et 490 € sur la vitrine** (`i18n/fr.ts:148,155`, `components/landing/Offers.tsx`, rendues par `page.tsx:31`) alors que la décision du 2026-10-07 dit « aucun prix public avant les premières données réelles » (`TEAM_MEMORY.md:657`, portée : tarification B2B de la marketplace). Ces offres sont-elles encore vendues ? Non vérifié.
7. **« Un fil qui relie un claim à son commit »** (exemple du mandat) : le code ne connaît pas de preuve au niveau du commit ; la nature la plus proche est « accès au dépôt de code » (`profile-page.ts:90`). **« Un tableau qui s'allume quand un assistant IA cite le profil »** : la seule mesure de proofseen.com donne 0 citation sur 872 (`TEAM_MEMORY.md:647`) et la marketplace est vide ; tout moment signature de ce type devra s'appuyer sur des données étiquetées comme exemples.
8. **Phrase-mission.** Le mandat résume Proofseen comme « la preuve vérifiable de ce qu'un freelance a vraiment livré, et la mesure de sa visibilité dans les assistants IA » ; `llms.txt` en prod le décrit comme « a French marketplace for tech freelance missions ». Les deux sont compatibles avec le code, mais le récit de la vitrine (mesure de visibilité d'abord, `Hero`) et celui de `llms.txt` (marketplace d'abord) ne racontent pas la même chose.
9. **Captures existantes.** `before/desktop-06-barometre.png` est la 404 par défaut (même fichier que `desktop-09-404.png`) : l'adresse `/fr/barometre` n'existe pas ; la capture du baromètre est à refaire sur `/fr/barometre/tjm`.

---

## 7. Ce qui n'a pas été vérifié
- Aucun Lighthouse ni capture lancé par Kage (les captures de `before/` existaient déjà, horodatées 2026-10-21 04:18).
- Les écrans connectés n'ont pas été ouverts (aucune session) ; leur inventaire vient du code.
- Le contenu des 16 lignes à tiret cadratin d'`apps/landing` et les 5 `:hover` non protégés d'`apps/web` n'ont pas été relus un par un.
- Le comportement de `getComputedStyle` avec `oklch()` dans `audit-page.js`.
- Le favicon `apps/landing/public/favicon.svg` n'a pas été ouvert.

---

## Captures

Production, 2026-10-21, Playwright (1440x900 et 375x812), pleine page : `.war-room/design/before/`.

| Écran | Desktop | Mobile | Constat du Shogun |
|---|---|---|---|
| Accueil `/fr` | desktop-01-accueil.png | mobile-01-accueil.png | De longues zones vides : la section « Cinq étapes » et la suite n'apparaissent qu'au défilement (contenu à opacité nulle avant l'animation). Pour un robot, une capture ou un lecteur pressé, la page paraît cassée. Le graphique des 780 points est le seul visuel fort. |
| Annuaire `/fr/freelances` | desktop-02 | mobile-02 | Un seul profil, aucune image, rien qui dise « preuve ». |
| Profil `/fr/profils/fr-rvvua` | desktop-03 | mobile-03 | Lisible mais générique : bandeau de quatre cases, puces de compétences, « Aucune adresse prouvée ». La preuve, cœur du produit, n'a aucune forme visuelle. Nom affiché « Freelance FR-RVVUA » à côté de la photo : profil publié sous le nom mais sans nom renseigné. Pas une fuite : la photo n'est servie que pour `visibility = named` (`packages/hub/src/profile-page.ts:212`). |
| Missions `/fr/missions` | desktop-04 | | Liste vide. |
| Entreprises `/fr/entreprises` | desktop-05 | | Liste vide. |
| Baromètre | desktop-06 (montre la 404) | | `/fr/barometre` répond 404 : l'adresse publique du baromètre est ailleurs. |
| Blog `/fr/blog` | desktop-07 | | Trois guides, cartes texte sans image. |
| Simulateur `/fr/simulateur` | desktop-08 | | Formulaire nu. |
| 404 | desktop-09 | | 404 par défaut de Next, blanche, en anglais. |

## Pack 21st.dev

Inventaire du 2026-10-21 avec le compte relié : `list_bookmark_lists` ne rend aucune liste et `list_bookmarks` aucun favori. Le pack du founder est vide sur ce compte. La refonte s'appuie donc sur `search` et `get_inspiration` ; chaque composant retenu passe par `get_component` pour la licence, est réécrit à la charte et crédité dans `apps/web/NOTICE.md`.

## Arbitrages du Shogun (2026-10-21)

1. **La vitrine est `apps/web/src/app/[lang]/page.tsx`**, pas `apps/landing` : l'Astro n'est ni construite ni servie (Dockerfile, Caddy, TEAM_MEMORY:685). Le lot b refond la vraie page d'accueil. `apps/landing` reste en l'état et reçoit seulement les fichiers de marque, pour ne pas diverger.
2. **L'accueil devient indexable.** `apps/web/src/app/[lang]/layout.tsx:38` met `noindex, nofollow` sur tout le segment `[lang]`, accueil compris, alors que `/fr` et `/en` sont dans le sitemap : héritage de l'époque démo. Les pages publiques de ce segment passent en `index, follow`, l'espace connecté reste `noindex`. C'est une amélioration SEO, conforme au mandat.
3. **Thème : sombre par défaut, clair défini.** Le mandat exige des contrastes AA mesurés en clair et en sombre. Les deux jeux de tokens existent, le sombre est la marque, le clair suit `prefers-color-scheme: light`. Le thème clair supprimé le 2026-09-19 était un autre système ; celui-ci est neuf.
4. **Aucun prix public.** Les offres à 49 € et 490 € affichées contredisent la décision du 2026-10-07 (pas de prix publics sans données réelles) : elles disparaissent de l'accueil refondu.
5. **Une seule marque pour React et le hub.** Mêmes tokens, mêmes rayons, même bouton. Le hub garde une pile système pour le corps de texte (performance des pages publiques) et charge une seule police d'affichage en sous-ensemble latin, préchargée, en `font-display: swap` avec métriques ajustées pour un CLS nul.
6. **Rien n'est caché en attendant une animation.** Tout contenu est visible par défaut ; une révélation au défilement part d'un état visible, jamais d'une `opacity: 0` initiale dans le HTML. Cela respecte aussi le contrôle du hub (ni `display:none` ni `opacity:0`).
7. **Le graphique des 780 réponses perd ses 214 Ko** : données compactées ou rendues côté serveur en SVG statique.
8. **Aucun déploiement** sans GO DEPLOY du founder : les lots sont fusionnés sur `main`, la production ne bouge pas.
