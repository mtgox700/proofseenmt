# Gabarits de l'expérience 0

| Fichier | Rôle | Où mettre la version remplie |
|---|---|---|
| `manifest.template.json` | 13 JD (T01-T10 cibles, C01-C03 témoins), formulations P1-P4 v1, 3 moteurs, n = 5, plafond 50 $ | `.war-room/experiment0/private/manifest.json` |
| `identity.template.json` | Identité d'Ayoub (noms, ville, stack, URL possédées) | `.war-room/experiment0/private/identity.json` |
| `manual_sample.template.csv` | En-tête de l'échantillon manuel J0 (50 lignes à remplir, `PROTOCOLE_ECHANTILLON_MANUEL.md` §5) | `.war-room/experiment0/private/manual_sample.csv` |

- Le dossier `private/` est **exclu de git** (`.gitignore`) : il contient le texte des offres et ton identité complète.
- **Stack** : ne garder que ce qui est vrai et défendable (truth lock). Elle sert seulement à l'appariement « probable ».
- **`verifiedAt`** : à remplir (ISO 8601, ex. `2026-09-25T10:00:00Z`) **uniquement** après la preuve de possession (`PROCEDURE_US-F00.md`).
  Sans aucune URL vérifiée, la CLI ne calcule aucun appariement.
- **Gel** : le 2026-09-27, renseigner `frozenAt` dans le manifeste. Une vague réelle refuse un manifeste non gelé. Ensuite, plus aucune modification :
  son empreinte SHA-256 est inscrite dans chaque rapport.
- **Modèle Anthropic mesuré = `claude-sonnet-5`** (et non Haiku 4.5, dont le retrait est possible dès le 2026-10-15, entre J0 et J+30 :
  changer de modèle en cours d'expérience casserait la comparabilité). Le **même modèle** doit servir aux 3 vagues. Haiku reste l'extracteur.
- Formulations P1-P4 : version 1, **provisoires** (MEASUREMENT_SPEC §5). Les prompts réels issus des interviews seront ajoutés en **v2, à côté**,
  jamais à la place, pour garder la série comparable.

Vérifier les gabarits sans dépenser un centime :

```bash
pnpm sim:run --manifest .war-room/experiment0/templates/manifest.template.json --identity .war-room/experiment0/templates/identity.template.json --dry-run --runs-dir runs-dryrun
```

**Échantillon manuel dans Excel** : tu peux ouvrir `manual_sample.template.csv` dans Excel, le remplir et l'enregistrer en « CSV UTF-8 ».
La CLI accepte le format d'Excel français (séparateur `;`, BOM, guillemets) et `VRAI`/`FAUX`, `oui`/`non` ou `1`/`0` pour les
colonnes oui/non. Une ligne invalide est refusée avec son numéro : rien n'est deviné. Vérifier le fichier avant J0 :

```bash
pnpm sim:check-manual --manual .war-room/experiment0/private/manual_sample.csv
```
