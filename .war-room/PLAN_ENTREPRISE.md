# PLAN D'ENTREPRISE — Victoria Chen (Phase 6, 2026-09-18)

> ⚠ **CORRECTION du 2026-09-18 — décision du founder : modèle « passerelle » A + D** (`foundations/MODELE_PASSERELLE.md`).
> La trajectoire ci-dessous (abonnements + licences) est à **refaire** autour de la commission sur le TJM : 500 K€/mois à 10 % ⇒ ≈ 5 M€ de missions
> par mois ⇒ ≈ 480 freelances en mission simultanément (HYPOTHÈSES). Refonte prévue après le test P0 de l'étage 2 (3 entreprises + 1 portage).

> Standard : *« Does this move the revenue needle today? »* **Toutes les lignes chiffrées sont des HYPOTHÈSES**,
> sauf mention d'une source (cf. `RESEARCH_GROUND_TRUTH.md`). Rien ne démarre avant les garde-fous G1 (demande) et G2 (garde-fous des LLM).

## 1. Segments (séquencés)

| Ordre | Segment | Douleur | Taille (source) | Démarrage |
|---|---|---|---|---|
| 1 | Freelance tech confirmé FR (TJM 450-600 €) | « Je ne sais pas si l'IA me recommande » | ~120 000 freelances IT (secondaire) | M2 |
| 2 | **Sociétés de portage** | Attirer et retenir des consultants | 518 sociétés, 43 127 portés (PEPS, 2022) | **M4** |
| 3 | ESN / cabinets | Intercontrat, visibilité du vivier (HYPOTHÈSE) | ~2 500 adhérents Numeum | M6 |
| 4 | Freelances anglophones (UK/US) | Idem segment 1 | ~30 M de freelances qualifiés aux US (Upwork 2023) | M9-M12 |
| 5 | Plateformes (API) / Talent MCP | — | — | M12+, en option |

## 2. Offres et prix (HYPOTHÈSES)

| Offre | Prix | Contenu | Ancrage |
|---|---|---|---|
| **Gratuit** | 0 € | Vérificateur bots/SSR + audit sur 1 JD (24 appels, coût < 1,10 $) | Aimant à leads |
| **Audit Pro** (unique) | 49 € | 3 JD, audit complet, carte des sources, plan de correction | Coût API ~10-36 $ ; répond au churn du B2C |
| **Pro** (mensuel) | 29 €/mois ou 290 €/an | Monitoring mensuel, alertes, fraîcheur, panel du cluster | Jobscan 49,95 $, Premium Career 29,99 € |
| **Clé en main** (service) | 490 € | On applique A1-A8 pour toi. **Phases 1-2 seulement, 10 par mois maximum** | Cash + apprentissage |
| **Portage « Vivier »** | 490 €/mois (≤ 25 consultants) · 1 290 € (≤ 100) | Offert à leurs consultants + tableau de bord marque employeur | Argument de recrutement |
| **ESN « Vivier+ »** | 1 490-2 990 €/mois | Part de voix du vivier face aux concurrents, par cluster | Coût d'un jour d'intercontrat (HYPOTHÈSE) |

**Argument de valeur** : une mission de 3 mois vaut ~31 200 € facturés (60 j × 520 €, D). Pro coûte 348 €/an, **soit 1,1 % d'une seule mission.**

## 3. Go-to-market des 100 premiers clients payants

