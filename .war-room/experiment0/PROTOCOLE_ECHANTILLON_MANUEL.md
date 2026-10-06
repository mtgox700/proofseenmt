# PROTOCOLE — Échantillon manuel d'étalonnage

> Auteur : **Retrieval Scientist**, relu par Dr. Elias Voss et Legal & Trust · Tâche W8 du sprint S1 · Rédigé le 2026-09-18.
> Références : `EXPERIMENT_0.md` §5.2 et bloc CORRECTIONS, `MEASUREMENT_SPEC.md` §9 (calibration) et bloc CORRECTIONS,
> `foundations/CONFORMITE.md` §5 (dernière ligne : apps grand public = étalonnage interne seulement).

## 1. Objet

L'API n'est pas l'app grand public (modèle, prompt système, personnalisation). L'échantillon manuel sert à :

1. **Étalonner** l'API : taux d'accord API/app sur « le client apparaît : oui/non », pour ChatGPT, Claude et Perplexity.
2. **Couvrir Gemini et Copilot**, qui ne sont pas mesurés par API (conditions incompatibles, `foundations/research/R5`).
3. **Alimenter H0** pour Gemini (le critère H0 porte sur 3 moteurs API + Gemini manuel).

Ce n'est **pas** une mesure vendable : aucun résultat par app n'est publié ni vendu avant validation juridique. Gemini n'est jamais présenté comme un moteur mesuré.

## 2. Plan d'échantillonnage

| Paramètre | Valeur |
|---|---|
| JD | les **10 JD cibles** du manifeste gelé (les 3 témoins sont exclues) |
| Formulation | **P1** uniquement, texte exact du manifeste gelé |
| Apps | ChatGPT, Claude, Perplexity, Gemini, Copilot |
| Répétitions | 1 saisie par couple JD × app |
| Total | 10 × 5 = **50 saisies par vague** (~2 h) |
| Vagues | J0 (2026-09-28), J+30 (2026-10-28), J+60 (2026-11-27) |
| Fenêtre | dans les **48 h** de la vague API correspondante |

## 3. Environnement

- [ ] Même ordinateur, même navigateur, même réseau pour toute la vague ; VPN coupé ; localisation France.
- [ ] **Navigation privée**, une nouvelle fenêtre privée par app.
- [ ] **Déconnecté si l'app le permet.** Si elle exige une connexion : utiliser un compte sans historique, **mémoire et personnalisation désactivées**
  si l'option existe, et noter `logged_out=false`.
- [ ] Modèle et mode **par défaut** de l'app (on mesure ce que voit un recruteur, pas un optimum). Ne pas activer ni désactiver manuellement la recherche web.
- [ ] Ordre de passage : app par app, JD dans l'ordre des identifiants du manifeste. Heure UTC notée pour chaque saisie.

## 4. Déroulé d'une saisie

1. [ ] Ouvrir une **nouvelle conversation**.
2. [ ] Coller le texte **P1 exact** avec la JD nettoyée du manifeste. Aucun mot ajouté, retiré ou reformulé.
3. [ ] Envoyer **une seule fois**. Ne pas régénérer, ne pas relancer, ne pas poser de question de suivi.
4. [ ] Lire la réponse et décider :
   - `client_present` = `true` si Ayoub est nommé (variantes de `identity.json`) **ou** si l'une de ses **URL vérifiées** apparaît ; sinon `false`.
   - `client_rank` = position d'Ayoub parmi les **personnes** proposées, dans l'ordre d'apparition, en commençant à 1. On ne compte ni les plateformes
     ni les agences. Vide si `client_present=false`.
   - Catégorie H0 (dans les notes) : l'app **nomme des individus**, renvoie **seulement des plateformes**, ou **refuse**.
5. [ ] Remplir la ligne du CSV **immédiatement**.
6. [ ] Fermer la fenêtre privée. **Aucune capture d'écran, aucun copier-coller de la réponse**, nulle part. Une capture prise par erreur est supprimée aussitôt.

## 5. Fichier `manual_sample.csv`

