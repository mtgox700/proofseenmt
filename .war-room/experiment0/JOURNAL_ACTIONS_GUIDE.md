# GUIDE — Tenir `actions.log`

> Auteurs : Retrieval Scientist + Dr. Elias Voss · Tâche W8 du sprint S1 · Rédigé le 2026-09-18.
> Références : `EXPERIMENT_0.md` §4 (« chaque action est datée dans `experiment0/actions.log`, pour pouvoir attribuer les effets »), `ROADMAP.md` S2.

## 1. Pourquoi

Le verdict de J+60 compare des mesures avant et après. Sans dates fiables, on ne peut pas relier un changement de Retrieval Rate ou de SoRV@5 à une action.
Le journal est la **seule** trace des interventions sur les surfaces mesurées.

## 2. Format d'une ligne

`AAAA-MM-JJ | action A1..A8 | surface | description factuelle | preuve (URL)`

| Champ | Règle |
|---|---|
| Date | date **de mise en ligne effective** (pas la date où le travail a commencé), format `AAAA-MM-JJ`, heure de Paris |
| Action | `A1` à `A8` (`EXPERIMENT_0.md` §4). Pour un changement de surface hors plan (jeton US-F00, JSON-LD d'hygiène, correction d'erreur) : `HORS-PLAN` |
| Surface | `site`, `linkedin`, `github`, `malt`, `codeur`, `devto`, `medium`, `gsc`, `bing-wmt`, `indexnow`, `brave` |
| Description | ce qui a changé, au présent, sans adjectif ni effet supposé ; aucun nom de tiers |
| Preuve | URL publique de la page modifiée ou publiée ; pour une console sans URL publique : `fichier:` suivi du chemin de la capture locale |

- Séparateur : ` | ` (espace, barre verticale, espace). **Aucune barre verticale** à l'intérieur d'un champ.
- Une ligne = une action sur une surface. Une action qui touche trois surfaces donne trois lignes.

> Note pour l'équipe code : `sim:report` doit accepter la valeur `HORS-PLAN` (ou l'ignorer explicitement) sans rejeter le fichier.

## 3. Correspondance actions / surfaces

| Action | Contenu (`EXPERIMENT_0.md` §4) | Surfaces |
|---|---|---|
| A1 | Site en HTML statique, disponibilité datée, pages `/missions/<slug>`, FR et EN | `site` |
| A2 | robots.txt (6 robots) + sitemap | `site` |
| A3 | Indexation : GSC, Bing WMT + IndexNow, vérification `site:` sur Brave | `gsc`, `bing-wmt`, `indexnow`, `brave` |
| A4 | LinkedIn : titre, Infos, expériences ; 2 articles + 4 posts en 30 jours, **publiés à la main** | `linkedin` |
| A5 | GitHub : README de profil + 4 repos épinglés | `github` |
| A6 | Malt complet, Codeur.com en option | `malt`, `codeur` |
| A7 | Article technique sur dev.to ou Medium, lien vers le site | `devto`, `medium` |
| A8 | Cohérence d'entité : même nom, titre, ville, photo, liens croisés | toutes |

Ordre imposé (`ROADMAP.md` S2) : **A1 → A2 → A3 → A8 → A4 → A5 → A6 → A7**.

## 4. Exemples de format (illustratifs : aucune de ces actions n'est faite à ce jour)

```
2026-09-24 | HORS-PLAN | linkedin | Jeton US-F00 ajouté dans la section Infos puis retiré le même jour | https://www.linkedin.com/in/ayoub-hammoudi-3251851b8
2026-10-0X | A2 | site | robots.txt : autorisation des 6 robots de recherche et ajout de la ligne Sitemap | https://ayoub-hammoudi.dev/robots.txt
2026-10-0X | A3 | gsc | Sitemap soumis dans Google Search Console | fichier:experiment0/indexation/2026-10-0X_gsc-sitemap.png
2026-10-XX | A4 | linkedin | Publication d'un post sur la mission AFTERSHOCK (chiffres vérifiés uniquement) | <URL du post>
```

## 5. Règles

- [ ] **Le jour même** : une action est consignée le jour de sa mise en ligne, pas de mémoire une semaine plus tard.
- [ ] **Ajout seulement** : on n'efface ni ne réécrit une ligne. Une erreur se corrige par une nouvelle ligne `HORS-PLAN` qui commence par
  « Correction de la ligne du AAAA-MM-JJ : … ».
- [ ] **Rien avant J0**, sauf des lignes `HORS-PLAN` (jetons US-F00). Aucune action A1-A8 n'est mise en ligne avant la fin de la vague J0.
- [ ] **Fenêtre de mesure** : aucune action n'est mise en ligne pendant une vague (J+30 le 2026-10-28, J+60 le 2026-11-27, 48 h chacune).
- [ ] **Vrai uniquement** : chaque contenu publié respecte le truth lock (pas de LangGraph pour Phantera, pas de « 0 downtime », séniorité défendable,
  chiffres vérifiés dans le code).
- [ ] **Aucune automatisation** : LinkedIn et Malt sont modifiés et publiés à la main par le founder. Aucune action interdite
  (texte caché, instruction aux IA, faux avis, pages en masse) n'est journalisée, parce qu'aucune n'est faite. Si une erreur de ce type survient,
  elle est consignée en `HORS-PLAN`, corrigée, et signalée dans `TEAM_MEMORY.md`.
- [ ] **Pas de données de tiers** : aucun nom, aucun commentaire de tiers, aucune URL de profil de tiers.
- [ ] **Clôture avant chaque re-mesure** : la veille de J+30 et de J+60, noter dans `TEAM_MEMORY.md` le nombre de lignes et la date de la dernière ligne.
  Le rapport de la vague cite ces deux valeurs.