| # | Levier | Quand | Hypothèse |
|---|---|---|---|
| 1 | **Case study publique de l'expérience 0** (protocole + chiffres réels), publiée sur LinkedIn (source n°1 citée) et sur le site | M2-M3 | Seulement si SUCCÈS ; sinon, on publie l'échec honnêtement (c'est aussi du contenu) |
| 2 | Outil gratuit (vérificateur + audit 1 JD) → liste d'attente | M2 | 2 000 audits gratuits d'ici M5 |
| 3 | 10 beta freelances du réseau (FCT, IPSSI, communautés) | M2 | 5 convertis en clé en main |
| 4 | Contenu LinkedIn du founder, 3 fois par semaine : il est son propre cas d'usage | continu | — |
| 5 | Communautés : forum Free-Work, Discord et Slack de devs FR, Indie Hackers FR ; Product Hunt à M4 | M3-M4 | — |
| 6 | **3 sociétés de portage en pilote** (visibilité offerte comme avantage) | M4 | 20-80 consultants chacune |
| 7 | Rapport « State of AI Sourcing » issu du panel | M4 | Presse spécialisée (Blog du Modérateur, Maddyness) |

**Entonnoir cible** : 2 000 audits gratuits × 5 % de conversion = **100 payants vers M5**. Cette hypothèse sera mesurée dès M3.

## 4. Chemin vers 500 K€/mois

| Jalon | Date | B2C Pro | Audits + services | B2B | API / partenaires | **Revenu mensuel** |
|---|---|---|---|---|---|---|
| **M3** | déc. 2026 | 20 × 29 € = 0,6 K | 5 × 490 + 20 × 49 ≈ 3,4 K (unique) | 0 | 0 | **~1 K récurrent + 3,4 K unique** |
| **M6** | mars 2027 | 150 × 29 € = 4,4 K | ~2 K | 3 portage × 490 € = 1,5 K | 0 | **~8 K** |
| **M12** | sept. 2027 | 800 × 32 € = 25,6 K | ~5 K | 25 × 1 000 € = 25 K | 0 | **~56 K** (~670 K ARR) |
| **M24** | sept. 2028 | 4 000 × 35 € = 140 K (FR ~1 500 + EN ~2 500) | ~40 K | 180 × 1 500 € = 270 K | 6 × 8 K = 48 K | **~500 K** |

**Vérifications de cohérence**
- M24 B2C FR : 1 500 abonnés = **1,25 %** des ~120 000 freelances IT. Plausible.
- M24 B2B : 180 comptes = **6 %** des ~3 000 structures FR (portage + Numeum), plus UK/EU.
- ARPU B2C de 29 € à 35 € : mix annuel/mensuel, montée vers un palier 79 €.

## 5. La vérité de Victoria

1. **500 K€/mois à M24 n'est pas réaliste en solo sans financement.** La catégorie peut l'atteindre (Peec : ~10 M$ d'ARR,
   avec une série A de 21 M$ ; C), mais avec une équipe. Le chemin réaliste en bootstrap place **500 K€/mois vers M30-M36**.
   Pour M24, il faut une **levée seed à M9-M12**, sur la base d'une traction mesurée à M6-M9.
2. **Le B2B porte 54 % du revenu à M24.** Sans portage ni ESN, pas de 500 K.
3. **Le B2C seul est un produit à churn** (analogue ATS). Il sert d'entonnoir et de preuve, pas de moteur de revenu.
4. **L'issue B (outil interne) coûte moins de 20 €/mois** et reste disponible à tout moment. Le risque financier du démarrage est quasi nul.

## 6. Équipe (HYPOTHÈSE)

| Période | Équipe |
|---|---|
| M0-M6 | Founder seul (+ War Room) |
| M6-M9 | 1re recrue : sales/partnerships B2B (portage/ESN), ou un cofondateur business |
| M12 | 4 personnes (+ 1 ingénieur, + 1 growth/contenu) |
| M24 | 8-10 personnes |

## 7. Économie unitaire (HYPOTHÈSES)

| Indicateur | Valeur |
|---|---|
| Coût API par client Pro | **~6-21 $/mois à faible densité** (10 clients par cluster, panel mensuel) → **~3-10 $** à forte densité (100 clients par cluster, panel hebdomadaire) (MEASUREMENT_SPEC §10-ter) |
| Marge brute B2C | faible, voire négative en M1-M6 → ~65-85 % à densité cible. **D'où l'audit payant unique et le B2B dès le départ.** |
| Marge brute B2B | > 90 % (le panel est mutualisé) |
| CAC cible | < 3 mois de revenu |
| Churn à surveiller | B2C mensuel ; alerte à > 8 %/mois |

## 8. Risques business

| Risque | Probabilité | Parade |
|---|---|---|
| Les recruteurs ne sourcent pas via LLM (G1) | **Inconnue, et c'est le problème** | Interviews avant tout build |
| LinkedIn/Malt exposent gratuitement un score de visibilité | Moyenne | Neutralité multi-moteurs + B2B vivier (que LinkedIn ne vendra pas aux ESN) |
| Peec/Otterly ajoutent une entité « Personne » | Moyenne | Vitesse, prompts de recruteurs réels, positionnement RH (et non marketing) |
| Le canal 3 (bases propriétaires) remplace le canal 1 | Moyenne à forte | Option C5 (Talent MCP) à M12, avec des profils déjà vérifiés |
| Perception « black-hat » | Faible si charte | Charte publique + scan d'onboarding + refus du « n°1 garanti » |
