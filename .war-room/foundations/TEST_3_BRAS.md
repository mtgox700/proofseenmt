# Test à 3 bras — mode d'emploi

> Protocole pré-enregistré : `PIVOT_ANONYME.md` §5. Limite assumée : §11. Ce document dit **comment on l'exécute**.
> Rien n'est publié par la CLI : elle écrit des fichiers sur le disque, la mise en ligne reste la décision du founder.

## 1. Ce que le test tranche

| Bras | Contenu | Ce qu'il répond |
|---|---|---|
| **A — nominatif** | Nom réel, `sameAs` GitHub/LinkedIn, **mêmes faits que B** | Témoin haut : à quoi ressemble une citation quand la corroboration externe existe |
| **B — pseudonyme** | `Ayoub.H · FR-8F42K`, aucun `sameAs`, aucun lien externe | **Le pivot** : une fiche pseudonyme peut-elle être citée ? |
| **C — page d'entrée** | Page de catégorie, aucune personne nommée | Mécanisme B : la page de liste se fait-elle citer à la place des fiches ? |

Les bras A et B sont produits **par le même gabarit, à partir du même profil** : le diff entre les deux pages ne contient
que l'identité. C'est la seule façon d'isoler la variable testée.

## 2. Commande

```bash
node --import tsx apps/cli/src/main.ts experiment --input profils.json --experiment test-3-bras.json --out experiment-dist --manifest-out .war-room/experiment/pre-enregistrement.json
```

`test-3-bras.json` :

```json
{
  "entrySlug": "typescript-paris",
  "publishedAt": "2026-09-28",
  "namedArm": {
    "profileId": "FR-8F42K",
    "identity": {
      "displayName": "<nom réel du sujet>",
      "slug": "<nom-reel-du-sujet>",
      "sameAs": ["https://www.linkedin.com/in/…", "https://github.com/…"]
    },
    "consent": { "selfPublished": true, "givenAt": "2026-09-2X", "scope": "named_arm_of_the_three_arm_test" }
  }
}
```

