# PROFILE SURFACE — Comment bien référencer un profil (2026-09-18)

> Question du founder : « créer des sites web pour les profils, comme des portfolios, pour augmenter le référencement ? »
> Réponse du board (Elias en lead, Victoria, Legal & Trust), fondée sur `RESEARCH_GROUND_TRUTH.md`.

## 1. Réponse courte

**Oui au site, non au « portfolio seul ».** Le site est **nécessaire mais pas suffisant**.

| Constat | Ce que ça veut dire |
|---|---|
| HTML visible, rendu côté serveur = prérequis prouvé pour être lu par les bots IA | Il faut un site, et un site **statique** (pas une SPA React) |
| Les **mentions tierces** corrèlent 3 fois plus que les backlinks (0,664 contre 0,218) | Un LLM fait confiance à ce que **d'autres** disent de toi, pas seulement à ton site |
| **LinkedIn = domaine n°1 cité** pour les requêtes pro, et les posts/articles montent | LinkedIn pèse plus que ton site, via son contenu |
| GitHub = plateforme la plus ouverte aux bots IA | Deuxième pilier gratuit |
| Read.cv, Polywork et bento.me sont morts | Un portfolio seul n'est **ni un business ni un levier suffisant** |

→ **La bonne unité n'est pas « un site », c'est une « surface de profil » : un hub + des satellites + des preuves tierces, cohérents entre eux et à jour.**

## 2. L'architecture d'une surface de profil

```
                    ┌──────────────────────────────┐
                    │  HUB — site du freelance     │  domaine perso, HTML statique
                    │  /  /missions/<slug>  /dispo │  texte visible, FR/EN, daté
                    └──────────────┬───────────────┘
          liens croisés, même identité (nom, titre, ville, photo)
   ┌───────────────┬───────────────┼───────────────┬────────────────┐
   ▼               ▼               ▼               ▼                ▼
 LinkedIn        GitHub          Malt /         dev.to /         PREUVES TIERCES
 profil +        README +        Codeur         Medium           talks, meetups, podcasts,
 posts/articles  repos épinglés  (ouverts)      (articles)       contributions open source,
 (source n°1)    (le plus ouvert)                                témoignages sur sites clients
```

| Couche | Rôle pour le LLM | Contenu qui compte |
|---|---|---|
| **Hub** | Page que le moteur peut citer et résumer | Titre + stack + ville + mode + **disponibilité datée** + TJM (optionnel) ; **une page par mission** aux faits vérifiables et chiffrés (c'est le levier « statistiques » du GEO) |
| **Satellites** | Présence dans les sources que les moteurs citent le plus | Même vocabulaire que les JD visées, **vrai uniquement** |
| **Preuves tierces** | Corroboration par d'autres (le signal le plus fort) | Tout ce que le freelance **a réellement fait** et qui est publié par quelqu'un d'autre |
| **Fraîcheur** | ChatGPT privilégie le contenu récent | Mise à jour mensuelle de la disponibilité et de la dernière mission, un post par mois minimum |

## 3. La décision produit : où héberger le hub ?

Débat tranché par le board :

| Option | Pour | Contre |
|---|---|---|
| **A. Domaine du freelance** (`prenom-nom.dev`) | Il en est propriétaire, l'entité est claire, aucun soupçon de réseau de sites | Friction : il faut acheter et configurer un domaine |
| **B. Sous-domaine chez nous** (`prenom.produit.com`) | Zéro friction ; l'autorité du domaine s'accumule chez nous → c'est la **fondation de l'option Talent MCP/index** | Risque d'annuaire « mince » aux yeux des politiques anti-spam ; le profil appartient moins au freelance |

**Décision** : **A par défaut** (on génère le site, le freelance branche son domaine) ; **B en repli** pour ceux qui n'ont pas de
domaine, **avec des garde-fous** : pages indexées seulement si le profil est complet et vérifié, aucune page générée par
combinaison stack × ville.

## 4. Ce qu'on NE fait PAS (et pourquoi)

| Tentation | Pourquoi c'est non |
|---|---|
| Pages « freelance-react-paris », « freelance-react-lyon »… générées en masse | **Doorway pages / contenu de masse** = pénalisé par Google ; déjà tué (I47) |
| Texte caché ou instructions adressées aux LLM | Ligne rouge n°1 ; le scan d'onboarding le détecte |
| Faux témoignages, fausses mentions, réseau de sites qui se citent | Tromperie + schéma de liens ; déjà tué (I41) |
| Vendre JSON-LD et llms.txt comme leviers | Réfuté par les données (on les met en hygiène, sans les vendre) |
| Publier automatiquement sur LinkedIn | CGU ; le freelance publie lui-même |

## 5. Comment ça s'intègre au produit

1. **Mesurer** (Recruiter Simulator) : où tu sors, et **quelles sources** le moteur cite pour ton cluster.
2. **Diagnostiquer** : quelle couche manque (hub absent ? LinkedIn faible ? aucune preuve tierce ?).
3. **Corriger** : générer le hub, proposer les réécritures des satellites et la liste des preuves tierces à obtenir.
4. **Re-mesurer** : prouver le delta.

**Le site portfolio est l'étape 3, pas le produit.** Sans l'étape 1, on vend un portfolio de plus, comme ceux qui sont morts.
Avec l'étape 1, on vend un résultat mesuré.

## 6. Application immédiate : l'expérience 0

Les actions A1-A8 de `EXPERIMENT_0.md` appliquent exactement cette architecture au profil d'Ayoub : hub
`ayoub-hammoudi.dev` (A1-A3), LinkedIn (A4), GitHub (A5), Malt/Codeur (A6), article tiers (A7), cohérence (A8).
