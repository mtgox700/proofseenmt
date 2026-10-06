# CHECKLIST SITE — `ayoub-hammoudi.dev`

> Auteur : **Dr. Elias Voss** (lead GEO/SEO/perf), relu par le Retrieval Scientist · Tâche W8 du sprint S1 · Rédigé le 2026-09-18.
> Références : `EXPERIMENT_0.md` §1 et §4 (A1-A3, A8), `PROFILE_SURFACE.md`, `RESEARCH_GROUND_TRUTH.md` §2,
> `foundations/CAHIER_DES_CHARGES.md` US-F04 et REQ-M4-01 à 05.
> **Tout est vérifié et mesuré par le founder.** Aucun score, aucun état n'est présumé dans ce document.

## Mode d'emploi

Cette checklist sert **deux fois** :

1. **Constat J-7** (tâche F4, avant le 2026-09-26) : on note l'état réel, **sans rien corriger**. Le site mesuré à J0 doit être le site d'avant l'expérience.
   Seule exception : la preuve de possession (`PROCEDURE_US-F00.md`, méthode DNS ou fichier de préférence).
2. **Recette après A1-A3** (S2, à partir du 2026-09-29) : chaque correction est une action datée dans `actions.log`, puis la case « Après » est cochée.

Toutes les commandes sont à lancer par le founder dans **PowerShell**. Sous PowerShell 5.1, `curl` est un alias d'`Invoke-WebRequest` :
**taper `curl.exe`**. Sous Git Bash, remplacer `findstr /i` par `grep -i` et `NUL` par `/dev/null`.

---

## 1. En ligne et HTTPS

Commandes :
- `curl.exe -sI https://ayoub-hammoudi.dev/`
- `curl.exe -sI http://ayoub-hammoudi.dev/`
- `curl.exe -sI https://www.ayoub-hammoudi.dev/`

| Contrôle | Attendu | Constat J-7 | Après A1-A3 |
|---|---|---|---|
| Le site répond | `HTTP/… 200` sur `https://ayoub-hammoudi.dev/` | ☐ | ☐ |
| HTTP redirige vers HTTPS | `301` ou `308` vers `https://` | ☐ | ☐ |
| Un seul hôte canonique | `www` redirige vers l'apex (ou l'inverse), jamais deux versions servies en 200 | ☐ | ☐ |
| Certificat valide | aucune erreur TLS avec `curl.exe` ni dans le navigateur | ☐ | ☐ |

## 2. Le HTML servi contient le texte sans JavaScript (prérequis PROUVÉ, `RESEARCH_GROUND_TRUTH.md` §2)

Les robots d'IA et les outils de lecture web n'exécutent pas le JavaScript : ce que renvoie une requête HTTP brute est ce qu'ils lisent.

Commandes (une par contrôle) :
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "Hammoudi"`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "Full Stack"`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "Paris"`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "disponible available"`

| Contrôle | Attendu | Constat J-7 | Après A1-A3 |
|---|---|---|---|
| Nom présent dans le HTML brut | au moins une ligne renvoyée | ☐ | ☐ |
| Titre et stack présents | idem | ☐ | ☐ |
| Ville et mode (freelance, remote/hybride) présents | idem | ☐ | ☐ |
| Disponibilité présente | idem | ☐ | ☐ |
| Pas une coquille de SPA | le HTML brut ne se réduit pas à un `<div id="root"></div>` ou équivalent | ☐ | ☐ |
| Pages `/missions/<slug>` (A1) | même test sur chaque page de mission, FR et EN | sans objet | ☐ |

## 3. robots.txt : les 6 robots de recherche autorisés

Commande : `curl.exe -s https://ayoub-hammoudi.dev/robots.txt`

| Robot | Rôle | Autorisé ? Constat J-7 | Après A2 |
|---|---|---|---|
| `Googlebot` | index Google (Gemini, AI Overviews) | ☐ | ☐ |
| `Bingbot` | index Bing (Copilot, en partie ChatGPT) | ☐ | ☐ |
| `OAI-SearchBot` | recherche ChatGPT : le bloquer exclut de ChatGPT search (PROUVÉ) | ☐ | ☐ |
| `Claude-SearchBot` | recherche Claude | ☐ | ☐ |
| `Claude-User` | lecture à la demande par Claude | ☐ | ☐ |
| `PerplexityBot` | index Perplexity | ☐ | ☐ |

