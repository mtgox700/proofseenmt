# Formats de vague et coût réel

> Coûts **mesurés** sur la vague J0 du 2026-09-23 (et non estimés) : **0,0206 $ par tirage** en moyenne, sur les trois
> moteurs. Par moteur : Anthropic 0,0305 $, OpenAI 0,0197 $, Perplexity 0,0116 $.

| Format | Composition | Tirages | Coût API |
|---|---|---|---|
| **Recherche** (`templates/manifest.template.json`) | 3 moteurs × 13 offres × 4 formulations × 5 tirages | 780 | ≈ **16 $** |
| **Audit client** (`audit-client.json`) | 3 moteurs × 5 offres × 2 formulations × 5 tirages | 150 | ≈ **3,10 $** |
| **Panel de cluster** (`panel-cluster.json`) | 3 moteurs × 6 offres × 2 formulations × 5 tirages | 180 | ≈ **3,70 $** pour **tout le cluster** |

## Pourquoi 780 tirages seulement pour la recherche

Les 4 formulations et les 13 offres servent à établir le mécanisme : savoir si le résultat dépend de la façon dont le
recruteur pose sa question, et détecter une dérive grâce aux offres témoins. On paie ça **une fois**, à J0 et à J+60,
parce que ce sont ces mesures-là qui décident du projet.

Un audit client répond à une autre question — « est-ce que ce freelance sort sur ses offres cibles ? » — et 150 tirages
y suffisent. Sur un audit vendu 49 €, l'API pèse **environ 6 %**. Le coût réel d'un audit, c'est le temps humain :
lecture du rapport, échantillon manuel, recommandations.

## Le levier : une réponse lue pour plusieurs personnes

L'appel payant, c'est la **réponse du moteur**. Le rapprochement avec une identité ne coûte rien. Le mécanisme
multi-bras (`--arms`, construit pour le test à 3 bras) lit **la même réponse pour plusieurs identités** :

- 10 freelances audités séparément : 10 × 3,10 $ = **31 $**
- 10 freelances dans une vague de panel : **3,70 $**, soit **0,37 $ par personne**

Condition : ils doivent viser les **mêmes offres** (même compétence, même zone), sinon la vague ne mesure rien pour eux.

## Utilisation

```bash
node --import tsx apps/cli/src/main.ts jd-import --manifest .war-room/experiment0/formats/audit-client.json --identity <client>.json --dir <dossier des offres> --out audit.json
```

Puis `preflight`, puis la vague. Pour un panel, ajouter `--arms <identité1>.json,<identité2>.json,…` à la commande `run` :
une ligne par tirage **et par personne** est écrite dans `arms.jsonl`.

Les deux fichiers contiennent des offres marque-place : le pré-vol **refuse** de lancer tant qu'elles ne sont pas
remplacées par de vraies annonces.
