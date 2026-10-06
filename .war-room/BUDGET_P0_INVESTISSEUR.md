# Proofseen — Prérequis et budget de la phase « Preuve » (sept. → nov. 2026)

> Objectif de la phase : prouver, avant de construire la plateforme, que la méthode fonctionne.
> Mesure sur le profil du fondateur les 28/09, 28/10 et 27/11/2026 ; décision go / no-go le 27/11/2026.
> Les montants marqués **(estimation)** sont des ordres de grandeur. Les prix **à confirmer** doivent être vérifiés au moment de l'achat.

## 1. Indispensable avant le 28/09/2026

| Poste | Fournisseur | Type | Montant | Remarque |
|---|---|---|---|---|
| Crédit API OpenAI | platform.openai.com | Crédit prépayé, paiement à l'usage | **70 $** | 260 tirages par mesure ; pire cas 20,80 $ par mesure. Recherche web : 10 $ / 1 000 recherches + tokens (tarifs officiels du 18/09/2026) |
| Crédit API Anthropic (Claude) | console.anthropic.com | Crédit prépayé, paiement à l'usage | **110 $** | **Le poste le plus lourd** : Anthropic sert à la fois de moteur mesuré (Claude Sonnet 5) **et** d'extracteur sur les 780 réponses (Claude Haiku 4.5) → pire cas 35,88 $ par mesure |
| Crédit API Perplexity | perplexity.ai (API) | Crédit prépayé, paiement à l'usage | **30 $** | Agent API, modèle `perplexity/sonar` ; pire cas 7,80 $ par mesure |
| **Sous-total API** | | | **≈ 210 $** | Couvre les **3 mesures au pire cas** : 64,48 $ par mesure, soit 193,40 $ (calcul issu du code, vérifiable par `pnpm sim:preflight`). Le coût réel sera plus bas ; le crédit non consommé reste disponible |

- Chaque compte a un **plafond de dépense** : il est impossible de dépasser le crédit versé.
- Le logiciel s'arrête lui-même au plafond fixé pour chaque mesure : **70 $** (décision du founder du 2026-09-20).
  Ce plafond doit couvrir le **pire cas** d'une vague complète (780 tirages → 64,48 $) : en dessous, la vague s'arrêterait en route
  et la mesure deviendrait non publiable. Le pire cas suppose que chaque réponse atteint le plafond de jetons et de recherches.
- **Aucun abonnement mensuel n'est nécessaire.** ChatGPT Plus et Claude Pro ne donnent pas accès à l'API, et les versions gratuites suffisent pour les vérifications manuelles.

## 2. À prévoir d'ici fin octobre 2026

| Poste | Prestataire | Montant | Remarque |
|---|---|---|---|
| Juriste : CGV de pré-vente, RGPD, conditions des fournisseurs | Avocat ou juriste en droit du numérique | **Sur devis** | Indispensable avant le premier encaissement ; brief d'une page déjà prêt (`presale/BRIEF_JURISTE.md`) |
| Recherche d'antériorités de la marque « Proofseen » | Conseil en propriété industrielle | **Sur devis** | Avant tout dépôt |
| Dépôt de marque INPI (France) | inpi.fr | **À confirmer** sur inpi.fr (taxe par classe ; 3 classes visées : 9, 35, 42) | Après l'avis du conseil |
| Noms de domaine proofseen.com / .io / .fr / .ai | Registrar au choix | **À confirmer** chez le registrar (le .ai est généralement plus cher) | Disponibles au 18/09/2026 ; réservation défensive possible dès maintenant |

## 3. Gratuit, aucun budget

- Google Search Console et Bing Webmaster Tools (mesure de l'indexation).
- Outils de développement : Node.js, pnpm, TypeScript, tests (logiciels libres).
- Dépôt de code : GitHub privé (compte existant du fondateur).

## 4. Seulement si le go / no-go du 27/11/2026 est positif (phase suivante, dès décembre 2026)

| Poste | Type | Montant |
|---|---|---|
| Hébergement du site et de la plateforme (Vercel, Neon) | Abonnements mensuels | **Moins de 150 € / mois** hors API (estimation) |
| Paiements en ligne (Stripe) | Commission par transaction, sans abonnement | **À confirmer** sur stripe.com |
| Crédit API pour les audits clients | Paiement à l'usage, refacturé dans les prix | ≈ 2 à 8 $ par audit complet (estimation) |

## 5. Récapitulatif

| Période | Engagement ferme | Sur devis ou à confirmer |
|---|---|---|
| Avant le 28/09/2026 | **≈ 210 $** de crédit API (3 mesures au pire cas) | — |
| Octobre-novembre 2026 | **≈ 24 $** pour le test à 3 bras du pivot anonyme (2 vagues réduites de 150 tirages) | — |
| Octobre 2026 | — | Juriste, conseil en PI, dépôt INPI, domaines |
| Après le 27/11/2026 (si go) | — | Hébergement < 150 € / mois (estimation) + commissions Stripe |

Si le go / no-go est négatif, les dépenses s'arrêtent là : l'outil reste utilisable en interne pour moins de 20 € par mois.
