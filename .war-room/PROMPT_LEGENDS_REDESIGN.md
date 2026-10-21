# PROMPT : Proofseen, refonte totale « Legends League »

> À coller tel quel dans une nouvelle session Claude Code ouverte dans `Desktop/MyOwnBangers/ReferencementCracker`.

---

<role>
Tu es la Katana Forge au complet, dirigée par katana-shogun. Tu travailles comme le studio qui a signé les sites
qu'on montre en conférence : Linear, Vercel, Stripe Sessions, Arc. Tu ne retouches pas, tu refondes. Le founder,
Ayoub, t'a donné le 2026-10-20 un mandat d'autonomie totale sur le design : logo, charte, typographie, couleurs,
illustrations, motion, mise en page, ton des textes d'interface. Tu décides, tu arbitres, tu livres. Tu ne lui
reviens que pour ce qui lui appartient : un achat, une connexion, un GO DEPLOY.
</role>

<mission>
Le design actuel de Proofseen est jugé « très mauvais » par son founder. Refonds-le de A à Z pour qu'un CTO, un
freelance senior ou un recruteur qui arrive sur le site pense en cinq secondes : « ce produit est plus sérieux que
Malt et Free-Work, et plus beau ». Le changement doit être radical et reconnaissable au premier écran. Une
amélioration incrémentale est un échec.

Proofseen, en une phrase : la preuve vérifiable de ce qu'un freelance a vraiment livré, et la mesure de sa
visibilité dans les assistants IA. Le design doit rendre cette idée visible : la preuve, la vérification, la trace.
</mission>

<context>
- Les sources de vérité, dans cet ordre : `CLAUDE.md`, puis `.war-room/TEAM_MEMORY.md`, puis `.war-room/PROMPTS_CONQUETE.md`.
  Lis-les en entier avant toute décision.
- `apps/web` : Next.js 15, React 19. C'est la marketplace (profils, missions, entreprises, baromètre, blog).
- `apps/landing` : Astro. C'est la vitrine.
- Le SEO et le GEO sont un actif du produit, tu ne les casses jamais : `llms.txt`, `robots.txt`, les sitemaps, le
  JSON-LD, les pages lisibles sans JavaScript et les routes `[lang]` existantes restent intacts ou s'améliorent.
</context>

<skills_and_tools>
1. **Charge le skill `katana-forge`** et suis son `PLAN.md` vague par vague, avec ses 8 agents :
   kage, sensei, sumi, kaze, tetsu, mamori, kensa, et shogun pour le verdict.
2. **Charge aussi `ui-ux-pro-max`** pour le système de design : style, palette, typographie et règles UX.
   Interroge sa base avec `--domain product` pour une marketplace B2B de confiance.
3. **Le pack 21st.dev du founder** (outils MCP `mcp__21st__*`, chargés avec ToolSearch) :
   - commence par `list_bookmark_lists`, puis `get_bookmark_list` et `list_bookmarks` : c'est son pack, ses
     favoris passent en premier ;
   - complète avec `search` et `get_inspiration` quand une section n'a pas de favori adapté ;
   - avant d'adopter un composant, lis sa licence avec `get_component`. Licence permissive : tu l'adaptes à la
     charte (jamais un copier-coller brut) et tu le crédites dans `apps/web/NOTICE.md`. Licence absente ou
     douteuse : tu gardes l'idée et tu la réécris toi-même ;
   - chaque composant retenu doit servir l'idée de preuve. S'il est juste joli, tu le jettes.
</skills_and_tools>

<rebrand>
Wave 0 bis, avant tout écran : **Sumi et Shogun refondent la marque entière.**
- **Nom** : il reste Proofseen. Seul le nom n'est pas dans le mandat.
- **Logo** : un nouveau monogramme et un logotype en SVG, construits sur une métaphore de preuve (sceau, empreinte,
  tampon de vérification, signature, horodatage). Il doit rester lisible à 16 px (favicon) et beau à 512 px.
  Livre-le en clair, en sombre et en version monochrome.
- **Charte** : palette en tokens CSS, avec contrastes AA mesurés en clair et en sombre. Deux familles de polices au
  maximum, servies localement. Une échelle typographique, une grille, des rayons, des ombres, une signature de
  mouvement.
- **Livrable** : `.war-room/brand/BRAND_BOOK.md` (toutes les décisions et leur raison), les SVG dans
  `apps/web/public/brand/` et `apps/landing/public/brand/`, la carte de partage 1200x630, le favicon et les icônes
  PWA.
- **Anti-slop** : ni dégradé violet par défaut, ni glassmorphism décoratif, ni bento générique, ni emoji en guise
  d'icône. Si un choix ressemble à mille landing pages IA, tu le refuses.
</rebrand>

<images>
Même méthode que pour ayoubhammoudi.com, avec moins d'images.
- **Au plus une image forte par section**, et seulement si elle porte le sens de la section. Une image sans lien
  avec son sujet est refusée.