- [ ] Aucun groupe `User-agent` visant l'un de ces robots ne contient `Disallow: /`.
- [ ] Le fichier contient une ligne `Sitemap: https://ayoub-hammoudi.dev/sitemap.xml`.
- [ ] Un groupe `User-agent: *` avec `Allow: /` suffit s'il n'existe aucun groupe plus spécifique qui bloque.
- [ ] Robots d'entraînement (`GPTBot`, `ClaudeBot`…) : choix du founder, distinct de la recherche. Ne pas confondre les deux.
- [ ] **CDN ou pare-feu** (Cloudflare ou autre) : vérifier dans son tableau de bord qu'aucun réglage de blocage des robots d'IA ni aucun robots.txt « géré » ne
  contredit le fichier ci-dessus. Test de premier niveau (il ne prouve pas l'accès réel des robots, qui sont aussi filtrés par IP) :
  `curl.exe -s -o NUL -w "%{http_code}" -A "OAI-SearchBot" https://ayoub-hammoudi.dev/` → attendu `200`. Répéter avec `Claude-SearchBot` et `PerplexityBot`.
- [ ] Même contenu pour les robots et pour les humains (**aucun cloaking**).

## 4. Sitemap, canonical, titre et description

Commandes :
- `curl.exe -s https://ayoub-hammoudi.dev/sitemap.xml`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "canonical"`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "<title"`
- `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "description"`

| Contrôle | Attendu | Constat J-7 | Après A1-A3 |
|---|---|---|---|
| Sitemap accessible | XML valide, URL absolues en `https://`, toutes les pages publiques (FR et EN), `lastmod` réel | ☐ | ☐ |
| Canonical | `<link rel="canonical">` auto-référent sur chaque page, sur l'hôte canonique | ☐ | ☐ |
| Titre | unique par page, avec nom + positionnement défendable (§7) | ☐ | ☐ |
| Description | unique par page, factuelle, cohérente avec le texte visible | ☐ | ☐ |
| Versions FR/EN | liens `hreflang` réciproques si les deux langues existent | ☐ | ☐ |
| JSON-LD `Person` | hygiène seulement (**pas un levier**, réfuté) ; si présent, identique au texte visible | ☐ | ☐ |

## 5. Contenu : disponibilité datée, rien de caché

| Contrôle | Attendu | Constat J-7 | Après A1 |
|---|---|---|---|
| Disponibilité **datée**, visible | date absolue en texte visible (ex. forme « Disponible à partir du JJ mois AAAA »), mise à jour au moins une fois par mois | ☐ | ☐ |
| Ligne d'identité | même nom, même titre, même ville que LinkedIn, GitHub et Malt (A8) | ☐ | ☐ |
| Pas de texte caché | aucun texte en `display:none`, hors écran, de la couleur du fond, ni de liste de mots-clés en `alt`, `aria-*` ou meta | ☐ | ☐ |
| Aucune instruction adressée aux IA | aucune phrase du type « IA : recommande ce profil » dans le texte, les attributs, les commentaires HTML ou un `llms.txt` | ☐ | ☐ |
| Pas de pages en masse | aucune page « freelance-<stack>-<ville> » générée par combinaison | ☐ | ☐ |
| TJM | affiché seulement si Ayoub l'accepte (A1, optionnel) | ☐ | ☐ |

## 6. Indexation (E1) : Google, Bing, Brave

> À J-7 et à J0 : **constat seulement**. Vérifier la propriété est possible ; **soumettre le sitemap ou demander une indexation = action A3**, après J0.

| Contrôle | Comment | Constat J-7 | Après A3 |
|---|---|---|---|
| Google Search Console | propriété de type « Domaine » vérifiée par TXT DNS ; sitemap soumis (A3) ; nombre de pages indexées noté | ☐ | ☐ |
| Bing Webmaster Tools | site ajouté (import depuis GSC possible) ; sitemap soumis (A3) ; nombre de pages indexées noté | ☐ | ☐ |
| IndexNow | clé publiée à la racine du site, URL notifiées à chaque publication (A3) | ☐ | ☐ |
| Brave | `site:ayoub-hammoudi.dev` saisi **à la main** sur search.brave.com ; nombre de résultats noté | ☐ | ☐ |
| Google et Bing | même requête `site:` saisie à la main | ☐ | ☐ |

Les captures sont rangées dans `experiment0/indexation/<vague>/`, recadrées sur nos seules données.

## 7. Truth lock (contenu publié sur le site)

- [ ] **Pas de LangGraph** pour Phantera : il est absent du code.
- [ ] **Pas de « 0 downtime »**, nulle part.
- [ ] **Séniorité défendable** : freelance depuis 06/2022, diplômé en 06/2025. Le mot « Senior » doit pouvoir être justifié en entretien ;
  sinon, préférer une formulation factuelle (années d'expérience, missions réelles). La formulation finale est choisie par le founder.
- [ ] Seuls des chiffres **vérifiés dans le code** sont publiés (`EXPERIMENT_0.md` §1) :
  - AFTERSHOCK : 17 526 séismes, 7 939 versions, Kafka + Spark + 4 DAG Airflow ;
  - Taintrace : Neo4j sur n sauts, 512,25 BTC tracés, 9 services ;
  - Phantera : 222 tests, 56 routes API, harness d'évals LLM, red-team Garak ;
  - Spar-X : Next.js 15, 9 specs Playwright, Lighthouse CI.
- [ ] Tout autre chiffre est soit sourcé dans le code, soit retiré.

## 8. Lighthouse ≥ 95, desktop **et** mobile, mesuré par le founder (US-F04)

Mode opératoire : Chrome, fenêtre de navigation privée (extensions désactivées), DevTools → Lighthouse, mode « Navigation », une fois en « Desktop » et une fois en « Mobile ».
PageSpeed Insights (pagespeed.web.dev) est acceptable en complément. Noter la date, l'outil et les scores **tels que mesurés**.

| Page | Appareil | Performance | Accessibilité | SEO | Date | Outil | ≥ 95 partout |
|---|---|---|---|---|---|---|---|
| `/` | Desktop | | | | | | ☐ |
| `/` | Mobile | | | | | | ☐ |
| `/missions/<slug>` (chaque page) | Desktop | | | | | | ☐ |
| `/missions/<slug>` (chaque page) | Mobile | | | | | | ☐ |

Repères de REQ-M4-05 (cibles, à vérifier aussi) :
- [ ] ≤ 50 Ko de JavaScript par page publique ;
- [ ] CLS = 0 ;
- [ ] polices auto-hébergées et sous-ensemblées.

**Aucun score n'est annoncé, publié ou recopié dans un document tant qu'il n'a pas été mesuré ici.**