La commande **refuse d'écrire quoi que ce soit** tant qu'un bloquant subsiste :
- bras B trop mince (il partirait en `noindex` et ne pourrait pas être cité) ;
- bras A sans `sameAs` (le témoin haut perdrait le signal qu'il doit apporter) ;
- bras C impossible : il faut **3 profils** partageant compétence et zone, sinon la page serait une *doorway page* ;
- profil jumeau absent du lot : les bras A et B ne porteraient pas les mêmes faits.

## 3. Pare-feu d'identité pendant le test

Le bras A publie un nom réel **volontairement**. Le balayage anti-fuite est donc scindé, pas désactivé :

| Fichiers | Règle |
|---|---|
| `p/**`, `api/profiles.json`, `robots.txt`, pages de catégorie, contact | Balayage complet contre **toutes** les identités privées, sujet compris |
| `n/**`, accueil, `sitemap.xml` | Balayage complet contre toutes les autres identités ; pour le sujet, **seuls `realName` et les liens** sont tolérés — un e-mail, un téléphone ou un identifiant légal y reste une fuite |

Le catalogue lu par les agents (`api/profiles.json`, connecteur MCP) **ne contient pas le bras A** : il reste pseudonyme.

## 4. Séquence du jour J, puis J+30 et J+60

Toutes les commandes se lancent depuis la racine du dépôt (`node --import tsx apps/cli/src/main.ts <commande>`).

| Quand | Qui | Commande ou action | Ce qu'elle garantit |
|---|---|---|---|
| J-1 | CLI | `experiment --input profils.json --experiment test-3-bras.json --out site` | Aucun bloquant, les trois bras portent les mêmes faits |
| J | **Founder** | Déployer le dossier `site` sur le domaine | — |
| J | CLI | `site-verify --out site --base-url https://…` | Pages servies à l'identique, aucun robot bloqué par règle, aucun `noindex` ni script ajouté |
| J | CLI puis **founder** | `indexnow --out site --base-url https://…` puis, s'il est d'accord, la même avec `--confirm-submit` | Rien n'est soumis sans décision explicite |
| J | **Founder** | Brave URL submit, Google Search Console (manuels) | — |
| J | CLI | `experiment-arms … --verified-at <date de la preuve de possession> --out arms` | Chaque bras est reconnu par exactement les URL publiées |
| J+30 | CLI (**GO API**) | `run --manifest vague-150.json --identity arms/arm-B.json --arms arms/arm-A.json,arms/arm-B.json,arms/arm-C.json --confirm-spend` puis `experiment-verdict --wave <id> --day 30` | Point d'étape, **aucune décision** |
| J+60 | CLI (**GO API**) | Même manifeste avec un **nouvel identifiant de vague** (et `frozenAt` renseigné), puis `experiment-verdict --wave <id> --day 60` | **Verdict pré-enregistré**, appliqué mécaniquement |
| J+30, J+60 | CLI | `ldr --wave <id> --log access.log --paths /p/…/,/n/…/,/freelances/…/` | Visites réelles des robots (seule preuve d'accès) |

Règles de lecture fixées **avant** la mesure (`packages/stats/src/threearm.ts`) :
- un bras « personne » (A, B) est cité quand il est reconnu **avec certitude** (une URL du bras à côté de la personne) ; un nom seul ne compte pas ;
- la page d'entrée (C) est citée quand l'une de ses URL est donnée comme source, et son taux se calcule sur les **JD cibles** ;
- les tirages en erreur sont **exclus**, jamais comptés comme « non cités » ;
- une vague `--dry-run` produit un rapport marqué **SIMULATION**, qui ne décide jamais rien.

Le pré-enregistrement et les identités des bras ne sont **jamais publiés** (le bras A porte le nom réel).

## 5. Ce qui est contrôlé, optimisé, non garanti

| CONTRÔLÉ | OPTIMISÉ | NON GARANTI |
|---|---|---|
| Publier trois bras identiques sauf l'identité, le même jour | Être indexé (soumission, robots ouverts, contenu unique) | Être **cité** par un LLM |
| Mesurer les hits de robots, l'indexation et les citations | La probabilité qu'une requête déclenche la fiche | Le comportement des moteurs à J+30 ou J+60 |
| Fixer les seuils **avant** la mesure | La qualité des faits publiés | Qu'un connecteur MCP soit listé par une plateforme |

## 6. Ce que le test ne mesure pas

Les bras A et B décrivent la même personne : pendant l'expérience, **le bras pseudonyme n'est pas anonyme**. Le sujet est
le founder, qui y consent. La robustesse de l'anonymat se teste ailleurs, sur des profils sans jumeau nominatif, avec le
score de ré-identification comme garde-fou. **Jamais sur un profil client.** À la fin, les deux bras sont dépubliés — en
sachant qu'une indexation par un LLM est irréversible.

## 7. Dette ouverte — la preuve de possession du domaine du test

**Constat du 2026-09-26.** Les identités des bras A et B déclarent `proofMethod: "well_known_file"` avec un
`verifiedAt` posé **à la main** le 2026-09-24. Or aucun fichier de preuve n'existe sur `proofseen.com` :

```
[ -- ] https://proofseen.com/n/ayoub-hammoudi/ · well_known_file · preuve illisible (HTTP 404)
```

**Ce que cela ne remet pas en cause.** Nous contrôlons réellement le domaine : achat IONOS le 2026-09-21, DNS pointé
par nous, déploiement Vercel par nous. Le test mesure bien nos pages, et le verdict reste interprétable.

**Ce que cela remet en cause.** La preuve **enregistrée** est fausse. Nous exigerons de chaque client une preuve
vérifiable avant de mesurer quoi que ce soit (US-F00) ; nous ne pouvons pas nous en dispenser nous-mêmes. Une exigence
qu'on applique aux autres et pas à soi n'est pas une exigence, c'est un argument de vente.

**Correction — état au 2026-09-26.**

| Étape | État |
|---|---|
| `PROOFSEEN_PROOF_SECRET` posé dans `.env` par le founder | ✅ fait |
| Jetons émis (`possession --identity arms/arm-A.json` et `arm-B.json`) | ✅ fait |
| `proofseen-dist/.well-known/proofseen-verification.txt` déposé | ✅ fait |
| Redéploiement Vercel | ⬜ **founder** |
| `possession --identity … --verify` sur les deux bras | ⬜ après le redéploiement |

Un seul jeton par bras, et non un par page : le jeton d'une preuve `well_known_file` est dérivé du **domaine**, puisque
c'est le domaine qu'elle prouve. Le fichier de preuve porte donc deux lignes, une par identité mesurée sur ce domaine.

La date de vérification sera alors **écrite par la mesure**, plus par nous — ce qui était tout l'objet de la dette.


## 8. Séquence du 2026-10-24 (J+30), commande par commande

Le manifeste est **déjà prêt** : `.war-room/experiment0/manifest-J30.json`, produit le 2026-09-26 par
`follow-up --manifest manifest.json --wave J30`. Il est identique à J0 **à deux champs près** — `waveId` et
`frozenAt` — vérifié champ par champ. Offres, formulations, moteurs et modèles sont repris mot pour mot : c'est la
condition pour que la comparaison veuille dire quelque chose.

```bash
# 1. Relever l'indexation (E1) à la main, dans Search Console et Bing Webmaster.
#    Noter le nombre de pages indexées : la CLI ne mesure pas E1.

# 2. Contrôler les surfaces (obligatoire : le préflight refuse sans trace de moins de 30 jours).
# La trace est écrite à côté de chaque identité (arm-A.surface-check.json, arm-B.surface-check.json) :
# les deux bras partagent un dossier, et le nom du fichier les distingue.
npx tsx apps/cli/src/main.ts surface-check --identity .war-room/experiment0/proofseen/arms/arm-A.json
npx tsx apps/cli/src/main.ts surface-check --identity .war-room/experiment0/proofseen/arms/arm-B.json

# 3. Figer le manifeste : mettre frozenAt à l'instant courant, au format 2026-10-24T09:00:00Z.

# 4. Contrôler avant de dépenser.
npx tsx apps/cli/src/main.ts preflight --manifest .war-room/experiment0/manifest-J30.json \
  --identity .war-room/experiment0/proofseen/arms/arm-B.json

# 5. Mesurer. ~16 $, comme J0. Rien ne part sans --confirm-spend.
# ⚠ --arms attend une LISTE DE FICHIERS séparés par des virgules, jamais un dossier.
npx tsx apps/cli/src/main.ts run --manifest .war-room/experiment0/manifest-J30.json \
  --identity .war-room/experiment0/proofseen/arms/arm-B.json \
  --arms .war-room/experiment0/proofseen/arms/arm-A.json,.war-room/experiment0/proofseen/arms/arm-B.json \
  --confirm-spend

# 6. Comparer à la référence.
npx tsx apps/cli/src/main.ts report --wave J30 --baseline J0

# 7. Point d'étape des bras. J+30 ne tranche RIEN : le verdict est à J+60.
npx tsx apps/cli/src/main.ts experiment-verdict --wave J30 --day 30
```

**Ce que J+30 ne fait pas.** Aucune décision n'est prise le 24/10. Le verdict pré-enregistré tombe au **2026-11-23**,
quatre jours avant la gate. Un point d'étape qui deviendrait une décision viderait le pré-enregistrement de son sens.

**Rappel du §13.** Quel que soit le résultat du bras B, le verdict ne pourra pas conclure sur une fiche à identifiant
**opaque** : le pseudonyme testé porte le vrai prénom.

**Purge.** Les réponses brutes de J30 s'effacent 72 h après la mesure. `wave-status --wave J30` affiche l'échéance ;
tout ce qui doit être ré-analysé doit l'être avant.
