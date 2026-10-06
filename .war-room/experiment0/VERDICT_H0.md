# Verdict H0 — les moteurs acceptent-ils de nommer des individus ?

> Échéance protocolaire : 2026-10-04. Rédigé le 2026-09-24, à valider par le founder.
> Source : vague **J0** (780 tirages API, manifeste gelé, empreinte `1bc9f85f…`) + **30 saisies manuelles** en
> applications grand public. Réserve assumée : **Gemini et Copilot non mesurés** (décision du founder, 2026-09-24).

## 1. L'hypothèse et son seuil, fixés avant la mesure

| | |
|---|---|
| **H0** | Au moins **2 moteurs sur 4** acceptent de **nommer des individus** dans une réponse de sourcing |
| **KILL précoce** | Au moins **3 moteurs sur 4 refusent** de nommer → le canal « se faire citer » est fermé aux personnes |

## 2. Ce qui a été mesuré

| Moteur | API (260 réponses chacun) | Applications (10 offres) | Nomme des individus ? |
|---|---|---|---|
| **OpenAI** | **0 % de refus**, 56,4 % citent un lien de profil | listes de personnes, sans le client | **OUI** |
| **Perplexity** | 6,2 % de refus, 48,8 % citent un lien de profil | listes de personnes, sans le client | **OUI** |
| **Anthropic** | 28,8 % de refus, 90,8 % des réponses **sans aucune source** | **refus sur 10/10** | **NON, en pratique** |
| Gemini | non mesuré | non mesuré | **inconnu** |

## 3. Verdict : **H0 VALIDÉE**

Deux moteurs sur quatre nomment des individus, et ils le font massivement : OpenAI ne refuse jamais, Perplexity refuse
dans 6 % des cas. Le seuil est atteint **sans avoir besoin de Gemini**.

**La réserve sur Gemini ne peut pas renverser le verdict**, et c'est vérifiable par simple arithmétique :

- H0 demande **2 moteurs sur 4** : OpenAI et Perplexity suffisent, quel que soit le comportement de Gemini.
- Le KILL demande **3 refus sur 4** : seul Anthropic refuse. Même si Gemini refusait, cela ferait **2 refus**, pas 3.

Aucun résultat possible de la mesure manquante ne change la décision. La réserve est donc **sans effet sur ce verdict** —
elle reste vraie pour toute affirmation portant spécifiquement sur Gemini ou Copilot.

## 4. Ce que ce verdict autorise, et ce qu'il n'autorise pas

**Il autorise** de continuer à travailler le canal « se faire citer » pour des personnes : les moteurs qui cherchent
nomment bien des individus, avec des liens vers leurs profils.

**Il n'autorise pas** de promettre une visibilité indépendante du moteur. La mesure montre l'inverse :

- « Être cité » est une propriété du **couple (freelance, moteur)**. Anthropic ne cherche pas neuf fois sur dix.
- Les citations vont aux **plateformes installées** : Malt 39 %, LinkedIn 26,5 % (`research/E_COMPORTEMENT_MOTEURS_J0.md`).
- Sur 780 tirages API et 30 saisies en applications, le client n'apparaît **jamais** : la visibilité de départ est nulle.

## 5. Conséquence pour la suite

- Tout audit vendu doit présenter ses résultats **par moteur**, et expliquer le refus d'Anthropic au lieu de le masquer.
- Le pivot reste suspendu au **test à 3 bras** : H0 dit que les moteurs nomment des gens, pas qu'ils citeraient une
  fiche pseudonyme hébergée sur un domaine neuf.

---

**Validation du founder** : ☐ verdict accepté · ☐ réserve Gemini/Copilot assumée · date : ……………
