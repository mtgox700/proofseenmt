# STRATÉGIE — Dossier de fondation (Victoria Chen, lead · 2026-09-18)

> ⚠ **CORRECTION du 2026-09-18 — décision du founder : modèle « passerelle » A + D** (`MODELE_PASSERELLE.md`). La grille §5 reste valable pour
> l'**étage 1** (acquisition), mais le revenu principal visé devient la **commission sur le TJM** des missions signées via Proofseen (étage 2,
> contrat et facturation via un partenaire de portage). Nouvelle persona à ajouter : **l'entreprise cliente** (DSI, CTO, responsable achats IT).
> Le go-to-market P0 ajoute la recherche de **3 entreprises et 1 société de portage** pour tester l'étage 2.

> Sources : `research/R2` (positionnement), `research/R4` (personas, prompts), `research/R3` (conformité),
> `../RESEARCH_GROUND_TRUTH.md`. Tout chiffre non sourcé est une **HYPOTHÈSE**. Le nom de marque est
> **Proofseen** : choix du founder le 2026-09-18, sous réserve de la recherche d'antériorités par un conseil en PI (cf. `MARQUE.md`).

## 0. Deux corrections apportées par la recherche (et assumées)

| # | Constat sourcé | Ce qui change |
|---|---|---|
| C1 | Le sourcing assisté par IA le plus documenté (11 exemples sur 18) consiste à faire écrire au LLM une **requête booléenne ou X-ray**, que le recruteur lance ensuite sur Google, LinkedIn ou GitHub. Les LLM qui « trouvent des noms » passent par des outils (Comet, connecteurs, LinkedIn Recruiter) ; aucune source ne montre de recruteurs FR demander des noms de freelances de mémoire (R4 §D) | La **promesse** s'élargit de « l'IA vous recommande » à « **quand un recruteur cherche avec l'IA, est-ce qu'il vous trouve ?** ». Même produit, même surface de profil (les deux usages lisent les mêmes sources publiques). La conviction du founder (TEAM_MEMORY) n'est pas rouverte : le cadrage est simplement plus exact. |
| C2 | B2B : le consentement donné via l'employeur est fragile ; si une ESN utilise l'outil pour choisir quel consultant placer, on bascule en AI Act « haut risque » (R3 §1.5, §2) | Offre B2B = **l'entreprise paie, le consultant s'inscrit lui-même et reste seul destinataire de ses résultats** ; l'entreprise ne voit que des **agrégats anonymes**. La valeur vendue au B2B change en conséquence (§4). |

## 1. Mission, vision, north star

