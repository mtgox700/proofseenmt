# Comportement des moteurs — mesuré sur la vague J0

> Source : **nos propres 780 tirages** du 2026-09-23/24 (13 offres réelles × 4 formulations × 3 moteurs × 5 tirages),
> manifeste gelé, empreinte `1bc9f85f…`. Analyse locale des compteurs de la vague et des réponses scellées.
> **Aucun nom de tiers n'est affiché ni conservé** : seuls des motifs et des domaines sont comptés.

C'est la première fois que le projet dispose de faits mesurés, et non d'hypothèses, sur la façon dont les moteurs
répondent à « trouve-moi les 5 meilleurs freelances pour cette mission ».

## 1. Les moteurs ne se comportent pas pareil, et l'écart est énorme

| Moteur | Réponses **sans aucune source** | Citations | Refuse de nommer | Cite un lien de profil |
|---|---|---|---|---|
| **OpenAI** | 26,5 % | 1 119 | **0 %** | **56,4 %** |
| **Perplexity** | **12,7 %** | 1 093 | 6,2 % | 48,8 % |
| **Anthropic** | **90,8 %** | 116 | **28,8 %** | 14,2 % |

Anthropic répond **neuf fois sur dix sans consulter la moindre source**, et refuse explicitement de nommer des
personnes réelles dans près d'un tiers des cas. Le founder a observé le même refus sur l'application Claude
le 2026-09-24. À l'inverse, OpenAI ne refuse jamais et cite un profil une fois sur deux.

**Conséquence directe** : « être cité par les LLM » n'est pas une propriété du freelance. C'est une propriété du
**couple (freelance, moteur)**. Toute promesse commerciale qui ignore le moteur est fausse.

## 2. Ce que les moteurs citent : des plateformes, pas des sites personnels

Sur 2 328 citations, toutes offres confondues :

| Source | Part |
|---|---|
| **malt.fr** | **39,0 %** |
| **linkedin.com** | **26,5 %** |
| free-work.com | 2,9 % |
| github.com | 2,9 % |
| malt.com | 2,5 % |
| autres domaines | 24,5 % |

Par moteur, la hiérarchie change : OpenAI est **Malt d'abord** (498 contre 178), Perplexity est **LinkedIn d'abord**
(430 contre 326). Perplexity cite aussi **free-work.com 65 fois** — un site d'annonces, donc une **page de liste**.

## 3. Ce que ça dit du pivot (PIVOT_ANONYME)

- **Contre le mécanisme A** (fiche individuelle sur notre domaine) : les citations vont massivement à deux plateformes
  installées. Un domaine neuf part sans autorité, sans historique et sans trafic. C'est exactement pour cela que le
  test à 3 bras est pré-enregistré plutôt que promis.
- **Pour le mécanisme B** (page d'entrée) : une page de liste d'un site d'annonces **est citée** (free-work chez
  Perplexity). C'est un indice, **pas une preuve** que notre page d'entrée le serait.
- **Transversal** : viser Anthropic n'a pas de sens tant qu'il ne cherche pas. La valeur d'un audit doit être
  présentée **par moteur**, et le refus de nommer doit être expliqué au client plutôt que masqué.

## 4. Ce que ces chiffres ne disent pas

- Ils valent pour **ces 13 offres**, **ces 4 formulations**, **ces modèles**, à **cette date**. Les moteurs changent.
- Les API ne sont pas les applications grand public : l'échantillon manuel de 50 saisies sert précisément à mesurer
  l'écart. Tant qu'il n'est pas fait, on ne peut rien affirmer sur ce que voit un recruteur dans ChatGPT.
- « Citer une plateforme » n'est pas « recommander la bonne personne » : on mesure une mécanique, pas une pertinence.
