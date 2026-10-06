# PROCÉDURE US-F00 — Preuve de possession des URL d'Ayoub

> Auteurs : Retrieval Scientist + Dr. Elias Voss · Tâche W8 du sprint S1 · Rédigé le 2026-09-18.
> Référence : `foundations/CAHIER_DES_CHARGES.md` US-F00 ; `MEASUREMENT_SPEC.md` correction 8 (« seules les URL vérifiées servent à l'appariement »).
> Échéance : **2026-09-26** (tâche F3). Jetons LinkedIn et GitHub **retirés avant le 2026-09-27**.

## 1. Pourquoi

Un appariement « certain » repose sur une URL du client présente dans la réponse d'un moteur. Si l'URL n'est pas prouvée comme appartenant au client,
on risque de mesurer un tiers. La règle s'applique aussi au founder : **aucune URL non vérifiée dans `identity.json`**.
Une identité sans aucune URL vérifiée ne produit aucun appariement (le rapport ne montre alors que les domaines de plateforme cités).

## 2. Générer les jetons

- [ ] Générer **un jeton par URL** (traçabilité : on sait quelle surface a été vérifiée avec quel jeton) :
  `node -e "console.log('ps-' + require('crypto').randomBytes(16).toString('hex'))"`
- [ ] Le jeton est **public par nature** (il sera affiché). Ce n'est pas un secret, mais il ne doit **jamais** être dérivé de `PROOFSEEN_ENC_KEY`
  ni d'une clé API, et il ne doit jamais être remplacé par l'une d'elles.
- [ ] Noter chaque jeton dans le registre (§6) avant de le publier.

## 3. Domaine `ayoub-hammoudi.dev` — une méthode au choix

| Méthode | Mise en place | Contrôle (PowerShell, par le founder) | Effet sur la mesure |
|---|---|---|---|
| **A. TXT DNS** (recommandée) | Enregistrement TXT à l'apex `ayoub-hammoudi.dev`, valeur `proofseen-verification=JETON` | `Resolve-DnsName -Type TXT ayoub-hammoudi.dev` (ou `nslookup -type=TXT ayoub-hammoudi.dev`) | Aucun : le contenu du site n'est pas modifié |
| **B. Fichier** | Fichier `/.well-known/proofseen-verification.txt` contenant uniquement le jeton, sur une ligne | `curl.exe -s https://ayoub-hammoudi.dev/.well-known/proofseen-verification.txt` | Aucun sur les pages |
| **C. Balise meta** | Dans le `<head>` de la page d'accueil : `<meta name="proofseen-verification" content="JETON">` | voir la commande sous le tableau | Négligeable : balise de vérification standard, invisible, qui ne s'adresse à aucun moteur d'IA |

Contrôle de la méthode C : `curl.exe -s https://ayoub-hammoudi.dev/ | findstr /i "proofseen-verification"`

- [ ] Méthode choisie et mise en place.
- [ ] Contrôle réussi : la valeur renvoyée est **exactement** le jeton (pas d'espace, pas de guillemet en trop).
- [ ] Méthode B : certains hébergeurs ou générateurs statiques ignorent les dossiers commençant par un point. Si le contrôle renvoie une 404, le signaler et passer à la méthode A.
- [ ] Sous PowerShell 5.1, `curl` est un alias d'`Invoke-WebRequest` : **toujours taper `curl.exe`**.
- [ ] La preuve de domaine peut rester en place (elle permet de re-vérifier plus tard).

## 4. GitHub `github.com/Ayoubhm07`

- [ ] Ajouter le jeton dans la **bio** publique du profil (Settings → Public profile → Bio).
- [ ] Vérifier par **une visite normale** de `https://github.com/Ayoubhm07` dans une fenêtre de navigation privée (vue publique) : le jeton est visible.
- [ ] Noter la vérification dans le registre (§6).
- [ ] **Retirer le jeton** de la bio le jour même, et au plus tard le 2026-09-26.

## 5. LinkedIn `linkedin.com/in/ayoub-hammoudi-3251851b8` (et Malt, s'il existe)

- [ ] Vérifier que le **profil public** est activé (sinon la visite en navigation privée ne montrera rien).
- [ ] Placer le jeton **temporairement** dans la section **Infos** (de préférence au titre, qui est plus exposé et plus susceptible d'être indexé pendant la fenêtre).
- [ ] Si LinkedIn propose de partager la modification avec le réseau : **refuser**.
- [ ] Vérifier **une seule fois, à la main**, par une visite normale du profil public dans un navigateur.
- [ ] Ne conserver **aucune capture** montrant d'autres profils (encarts « autres profils consultés », suggestions). Si une capture est prise, la recadrer sur le seul champ contenant le jeton.
- [ ] **Retirer le jeton** le jour même, et au plus tard le 2026-09-26, pour que la surface mesurée à J0 soit celle d'avant le test.
- [ ] Malt : confirmer si un profil existe. Si oui, même procédure (jeton temporaire dans la présentation, visite manuelle unique, retrait le jour même).

### Règle absolue : aucune automatisation sur LinkedIn et Malt

- [ ] Pas de `curl.exe`, de script, de navigateur piloté (headless ou non), d'extension ni d'outil de la CLI `sim:*` sur LinkedIn ou Malt.
- [ ] Pas de connexion d'un agent au compte du founder ; les identifiants ne sont jamais transmis.
- [ ] Seule une visite humaine, unique, dans un navigateur ordinaire compte comme vérification.

## 6. Registre de vérification (à remplir, puis à reporter dans `identity.json`)

On consigne l'**URL**, la **méthode** et la **date** (UTC). Le gabarit `identity.json` (équipe code, schéma `OwnedUrl`) porte les champs officiels ;
ce tableau sert de brouillon et de trace humaine.

| URL | Méthode (TXT DNS / fichier / meta / bio / section Infos) | Jeton (8 premiers caractères) | Date de vérification (UTC) | Vérifié par | Jeton retiré le | Résultat |
|---|---|---|---|---|---|---|
| `https://ayoub-hammoudi.dev` | | | | founder | sans objet (méthodes A/B) | ☐ vérifiée ☐ échec |
| `https://github.com/Ayoubhm07` | bio | | | founder | | ☐ vérifiée ☐ échec |
| `https://www.linkedin.com/in/ayoub-hammoudi-3251851b8` | section Infos | | | founder | | ☐ vérifiée ☐ échec |
| Malt (URL à confirmer) | | | | founder | | ☐ vérifiée ☐ échec ☐ pas de profil |

- [ ] Toute URL en échec est **exclue** de `identity.json` (pas d'appariement dessus).
- [ ] Les variantes de nom (« Ayoub Hammoudi », « Ayoub HAMMOUDI », « A. Hammoudi ») correspondent au nom affiché sur au moins une URL vérifiée.
- [ ] Chaque pose et chaque retrait de jeton sur une surface publique est aussi noté dans `actions.log` avec l'action `HORS-PLAN` (voir `JOURNAL_ACTIONS_GUIDE.md`).