En-tête exact (le gabarit de l'équipe code prime en cas d'écart de codage) :

`wave_id,jd_id,app,date_utc,logged_out,client_present,client_rank,notes_sans_nom`

| Colonne | Contenu | Valeurs admises |
|---|---|---|
| `wave_id` | identifiant de la vague, identique au manifeste | `J0`, `J30`, `J60` |
| `jd_id` | identifiant de la JD dans le manifeste | JD cibles uniquement |
| `app` | app utilisée | `chatgpt`, `claude`, `perplexity`, `gemini`, `copilot` |
| `date_utc` | date et heure de la saisie, en UTC, format ISO 8601 | ex. de format : `2026-09-28T14:05Z` |
| `logged_out` | session déconnectée ? | `true` / `false` (Excel : `VRAI`/`FAUX` accepté) |
| `client_present` | Ayoub est-il nommé ou une de ses URL vérifiées apparaît-elle ? | `true` / `false` |
| `client_rank` | rang parmi les personnes proposées | entier ≥ 1, ou vide |
| `notes_sans_nom` | **codes** uniquement, séparés par `;` (jamais de virgule) | voir ci-dessous |

Codes admis dans `notes_sans_nom` :

| Code | Sens | Valeurs |
|---|---|---|
| `h0=` | comportement de l'app face à la demande | `individus`, `plateformes`, `refus` |
| `web=` | l'app montre-t-elle des sources web ? | `1`, `0` |
| `src=` | domaines cités, liste blanche seulement (REQ-M2-05), séparés par `+` | `linkedin.com`, `github.com`, `malt.fr`, `codeur.com`, `dev.to`, `medium.com`, `ayoub-hammoudi.dev`, sinon `autre` |
| `n=` | nombre de personnes proposées | entier |
| `cnx=` | type de session si connecté | `compte-vierge`, `compte-perso` |
| `err=` | incident | `timeout`, `quota`, `captcha`, `autre` |

Exemple **de format** (valeurs fictives, ce n'est pas une donnée) :
`J0,T01,perplexity,2026-09-28T14:05Z,true,false,,h0=individus;web=1;n=5;src=linkedin.com+github.com+autre`

Contrôles de fin de vague :
- [ ] 50 lignes, une par couple JD × app, aucune colonne obligatoire vide.
- [ ] `client_rank` vide si et seulement si `client_present=false`.
- [ ] Relecture de la colonne `notes_sans_nom` : **uniquement des codes**, aucun mot libre.
- [ ] Si l'app bloque (captcha, quota) : ligne conservée avec `err=`, sans contournement. On ne résout **jamais** un captcha par un outil.

## 6. Règles RGPD (Legal & Trust)

- **Jamais de nom de tiers** : ni dans les notes, ni dans un fichier annexe, ni dans un message. Pas de nom de personne, pas d'URL de profil de tiers,
  pas de domaine personnel de tiers (réduit à `autre`).
- **Aucune capture non caviardée conservée** ; en pratique, aucune capture du tout pour cet échantillon.
- **Minimisation** : on ne conserve que oui/non, le rang du client et des codes. Aucune citation de la réponse.
- **Finalité** : étalonnage interne de l'expérience 0. Pas de réutilisation commerciale ni de publication par app avant validation juridique.
- **Données du client** : Ayoub est le client et le founder ; son identité est traitée avec son consentement.

## 7. Exploitation par `sim:report`

- **Accord API/app** (ChatGPT, Claude, Perplexity) : règle pré-enregistrée avant le 2026-09-27 (proposition dans `CHECKLIST_J0.md`).
  Si l'accord est **inférieur à 80 %**, on passe aux modèles supérieurs à la vague suivante (`MEASUREMENT_SPEC.md` §10-ter), décision datée dans `TEAM_MEMORY.md`.
- **Gemini** : ses 10 lignes (`h0=`) forment la 4e colonne du test H0 (40 cellules).
- **Copilot** : indication qualitative seulement, rapprochée du rapport Bing Webmaster « AI Performance » quand il est disponible.