- **Mission** : rendre **mesurable et corrigeable** la visibilité d'un professionnel dans la recherche de talents assistée par IA, honnêtement.
- **Vision (M36)** : devenir la **référence de mesure** de la visibilité des talents dans l'IA : le standard que citent freelances, sociétés de portage et médias quand ils parlent de sourcing par IA.
- **North star produit** : **SoRV@5** (probabilité d'apparaître dans le top 5 d'une réponse, sur le cluster de JD cible, IC 95 %).
- **North star business** : **profils rendus visibles** (SoRV@5 passé de 0 à > 0, borne basse de l'IC > 0).

## 2. Personas

> Personas **archétypales** : les prénoms sont fictifs, les chiffres de contexte sont sourcés.

### P1 — « Karim », freelance tech confirmé (cible n°1)

| Élément | Contenu |
|---|---|
| Contexte sourcé | Âge moyen des freelances : 37 ans, 91 % d'anciens salariés, TJM tech & data de 546 € (Malt 2022) · étude Xerfi pour Comet (n = 1 224) : TJM moyen de 578 €, 3,7 ans d'indépendance · **canaux de mission : réseau 84 %, plateformes 39 %, ESN 24 %, cabinets 14 %** (R4 §A) |
| Job-to-be-done | « Quand ma mission se termine, je veux que les recruteurs qui cherchent mon profil me trouvent, sans passer mes soirées à prospecter. » |
| Douleurs | Intercontrat anxiogène (témoignages de 4 à 12 mois de recherche en 2025, forum Free-Work, anecdotique) · aucune visibilité sur ce que voient les recruteurs · plateformes opaques |
| Objections | « Encore un outil de personal branding » · « Je n'ai pas le temps » · « Les recruteurs n'utilisent pas vraiment ChatGPT » · « C'est du SEO, donc de la triche » |
| Réponses | Mesure avant/après avec IC (pas des promesses) · plan en 5 actions priorisées · la case study publique du founder · charte white-hat publique |

### P2 — « Sophie », dirigeante d'une société de portage salarial

| Élément | Contenu |
|---|---|
| Contexte sourcé | 518 sociétés, 43 127 portés (2022) ; âge moyen des portés : 45,2 ans ; 91 % des sociétés ont des consultants IT (rapport de branche 2025) · **guerre des prix** : frais passés de 8-10 % à 3-6 %, plafonds de 400 à 650 €/mois ; top 20 = 75 % du marché ; **EBE moyen 1,3 %** (baromètre Winki 2026) · 75 % des groupes aident à trouver des missions (PEPS 2023) (R4 §B) |
| Job-to-be-done | « Je veux un avantage concret à offrir à mes consultants pour les attirer et les garder, autrement qu'en baissant encore mes frais. » |
| Douleurs | Marges écrasées · différenciation par les services · consultants en intermission qui partent |
| Objections | « Mes marges sont de 1,3 %, je n'ai pas de budget » · « Mes consultants ne l'utiliseront pas » · « Risque RGPD sur mes consultants » |
| Réponses | Prix par consultant **activé** (payé à l'usage réel) · argument marketing pour son recrutement · architecture RGPD où elle ne voit jamais de données individuelles |

### P3 — « Julien », directeur d'agence ESN (cible M6+, sous conditions)

| Élément | Contenu |
|---|---|
| Contexte | Intercontrat ~13 %, 32 % des ESN voient leur taux d'occupation baisser (Numeum T4 2025, **source primaire non lue**) · coût mensuel d'intercontrat de 4 500 à 7 600 € (estimations d'éditeurs, **non vérifié**) · dossier de compétences réécrit pour chaque AO ; un business manager suit 10 à 15 consultants (R4 §C) |
| Job-to-be-done | « Je veux que mes consultants en intercontrat soient trouvés plus vite. » |
| Douleurs | Intercontrat coûteux · désintermédiation par les freelances directs (8 jours contre 2-3 mois via une ESN, LeMagIT 2023) |
| Objections | « Je veux voir qui est visible pour décider qui positionner » → **impossible par design** (AI Act) |
| Réponses | Offre « montée en visibilité de l'équipe » : chaque consultant améliore son propre profil ; l'ESN voit des indicateurs agrégés. **Si Julien exige des données individuelles, on ne vend pas.** |

⚠ **Victoria** : P3 est **affaiblie** par la correction C2. La valeur « piloter mon vivier » disparaît ; il reste « équiper mes consultants ». Le B2B à M24 (54 % du revenu dans le plan) repose donc davantage sur le **portage** que sur l'ESN. Ce point est à revoir à la revue M6 (2027-03-29).

## 3. Propositions de valeur

| Persona | Promesse (jamais de résultat garanti) | Preuve apportée |
|---|---|---|
| P1 Freelance | « Découvrez si les recruteurs qui cherchent avec l'IA vous trouvent, pourquoi, et corrigez-le, preuve à l'appui. » | Rapport avec funnel, IC, sources citées, re-mesure |
| P2 Portage | « Offrez à vos consultants un outil pour être mieux trouvés par les recruteurs qui cherchent avec l'IA. » | Compteur d'activation, agrégats mensuels par tranches (k ≥ 10), page marque employeur |
| P3 ESN | « Équipez vos consultants pour être trouvés plus vite. » | Indicateurs agrégés anonymes |

## 4. Positionnement face aux concurrents

| Concurrent | Ce qu'il promet (R2) | Ce qu'il ne fait pas | Notre angle |
|---|---|---|---|
| **Peec AI / Otterly / Profound** | Voir où **une marque** apparaît dans ChatGPT, Perplexity, Gemini ; benchmark concurrentiel | Pas d'entité « personne », pas de prompts recruteur, prix de marque, aucune mention de la variance | **La personne face à une JD**, mesure multi-tirages avec fourchette |
| **Jobscan / Teal** | Plus d'entretiens (« 3x », « 6X ») via le CV et le suivi de candidatures, sans méthode affichée | Uniquement le canal où **l'on postule** | Le canal où **l'on vous cherche** ; méthode publiée |
| **Malt** | Une plateforme de missions, avec un classement interne | Pas de boost payant ; ne mesure que son propre moteur | **Complément** : visibilité hors plateforme, neutre |
| **LinkedIn Premium** | Visibilité interne à LinkedIn | Ne dit rien sur les IA ni sur le web ouvert | Vue multi-sources |
| **Consultants GEO** | Services manuels pour entreprises | Chers, non mesurés, pas pour des individus | Produit mesuré à prix individuel |

**Codes de catégorie repris** : audit gratuit sans carte bancaire, cas avant/après.
**Codes refusés** : compteurs d'utilisateurs gonflés, promesses « x fois plus de… », « boost », « n°1 ».
**Positionnement en une ligne** : *le contrôle technique de votre visibilité dans le recrutement assisté par IA : mesuré, expliqué, corrigé honnêtement.*

## 5. Modèle économique et grille tarifaire (proposition finale, à valider par le founder)

| Offre | Prix TTC | Contenu | Raisonnement |
|---|---|---|---|
| **Audit flash** | 0 € | 1 JD, 3 moteurs, funnel E2-E5 + 3 actions ; **1 par identité vérifiée** | Coût API ~0,2-0,8 $ (18 appels) ; code d'entrée de la catégorie (R2) |
| **Audit complet** | **49 €** (unique) | 3 JD, rapport complet, carte des sources, plan de correction priorisé | Répond au churn du B2C ; coût API **2,2-8,1 $** (180 appels, 3 moteurs) ; **~9 % d'une journée de TJM** (546 €, Malt 2022) |
| **Pro** | **29 €/mois** ou **290 €/an** | Re-mesure mensuelle au design fixe, alertes, fraîcheur, panel du cluster | Aligné sur Premium Career (29,99 €) et Jobscan (49,95 $) ; **vendu sur la re-mesure** (R2). **V0.5 : « Pro fondateur », re-mesure lancée à la main, 20 abonnés maximum** ; automatisé en V1 (S13) |
| **Clé en main** | **490 €** (unique) | Hub généré et publié sur votre domaine + **textes** de réécriture LinkedIn/Malt/GitHub (**vous publiez vous-même**) + liste des preuves tierces à obtenir + re-mesure à J+45 (US-F07) | Cash et apprentissage ; **P0-P1 uniquement, 10 par mois maximum** ; repensé après le gabarit (ROADMAP S7) |
| **Portage « Avantage consultants »** | **490 €/mois** (≤ 25 activés) · **1 290 €/mois** (≤ 100 activés) | Licence ; chaque consultant s'inscrit lui-même ; la société ne voit que le **compteur d'activés** et, à partir de 10 activés, des agrégats mensuels par tranches ; + kit marque employeur | ~20 € puis ~13 € par consultant activé (HYPOTHÈSE) ; doit rester < 1 mois d'économie de frais d'un porté |
| **ESN « Équipe »** | 1 490 €/mois et plus (**M6+, après AIPD et avis d'un juriste**) | Idem portage, agrégats seulement | Offre gelée tant que la note de classification AI Act n'est pas validée |

**Droit de rétractation de 14 jours appliqué à tous**, même aux professionnels (R3 §5) : pour la confiance et la simplicité.

## 6. Go-to-market : les 100 premiers clients payants

| # | Levier | Sprint | Hypothèse |
|---|---|---|---|
| 1 | Case study publique du founder (protocole + chiffres réels, **ou échec honnête**) | S7 | Actif n°1 de crédibilité |
| 2 | Pré-vente directe dans le réseau (FCT, IPSSI, communautés) | S3-S5 | 10 pré-paiements = gate (3) |
| 3 | Contenu LinkedIn du founder, 3 fois par semaine, sur des sujets réels | continu | LinkedIn = domaine n°1 cité ; double effet |
| 4 | Audit flash + vérificateur bots/SSR gratuit | S7-S8 (manuel, **≤ 100 audits flash/mois**, plafond de budget journalier) → S12+ (libre-service) | V0.5 : ~100 audits flash/mois × 5 % ≈ 5 payants/mois ; l'objectif de 2 000 audits flash n'est atteignable qu'en V1 (HYPOTHÈSES) |
| 5 | 3 sociétés de portage en pilote (top 20 et challengers) | S9 | Canal de distribution B2B2C |
| 6 | « State of AI Sourcing » (données agrégées, aucun nom) | S10-S12 | Relais presse et autorité |
| 7 | Communautés : forum Free-Work, Discord et Slack de devs FR, Indie Hackers FR ; Product Hunt au lancement V1 | S10-S14 | — |

## 7. Moat

1. **L'historique des panels** par cluster : il s'accumule et personne ne peut le reconstruire rétroactivement.
2. **La bibliothèque de prompts de recruteurs réels** (interviews), versionnée.
3. **La confiance** : méthode publiée, charte white-hat, scan anti-triche, RGPD exemplaire. C'est une barrière pour les acteurs perçus comme « growth hack ».
4. **La distribution B2B2C** via le portage.
5. Plus tard : l'**option Talent MCP** (profils vérifiés), à M12+.

## 8. Métriques : l'entonnoir complet

| Étape | Métrique | Cible initiale (HYPOTHÈSE) |
|---|---|---|
| Acquisition | Visiteurs uniques de la landing | — |
| Activation 1 | Visiteur → audit flash lancé | 10 % |
| Activation 2 (« aha ») | Audit flash → rapport consulté jusqu'à la carte des sources | 60 % |
| Conversion | Audit flash → payant (audit complet, Pro ou clé en main) | 5 % |
| Valeur | Client payant → au moins 1 action appliquée sous 14 jours | 50 % |
| Preuve | Client Pro → re-mesure avec delta de SoRV ou RR > 0 | 40 % à M+2 |
| Rétention | Churn mensuel Pro | < 8 % |
| B2B | Consultants invités → activés | 30 % |
| Expansion | Portage : passage au palier 100 | — |

## 9. Ce qu'on refuse de faire

- Texte caché, instructions adressées aux LLM, cloaking, faux avis, fausses mentions, réseaux de sites.
- Automatiser quoi que ce soit sur LinkedIn ou Malt, ou scraper des tiers.
- Promettre « n°1 », « garanti », « x fois plus de missions ».
- **Montrer à un employeur les résultats individuels d'un consultant.**
- Vendre un classement de candidats à des recruteurs (ça ferait basculer le produit en AI Act haut risque et trahirait sa promesse).
- Vendre JSON-LD et llms.txt comme leviers.
- Construire la plateforme avant la gate du 2026-11-27.