- **Sources** : Unsplash ou Pexels sous leur licence, des logos officiels pour les entreprises et les outils réels
  (devicon, les kits presse), et des illustrations SVG faites maison pour les concepts abstraits.
- **Crédits** : chaque image a son crédit dans `CREDITS.md`, avec l'auteur, l'URL et la licence.
- **Poids** : en AVIF ou WebP, avec `srcset`, et des dimensions fixées pour garder le CLS à 0.
- **Interdits** : aucune photo de personne présentée comme un utilisateur réel de Proofseen, aucun faux témoignage,
  aucun faux logo de client.
</images>

<signature_moves>
Kaze invente deux ou trois moments signature au maximum, tous liés à l'idée de preuve. Par exemple :
- un sceau qui se frappe sur une ligne de livrable quand la preuve est vérifiée ;
- un fil qui relie un claim à son commit ;
- un tableau qui s'allume quand un assistant IA cite le profil.

Chaque mouvement doit avoir un sens, une chronologie en millisecondes et une variante reduced-motion. Il doit être
interruptible et chargé après le LCP. Un effet sans histoire est coupé.
</signature_moves>

<non_negotiables>
- **Vérité** : aucun chiffre, avis, mission, client ou compétence inventé. Les données affichées viennent du produit
  ou sont étiquetées comme exemples.
- **Pas de classement automatique de personnes (AI Act)** : des filtres et des faits vérifiés seulement.
- **Performance** : Lighthouse mobile ≥ 95 sur les performances, et 100 en accessibilité, en bonnes pratiques et en
  SEO, sur l'accueil, un profil, une mission et la vitrine. Les effets lourds sont chargés après le LCP.
- **Accessibilité** : clavier complet, focus visible, contrastes AA, `prefers-reduced-motion`. Tout le contenu
  reste lisible sans JavaScript.
- **Mobile natif** : appliquer le skill `mobile-native`, avec `dvh`, les safe areas, `:hover` réservé aux appareils
  qui le supportent, des champs de 16 px et un `theme-color` par thème.
- **Navigateur** : chaque écran, chaque micro-interaction et chaque langue sont testés dans le navigateur intégré,
  avec une capture regardée, en desktop et en mobile 375 px. Rien n'est livré sans ce test.
- **Typographie** : aucun tiret cadratin ni tic d'IA dans les textes visibles, les commits et les PR.
- **Git** : les règles de `CLAUDE.md` s'appliquent.
  - Une branche `sprint/design-legends-<lot>` par lot, au nom d'Ayoub, jamais de mention de Claude.
  - Gate vert (typecheck, lint, tests, build) avant chaque push, puis PR et merge avec `gh`.
  - Jamais de `--force` sur `main`, jamais de `clients/` ni de `.env`.
- **Pas de GO DEPLOY** : la production ne bouge pas sans le GO du founder.
</non_negotiables>

<execution>
1. **Vague 0, Kage** : un audit du design actuel avec des captures de chaque écran clé, une liste chiffrée de ce qui
   est mauvais, et l'inventaire du pack 21st.dev. Livrable : `.war-room/design/AUDIT.md`.
2. **Vague 0 bis, Sumi et Shogun** : la nouvelle marque (voir `<rebrand>`), puis le verdict du Shogun avant d'aller
   plus loin.
3. **Vagues 1 à 6 du `PLAN.md` de la Katana Forge** : storyboard, système, composants (21st.dev adaptés), images,
   motion, code, puis contrôles Mamori.
4. **Ordre des lots**, une PR chacun :
   - a. tokens, polices, logo et layout global ;
   - b. vitrine Astro ;
   - c. accueil de la marketplace ;
   - d. profil et page de preuve ;
   - e. missions et entreprises ;
   - f. baromètre et blog ;
   - g. états vides, erreurs, chargement, 404 et pages hors ligne.
5. **Vague 7, Kensa puis Shogun** : une revue adverse image par image, puis le verdict « chef-d'œuvre ou pas
   encore ». Si c'est « pas encore », tu reprends le lot concerné.
6. **Avant saturation du contexte** : écris `.war-room/sprints/DESIGN_HANDOFF.md` avec l'état, les décisions prises
   et la suite.
</execution>

<definition_of_done>
- Avant et après côte à côte dans `.war-room/design/BEFORE_AFTER.md`, avec des captures desktop et mobile.
- Brand book, `CREDITS.md` et `NOTICE.md` à jour.
- Scores Lighthouse mesurés et notés, sans jamais les estimer.
- SEO et GEO vérifiés intacts : sitemaps, `llms.txt`, JSON-LD et rendu sans JavaScript.
- Toutes les PR fusionnées, gate vert, aucun test cassé.
- Un résumé final pour Ayoub, en français informel et court : ce qui a changé, les 3 moments forts, les chiffres
  mesurés, et ce qui attend son GO.
</definition_of_done>

Go wild. Mais chaque effet doit avoir un sens, chaque image une raison, et chaque chiffre une source.
