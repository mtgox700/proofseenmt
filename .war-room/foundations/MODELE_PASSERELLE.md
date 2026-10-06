# MODÈLE « PASSERELLE » — décision du founder (2026-09-18)

> Décision : **modèle A + D** — deux étages + partenariat portage. **Test de l'étage 2 dès la phase P0**, sans aucun code avant le 2026-11-27.
> Ce document prime sur les parties « modèle économique » de STRATEGIE, PLAN_ENTREPRISE et PRODUCT_THESIS (voir leurs blocs de correction).
> Tous les chiffres sont des **HYPOTHÈSES**, sauf mention d'une source.

## 1. Le problème résolu

- **Abonnement freelance seul = churn** : le freelance résilie dès qu'il décroche une mission.
- **Visibilité sans intermédiation = fuite** : l'entreprise contacte le freelance directement, et Proofseen ne capte aucune valeur.

## 2. Le modèle

| Étage | Rôle | Revenu |
|---|---|---|
| **1. Visibilité** | Mesure, correction, hub personnel (ce qui est déjà construit) | Gratuit ou peu cher : **outil d'acquisition** des freelances |
| **2. Passerelle** | Pages profil **vérifiées** sur proofseen.com, optimisées pour être citées par les IA ; contact et contrat via Proofseen | **Commission sur le TJM** des missions signées via Proofseen |

**Principes de l'étage 2**
- **Nom partiel** sur les pages publiques (« Ayoub H. »), à l'image d'Upwork, mais **preuves complètes** : missions, faits sourcés, disponibilité vérifiée, TJM. Le freelance reste citable par les IA ; l'entreprise, pour aller vite, contacte via Proofseen.
- **Commission principalement côté entreprise** (repère : Crème de la Crème ≥ 15 % côté client, 0 % côté freelance — `research/D_MARCHE.md`). Taux exact : HYPOTHÈSE, à valider en pré-vente.
- **Clause de non-contournement** (CGU entreprise) : frais si l'entreprise signe en direct, sous 12 mois, un freelance découvert via Proofseen. Pratique courante chez Upwork et Malt. **Force juridique à valider par le juriste.**
- **La colle, c'est la valeur, pas la contrainte** : paiement sécurisé, facturation, contrat type, assurance, zéro paperasse.
- **D — Portage** : ⚠ **SUSPENDU le 2026-09-20** (décision du founder, `PIVOT_ANONYME.md` §6). Le portage fait du freelance un **salarié** du porteur, ce qui fait courir un risque de qualification en **placement privé** (déclaration préfectorale ; **gratuité obligatoire pour le travailleur**, C. trav. L5321-3). En V1 : **pas de portage**, le freelance facture en direct et la **commission est facturée à l'entreprise**, jamais prélevée sur le consultant. À rouvrir uniquement après l'avis de l'avocat. *Texte d'origine : le partenaire de portage porte le contrat et la facturation ; Proofseen apporte la mission, avec partage de commission sur le TJM.*

## 3. L'économie (HYPOTHÈSES)

- 500 K€/mois à 10 % de commission ⇒ ≈ 5 M€ de missions facturées par mois.
- TJM moyen ≈ 520 € (`research/D_MARCHE.md`, secondaire) × ≈ 20 jours ≈ 10,4 K€ par freelance et par mois.
- ⇒ **≈ 480 freelances en mission en même temps**, contre plus de 10 000 abonnés dans le modèle abonnement.
- **Contrepartie** : il faut des **entreprises clientes** — le problème classique d'une marketplace à deux côtés, et le plus difficile.

## 4. Risques et points ouverts

| Risque | Gravité | Traitement |
|---|---|---|
| **AI Act** : présenter ou classer des freelances pour des entreprises = côté recruteur ⇒ possible « haut risque » (Annexe III 4(a)) | **Élevée** | Juriste, avant tout matching automatisé. L'étage 2 V0 = pages + contact, **sans classement automatique** proposé aux entreprises |
| RGPD : les pages publiques deviennent un traitement par Proofseen | Moyenne | Consentement du freelance, nom partiel, contrôle total sur sa page |
| Force de la clause de non-contournement en B2B | Moyenne | Juriste |
| Intermédiation et paiement (réglementation) | Moyenne | Passer par le portage (D) ou Stripe Connect ; juriste |
| Fuite par LinkedIn | Structurelle | Assumée : on gagne par la valeur, pas par l'obligation |
| Marketplace à deux côtés (poule et œuf) | **Élevée** | Test P0 ci-dessous avant toute construction |

## 5. Le test en phase P0 (sans code)

| Test | Seuil proposé (HYPOTHÈSE, à confirmer par le founder avant le 2026-10-18) | Échéance |
|---|---|---|
| **3 entreprises** acceptent de passer par Proofseen pour une mission freelance réelle, commission comprise (lettre d'intention ou premier contrat) | 3 | 2026-11-27 (gate) |
| **1 société de portage** accepte le principe du partage de commission | 1 | 2026-11-27 |

Ces tests **s'ajoutent** à la gate (3) existante (10 pré-paiements freelances), qui reste valable pour l'étage 1.
