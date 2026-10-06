# Les 13 offres de la vague J0

Dépose ici **un fichier texte par offre**, nommé exactement comme son identifiant dans le manifeste :

```
T01.txt … T10.txt   offres cibles  (postes que tu vises vraiment)
C01.txt … C03.txt   offres témoins (postes hors de ta cible : elles servent à détecter une dérive)
```

Colle le **texte intégral** de l'annonce, tel qu'il apparaît sur sa source publique. Retours à la ligne, guillemets et
accents passent sans problème : la commande d'import lit le fichier tel quel.

## Règles de collecte

- **Offres réelles uniquement**, copiées à la main depuis une source publique. Aucune annonce inventée ou reformulée :
  la mesure perdrait tout sens.
- **Aucune offre ne doit te nommer**, ni citer une de tes URL. L'import le refuse, parce qu'une offre qui te nomme
  gonflerait ton propre classement.
- **Pas de doublon**, même reformulé : le pré-vol compare les textes et refuse deux fois la même annonce.
- **300 caractères minimum** par offre. En dessous, la cellule ne mesure rien.
- Les 10 cibles doivent ressembler aux missions que tu veux ; les 3 témoins doivent en être clairement éloignées.

## Import

```bash
node --import tsx apps/cli/src/main.ts jd-import --manifest .war-room/experiment0/templates/manifest.template.json --identity identity.json --dir .war-room/experiment0/offres --out manifest.json
```

La commande dit lesquelles ont été importées et lesquelles manquent encore. Elle n'écrase jamais le fichier source.

Ensuite, et seulement ensuite :

```bash
node --import tsx apps/cli/src/main.ts preflight --manifest manifest.json --identity identity.json
```

Le pré-vol ne coûte rien et ne fait aucun appel réseau. Il doit afficher **GO** avant toute dépense.

> Ces annonces appartiennent à leurs auteurs : elles restent locales, ne sont jamais republiées, et aucun nom de tiers
> n'est conservé dans les résultats de mesure.
