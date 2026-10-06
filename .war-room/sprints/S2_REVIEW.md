# SPRINT 2 (volet WAR ROOM, avancé) — Revue et vérification (2026-09-18)

## 1. Livré

| id | Livrable | Où |
|---|---|---|
| W12 | Générateur de hub statique : profil JSON validé par zod → HTML FR/EN **sans JavaScript**, pages missions, robots.txt ouvert aux 6 bots, sitemap, hreflang, canonical, disponibilité datée, JSON-LD en hygiène, jeton US-F00 optionnel ; commande `pnpm hub:build` | `packages/hub/`, `apps/cli` |
| W13 | Contenu du hub d'Ayoub (FR/EN, 4 missions, chaque chiffre sourcé) | `experiment0/hub/ayoub.profile.json` |
| W14 | Textes de surface : LinkedIn, README GitHub, Malt, plan d'article dev.to, ligne d'identité et cohérence, **29 points à confirmer** | `experiment0/surface/` |
| W15 | Juge LLM des appariements « probables » : sans outils, JSON strict, extrait **masqué**, option `--judge` (désactivée par défaut) | `packages/extract/src/judge.ts` |
| W16 | Projets juridiques : CGV de pré-vente, politique de confidentialité, notice « personnes citées par les IA », mentions légales, clauses CGU | `presale/legal/` (PROJETS à valider par un juriste) |

## 2. Revue W17 (security-reviewer, lecture seule)

| Gravité | Constat | Correction |
|---|---|---|
| CRITIQUE / HAUTE | Aucun | — |
| MOYENNE | Le juge recevait l'extrait **brut** (avec des noms de tiers) | Il reçoit l'extrait **masqué** ; un test vérifie qu'aucun nom tiers n'est envoyé |
| MOYENNE | `sitemap.xml` non échappé | `<loc>` échappé |
| BASSE | L'injection dans l'extrait du juge n'est atténuée que par une heuristique | Acceptée : le juge ne peut jamais transformer un « probable » en « certain » (fail-safe vérifié) |

Vérifié sans anomalie : échappement HTML partout, y compris dans les attributs ; URL `javascript:` impossibles (https imposé par le schéma) ; JSON-LD non cassable ; pas de traversée de chemin ; texte caché impossible par construction ; dates déterministes (UTC).

## 3. Harmonisations documentaires

- Seuil d'agrégation B2B harmonisé à **k ≥ 10** dans CAHIER_DES_CHARGES et CONFORMITE (le juriste avait relevé l'écart 5 / 10).
- CONFORMITE T3 : la **table jeton ↔ nom n'est jamais conservée** (elle n'existe qu'en mémoire).
- CAHIER §2 : Perplexity = **Agent API** (et non plus « Sonar chat »).

## 4. Ce que le truth lock a attrapé (à trancher par le founder, `surface/A_CONFIRMER.md`)

- **P5** : le CV dit que les évaluations Phantera « bloquent la CI ». En réalité, seule la red-team Garak tourne chaque semaine en CI ; les évaluations exigent `RUN_LLM_EVALS=1`. Les nouveaux textes sont corrigés ; **le CV est à corriger**.
- **C1** : Spar-X figure dans les notes comme l'un des **sites d'Ayoub**. S'il ne s'agit pas d'un client externe, la présenter comme « mission client » serait trompeur. **À trancher avant publication.**
- **G2** : ne pas épingler `PhanteraTN` sur GitHub en l'état. C'est le remote vers lequel pointe le dépôt git de tout le Bureau (fichiers sans rapport, potentiellement sensibles).
- Pourcentages non prouvés du CV (CFP Hub, SweetcHome, Elyadata) : exclus, points L1-L4.
- « Senior » n'est pas employé : « freelance depuis 2022 » en attendant la décision D1.

## 5. Vérification finale — sorties réelles

```
typecheck exit=0
lint exit=0
Test Files  11 passed (11)      Tests  130 passed (130)
 packages/hub/src  |  100 | 94.11 |  100 |  100
 ...es/extract/src | 98.95 | 94.91 |  100 | 99.18
 ...ages/stats/src | 98.19 | 86.11 |  100 |  100
coverage exit=0   (seuils 80 % : stats, extract, hub)
dist\main.js 87.86 KB — Build success — build exit=0
node dist/main.js hub … → Hub written to hub-dist: 12 files (10 pages, no JavaScript).
Contrôles sur hub-dist : 2 balises <script>, toutes de type application/ld+json ; aucun motif de texte caché ;
index.html ≈ 8,3 Ko ; robots.txt ouvert aux 6 bots.
```

Lighthouse ≥ 95 desktop ET mobile : **à mesurer par le founder** une fois le site en ligne. Aucun score n'est annoncé sans mesure.

## 6. Vérification du hub **déployé** : `pnpm hub:verify` (2026-09-20)

La définition de fin de S2 demande une preuve que « le HTML servi, sans exécution de JavaScript, contient le texte visible ».
C'est désormais une commande, pas une inspection à la main :

```bash
pnpm hub:verify --profile .war-room/experiment0/hub/ayoub.profile.json
```

Elle récupère les 12 URL du site **tel qu'il est en ligne** (comme un robot : HTML brut, aucun script exécuté) et vérifie :
pages servies en 200 · type `text/html` · **tout le texte attendu présent** (nom, titre, résumé, compétences, titres et résumés de
mission, **valeurs et sources des faits**) · **aucun script** hors JSON-LD · `canonical` et `hreflang` alignés sur `baseUrl` ·
`robots.txt` autorisant les 6 robots d'IA et déclarant le sitemap · sitemap listant **toutes** les pages · fichier de preuve de
possession conforme quand un jeton est déclaré. Sortie 1 si un contrôle échoue.

**Défaut trouvé en l'exécutant pour de vrai (et corrigé) :** sur un domaine non déployé, quatre contrôles affichaient `[ ok ]`
parce qu'ils ne portaient sur **aucune** page. « Rien à signaler » n'est pas « tout va bien » : ces contrôles échouent maintenant
avec « not checked: no page was reachable », et un test verrouille la règle (aucun `ok` possible quand le site ne répond pas).

**État au 2026-09-20 :** `https://ayoub-hammoudi.dev` ne répond pas (DNS, TLS ou délai dépassé) — le hub n'est pas encore en ligne,
ce qui est conforme au plan (publication en S2, après la mesure de base). La commande est prête pour le jour de la mise en ligne.
