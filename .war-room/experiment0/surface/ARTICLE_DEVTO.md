# ARTICLE DEV.TO — Plan détaillé (action A7)

> Auteurs : Dr. Elias Voss (GEO) et Head of Talent · Tâches W13-W14 · 2026-09-18.
> Publication **manuelle** par le founder sur dev.to, puis cross-post Medium avec **URL canonique** pointant vers dev.to
> (ou vers la page du site, si l'article y est publié en premier). À partir de J1 (2026-09-29) ; action datée dans `actions.log`.
> Tout le matériau vient du dépôt `C:\Users\HP\Desktop\MyOwnBangers\SEISME` (AFTERSHOCK). Aucun chiffre hors de ce dépôt.
> Langue : **anglais** sur dev.to (audience et vocabulaire des offres AI/Data en anglais) ; version française sur le site ou en
> article LinkedIn si souhaité.

## Titre et accroche

- **Titre (EN)** : *I killed Airflow mid-ingestion to prove my data lake replays without duplicates*
- **Titre (FR, version site)** : *J'ai tué Airflow en pleine ingestion pour prouver que mon datalake rejoue sans doublon*
- **Sous-titre** : *Idempotent Bronze ingestion with `_SUCCESS` markers (count, size, SHA-256) — 12,462,374 bytes before and after, to the byte.*
- **Tags dev.to (4 max)** : `dataengineering`, `airflow`, `spark`, `python`
- **Lien vers le site** : en fin d'introduction et en conclusion, `https://ayoub-hammoudi.dev/missions/aftershock`
  (lien éditorial normal, pas de bourrage de mots-clés).

## Plan détaillé

### 1. Le problème (≈ 150 mots)
- L'USGS publie une magnitude **automatique** puis la **révise** ; l'historique n'est consultable qu'un séisme à la fois.
- Le projet AFTERSHOCK réunit 3 sources dans un datalake Bronze/Silver/Gold sur HDFS.
- Pourquoi la rejouabilité compte ici : la récolte de l'historique appelle l'API une fois par séisme, **près de deux heures de réseau** ;
  un DAG qui plante à mi-course ne doit ni tout refaire, ni dupliquer ce qu'il a déjà écrit.
- Chiffres de contexte : 17 526 séismes, 7 939 versions archivées pour 2 128 séismes. *(README « Ce que le pipeline établit »)*

### 2. L'architecture en une figure (≈ 100 mots + schéma)
- Reprendre le schéma ASCII de la section « Architecture » du README (source 1 : Kafka → Spark Structured Streaming ;
  source 2 : lots mensuels FDSN ; source 3 : `includesuperseded=true` par lots de 100).
- **4 DAG Airflow chaînés par Datasets**, pas par capteurs : chaque DAG déclare le Dataset qu'il produit, le suivant est planifié dessus.
  `bronze_catalog_ingestion → silver_events → gold_insights` ; `versions_pipeline` déclenché à la main. *(README « Orchestration », `dags/`)*

### 3. Le mécanisme d'idempotence : un marqueur qui prouve, pas un marqueur qui espère (≈ 350 mots + code)
- Extrait commenté de `src/ingest/batch_to_bronze.py`, fonction `ingest_month` :
  1. si `_SUCCESS` existe dans le répertoire du lot et que `force` n'est pas demandé → `DEJA INGERE`, on sort ;
  2. si le nombre d'événements atteint la limite de page de l'API → **échec explicite** plutôt qu'un lot tronqué en silence ;
  3. écriture de `events.geojson`, puis **relecture de la taille écrite** ; si elle diffère, on supprime le fichier et on échoue ;
  4. seulement ensuite, écriture du marqueur JSON : `events`, `bytes`, `sha256`, `period`, `ingested_at`.
- Idée clé à formuler : le marqueur est écrit **en dernier** ; un lot sans marqueur est, par construction, un lot à refaire.
- Bronze est partitionné par **date d'ingestion**, immuable : un séisme révisé ne peut pas retomber dans une partition déjà
  marquée. *(README « Les pièges du jeu de données », §4 « `time` n'est pas `updated` »)*
- Même logique pour l'historique des versions : `src/ingest/versions_to_bronze.py`.

### 4. La preuve : `make replay` (≈ 300 mots + tableau)
- Ce que fait `scripts/prove_replay.sh` : table rase, déclenchement du DAG, **`docker kill` d'Airflow en plein vol**, redémarrage,
  relance, puis second rejeu sur un lac déjà complet.
- Tableau du README à reproduire tel quel :

  | Étape | Marqueurs | Fichiers |
  |---|---|---|
  | après table rase | 0 | 0 |
  | après arrêt brutal | 5 | 5 |
  | après relance | 12 | 12 |
  | après second rejeu | 12 | 12 |

- Résultat : **12 462 374 octets avant et après le rejeu, à l'octet près.**
- Message à faire passer : « Une phrase dans un README ne vaut rien ; une manipulation que l'on peut rejouer vaut tout. »
  (reformuler, ne pas recopier mot pour mot.)

### 5. Ce que l'idempotence ne couvre pas (≈ 150 mots, section d'honnêteté)
- Le DAG `versions_pipeline` n'est pas planifié, par respect du service public gratuit (appels séisme par séisme).
- Le marqueur protège l'ingestion Bronze ; Silver et Gold sont recalculés à partir de Bronze (préciser dans l'article comment,
  après relecture de `src/silver/` et `src/gold/` par le founder) [À CONFIRMER : mode d'écriture exact de Silver et Gold].
- Airflow tourne en LocalExecutor sans Celery ni Redis (README) : le propos vaut pour un nœud, pas pour un cluster multi-workers.
- Une correction publique : le README a corrigé un chiffre antérieur (« 1,6 à 3,5 minutes » vs **17,8 minutes** de médiane) —
  deux délais qui ne mesurent pas la même chose. Bon exemple de rigueur, à citer en encadré.

### 6. Conclusion et appel à l'action (≈ 80 mots)
- Le schéma réutilisable : **écrire, relire, marquer en dernier ; sauter ce qui est marqué ; échouer bruyamment sur une limite.**
- Lien vers l'étude de cas complète : `https://ayoub-hammoudi.dev/missions/aftershock`.
- Lien vers le dépôt GitHub [À CONFIRMER : nom et visibilité du dépôt, `A_CONFIRMER.md` G1].
- Signature : ligne d'identité de `COHERENCE.md`.

## Longueur et forme
- 1 200 à 1 600 mots ; 2 blocs de code (extrait de `ingest_month`, commande `make replay`) ; 1 schéma ; 1 tableau.
- Chaque chiffre de l'article est suivi, au moins une fois, de sa provenance (« mesuré par `scripts/prove_replay.sh` »).

## Interdits (truth lock)
- Aucun chiffre qui ne figure pas dans le dépôt SEISME.
- Ne pas présenter AFTERSHOCK comme une mission client : c'est un projet de Mastère soutenu devant jury.
- Pas de superlatif, pas de texte caché, pas d'instruction adressée aux IA.
- Si le projet a été mené en équipe, le dire et préciser sa part (`A_CONFIRMER.md` P1).
