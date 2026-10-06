# CHECKLIST J0 — Expérience 0 (founder)

> Auteurs : Retrieval Scientist + Dr. Elias Voss · Tâche W8 du sprint S1 · Rédigé le 2026-09-18.
> Références : `EXPERIMENT_0.md` (bloc CORRECTIONS), `MEASUREMENT_SPEC.md` (bloc CORRECTIONS), `ROADMAP.md` S1, `sprints/S1_PLAN.md`,
> `foundations/CAHIER_DES_CHARGES.md` (US-F00, US-F04, REQ-M2-05), `foundations/CONFORMITE.md` §4-§5.
> **Périmètre de mesure en vigueur** : 3 moteurs API (OpenAI recherche web, Anthropic recherche web, Perplexity Sonar) ·
> 13 JD × 4 formulations × 3 moteurs × 5 tirages = **780 appels par vague** · Gemini et Copilot en échantillon manuel seulement.
> Cette checklist appartient au founder : la War Room ne mesure rien et n'invente aucun résultat.

**Légende** : 🔴 bloquant pour J0 · ⚪ non bloquant · `PROPOSITION` = valeur du board à confirmer par le founder avant le gel.

**Fichiers de l'expérience** (dans `.war-room/experiment0/`) : `manifest.json`, `identity.json`, `manual_sample.csv`, `actions.log`
(gabarits fournis par l'équipe code, validés par les schémas zod). Emplacement des sorties `runs/`, `extract/`, `report/` : défini par la CLI (W7).

---

## J-7 — lundi 2026-09-21 : comptes, conditions, secrets

### Comptes API et plafonds de facturation 🔴

- [ ] **OpenAI** : compte API ouvert (Platform), moyen de paiement ajouté, **plafond de dépenses mensuel** réglé dans la console de facturation.
- [ ] **Anthropic** : compte Console ouvert, crédits ou facturation activés, **limite de dépenses** réglée.
- [ ] **Perplexity** : compte API ouvert, crédits achetés, **recharge automatique désactivée** si l'option existe.
- [ ] Montant des plafonds fournisseurs choisi par le founder, cohérent avec l'enveloppe P0 < 150 $ (`PROPOSITION` : ≤ 50 $ par fournisseur et par mois, HYPOTHÈSE).
- [ ] Pour chaque fournisseur, noter ici la date et le plafond réglé :

| Fournisseur | Plafond réglé | Date | Recharge auto coupée |
|---|---|---|---|
| OpenAI | | | |
| Anthropic | | | |
| Perplexity | | | |

### Conditions et DPA (REQ-M1-07 : aucun moteur actif sans conditions lues) 🔴

- [ ] **OpenAI** : conditions API lues ; DPA accepté (https://openai.com/policies/data-processing-addendum/) ; demande de ZDR envoyée (⚪ non bloquante).
- [ ] **Anthropic** : conditions commerciales lues ; DPA accepté (https://www.anthropic.com/legal/data-processing-addendum) ; demande de ZDR envoyée (⚪).
- [ ] **Perplexity** : **CGU API et DPA obtenus et lus** (non lus au 2026-09-18) ; seule l'API chat **Sonar** est utilisée, **jamais l'API `/search`**.
- [ ] Si les conditions d'un fournisseur sont jugées incompatibles ou restent illisibles au 2026-09-26 : moteur **retiré du manifeste avant le gel**, décision datée dans `TEAM_MEMORY.md` (le calcul d'appels et le critère H0 changent alors ; le Retrieval Scientist les recalcule avant le 27/09).
- [ ] ⚪ Demandes écrites à Anthropic (§D.4 « resale ») et Perplexity (§2.5) envoyées (F7, avant le 2026-10-02) : exigées avant le premier rapport **vendu**, pas avant J0.

### Fichier `.env` 🔴

- [ ] `.env` créé à la racine du projet à partir de `.env.example` (fourni par W1), **rempli par le founder lui-même** :
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `PROOFSEEN_ENC_KEY`.
- [ ] Générer `PROOFSEEN_ENC_KEY` (clé AES-256 de 32 octets, encodée en base64) avec :
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] La clé est copiée dans un gestionnaire de mots de passe. Elle n'est **jamais** collée dans un document de la War Room, un chat, un ticket ou une capture.
- [ ] `.env` figure dans `.gitignore` (vérification par lecture du fichier).
- [ ] Aucune clé n'est partagée avec un agent : le founder saisit lui-même les valeurs.

---

## J-6 → J-2 — du 2026-09-22 au 2026-09-26 : identité, site, corpus

### Identité et preuve de possession (F3) 🔴 — avant le 2026-09-26

- [ ] Procédure `PROCEDURE_US-F00.md` appliquée à `ayoub-hammoudi.dev`, `github.com/Ayoubhm07` et au profil LinkedIn.
- [ ] Profil Malt : existence confirmée (oui / non). S'il existe, vérifié selon la même procédure manuelle.
- [ ] **Jetons LinkedIn et GitHub retirés avant le 2026-09-27** (pour ne pas modifier les surfaces mesurées pendant J0).
- [ ] `identity.json` rempli : nom et variantes (« Ayoub Hammoudi », « Ayoub HAMMOUDI », « A. Hammoudi »), **uniquement des URL vérifiées**, avec méthode et date.
- [ ] Les variantes de nom correspondent au nom affiché sur au moins une URL vérifiée (US-F00).

### Site `ayoub-hammoudi.dev` (F4) 🔴 — avant le 2026-09-26

- [ ] `CHECKLIST_SITE_AYOUB.md`, colonne « Constat J-7 », remplie. **Constat seulement** : aucune correction du site avant la fin de J0
  (les corrections sont les actions A1-A3, datées dans `actions.log` à partir du 2026-09-29).

### Collecte des 13 JD (F5) 🔴 — avant le 2026-09-26

**10 JD cibles** (critères `EXPERIMENT_0.md` §2), collectées **à la main par copier-coller**, sans aucun outil de scraping :
- [ ] Sources : Free-Work, WTTJ, Malt Missions, LinkedIn Jobs, Indeed.
- [ ] Contrat : freelance ou régie.
- [ ] Lieu : Paris ou remote France.
- [ ] Rôle : Senior Full Stack TS/Next.js **ou** AI/LLM Engineer (RAG, évals, agents).
- [ ] Publiées il y a **moins de 60 jours** à la date de collecte.
- [ ] Langue : **7 en français, 3 en anglais**.

**3 JD témoins** (rôles adjacents non visés par l'optimisation) :
- [ ] Exemples de `EXPERIMENT_0.md` : Développeur Java/Spring, Admin système Linux, Développeur mobile Flutter.
- [ ] Mêmes règles de lieu, de contrat et de fraîcheur que les cibles.

Pour chaque JD, noter : identifiant (`T01`…`T10`, `C01`…`C03` ou la convention du gabarit), plateforme source, date de publication, date de collecte, langue, type (cible / témoin).

### Nettoyage des JD 🔴

- [ ] Retirer les noms de recruteurs et de contacts, les e-mails, les téléphones et les URL.
- [ ] Vérifier qu'aucune JD ne contient l'identité d'Ayoub (nom, URL) : la validation W2 la rejetterait.
- [ ] Ne pas réécrire le reste du texte (on mesure la JD telle qu'un recruteur la colle).

---

## J-1 — samedi 2026-09-26 et dimanche 2026-09-27 : manifeste, gel, dry-run

### Remplissage du manifeste 🔴

- [ ] 13 JD nettoyées, avec leurs attributs (cluster, langue, type cible / témoin).
- [ ] Formulations **P1-P4** (`MEASUREMENT_SPEC.md` §5), texte exact, version.
- [ ] 3 moteurs, **identifiant exact du modèle** pour chacun (niveau « mini / Haiku / sonar » en V0, `MEASUREMENT_SPEC.md` §10-ter).
- [ ] n = 5 tirages par cellule ; plafond de recherches par appel (`max_uses` chez Anthropic).
- [ ] Plafond de coût de la vague : `PROPOSITION` **50 $**.
- [ ] Identifiant de vague : `J0`.

### Décisions à pré-enregistrer avant le gel (F6) 🔴 — au plus tard le 2026-09-27

- [ ] **Seuil de succès** SoRV@5 ≥ 10 % : confirmé ou ajusté → valeur retenue : ______.
- [ ] **Plafond de 50 $ par vague** : confirmé ou ajusté → valeur retenue : ______.
- [ ] **Règle de décision H0** écrite (`PROPOSITION` du Retrieval Scientist : un moteur « nomme des individus » s'il nomme au moins une personne
  dans au moins 5 de ses 10 cellules JD cibles ; H0 est vraie si au moins 2 des 4 moteurs — 3 API + Gemini manuel — nomment des individus).
- [ ] **Règle d'accord API/app** écrite (`PROPOSITION` : pour une JD, l'API répond « oui » si le client apparaît dans au moins 1 des 5 tirages P1 ;
  accord = même réponse oui/non que l'app ; seuil de bascule vers les modèles supérieurs : accord < 80 %, `MEASUREMENT_SPEC.md` §10-ter).
- [ ] Entrée datée dans `TEAM_MEMORY.md` : seuils, plafond, règles H0 et accord, moteurs retenus.

### Gel du manifeste 🔴 — dimanche 2026-09-27

- [ ] Le manifeste passe la validation du schéma (commande fournie par W7).
- [ ] Empreinte SHA-256 du manifeste calculée et notée dans `TEAM_MEMORY.md` (PowerShell : `Get-FileHash .war-room\experiment0\manifest.json -Algorithm SHA256`).
- [ ] À partir de ce moment, **le manifeste n'est plus modifié**. Toute modification ultérieure invalide la vague J0 comme base pré-enregistrée.

### Dry-run de contrôle (sans aucun appel réseau) 🔴 — dimanche 2026-09-27

- [ ] `pnpm sim:run --manifest .war-room/experiment0/manifest.json --identity .war-room/experiment0/identity.json --wave DRY-0927 --dry-run`
- [ ] Le plan annonce **780 tirages** (13 × 4 × 3 × 5) et un coût estimé ≤ plafond.
- [ ] Aucun appel réseau, aucune clé consommée (console de facturation inchangée).
- [ ] Le nom du client n'apparaît dans aucun prompt généré.
- [ ] `pnpm sim:extract --wave DRY-0927 --identity .war-room/experiment0/identity.json --dry-run` puis `pnpm sim:report --wave DRY-0927 --dry-run` : un rapport Markdown est produit.
- [ ] Sorties du dry-run purgées (`pnpm sim:purge --wave DRY-0927`) : rien ne doit subsister sous l'identifiant `J0`.

### Point de décision GO / report 🔴 — dimanche 2026-09-27 au soir

- [ ] Toutes les cases 🔴 ci-dessus sont cochées.
- [ ] Sinon : **décaler tout le calendrier d'une semaine** (J0 = 2026-10-05), décision consignée dans `TEAM_MEMORY.md` **avant** le 2026-09-28. On ne mesure pas à moitié.

---

## J0 — lundi 2026-09-28 : mesure de base

### Pré-vol (gratuit, aucun appel réseau) 🔴

- [ ] `pnpm sim:preflight --manifest .war-room/experiment0/private/manifest.json --identity .war-room/experiment0/private/identity.json`
- [ ] La sortie se termine par **GO**. Chaque ligne `[FAIL]` est bloquante ; chaque `[warn]` est une décision assumée et écrite.
- [ ] **Le pire cas doit tenir sous le plafond** : sinon la vague s'arrête en route et le SoRV devient non publiable (RT-1).
      Tranché le 2026-09-20 : **plafond 70 $ par vague** pour un pire cas de 64,48 $. Vérifier que le manifeste gelé porte bien
      `"costCapUsd": 70` et que la ligne budget du pré-vol est `[ ok ]`.
- [ ] Crédit disponible chez **chaque** fournisseur avant de lancer : OpenAI ≈ 21 $, **Anthropic ≈ 36 $** (moteur + extracteur),
      Perplexity ≈ 8 $ pour cette seule vague. Un crédit épuisé en cours de vague la rend incomplète.
- [ ] Empreinte SHA-256 du manifeste, affichée par le pré-vol, recopiée dans `actions.log` : ______

### « GO API » 🔴

- [ ] Le founder écrit explicitement **« GO API »** (dans la session de la War Room et dans `TEAM_MEMORY.md`), avec la date et l'heure UTC. Aucun appel payant avant.

### Vague API 🔴

- [ ] Heure UTC du **premier tirage** notée : ______ (elle fixe l'échéance des 72 h).
- [ ] `pnpm sim:run --manifest .war-room/experiment0/manifest.json --identity .war-room/experiment0/identity.json --wave J0`
- [ ] Toute la vague tient dans une fenêtre de **48 h maximum** (au plus tard le 2026-09-30 à la même heure).
- [ ] Nombre de tirages obtenus : ______ / 780. Tout écart (erreurs, arrêt au plafond) est documenté.
- [ ] Coût réel relevé dans chaque console fournisseur : OpenAI ______ · Anthropic ______ · Perplexity ______ · total ≤ plafond.

### Échantillon manuel (calibration) 🔴

- [ ] Protocole complet : `PROTOCOLE_ECHANTILLON_MANUEL.md`. Résumé :
  - [ ] 10 JD cibles × formulation **P1** × ChatGPT, Claude, Perplexity, Gemini, Copilot = **50 saisies** (~2 h), dans la même fenêtre de 48 h.
  - [ ] Navigation privée, une nouvelle conversation par saisie, **déconnecté si l'app le permet**.
  - [ ] Une seule réponse lue, sans régénérer ni relancer.
  - [ ] On note seulement **oui/non + rang du client** dans `manual_sample.csv`.
  - [ ] **Aucune capture d'écran conservée**, aucun nom de tiers noté.
  - [ ] Partir du gabarit `templates/manual_sample.template.csv` (Excel accepté : séparateur `;`, `VRAI`/`FAUX`, guillemets).
  - [ ] **Contrôler le fichier avant de clore la journée** — il vaut mieux corriger à chaud que découvrir le problème en S2 :

        pnpm sim:check-manual --manual .war-room/experiment0/private/manual_sample.csv

    La commande refuse le fichier en indiquant la **ligne** fautive (rang manquant ou en trop, doublon JD × app, mélange de vagues,
    nombre de lignes) et résume la répartition par application.

### Captures d'indexation (E1), faites à la main 🔴

Rangées dans `experiment0/indexation/J0/`, nommées `AAAA-MM-JJ_outil.png`. Ce sont des captures de **nos propres données** uniquement.
- [ ] **Google Search Console** : pages indexées et performances de `ayoub-hammoudi.dev`.
- [ ] **Bing Webmaster Tools** : pages indexées et rapport « AI Performance » s'il est disponible.
- [ ] Si GSC ou Bing ne sont pas encore configurés : vérifier la propriété **sans soumettre de sitemap ni demander d'indexation** avant la fin de la vague.
  La soumission est l'action A3, datée dans `actions.log` après J0. Si c'est impossible, noter « non configuré » : E1 repose alors sur les requêtes `site:`.
- [ ] `site:ayoub-hammoudi.dev` saisi à la main sur **Brave Search**, puis sur Google et Bing : nombre de résultats noté, capture recadrée sur nos seuls résultats.
- [ ] Aucune capture ne montre de profil ou de nom de tiers (recadrer ou ne pas capturer).

### Test H0 🔴

- [ ] Les 40 cellules (10 JD cibles × 3 moteurs API + Gemini manuel) sont couvertes : API via `sim:extract`, Gemini via `manual_sample.csv` (code `h0=` dans les notes).

---

## J+1 → J+3 — du 2026-09-29 au 2026-10-01 : extraction, rapport, mémoire

### Extraction sous 72 h 🔴

- [ ] `pnpm sim:extract --wave J0 --identity .war-room/experiment0/identity.json` exécuté **avant l'échéance : heure du premier tirage + 72 h**
  (recommandation : dès la fin de la vague, le 2026-09-29).
- [ ] Contrôle manuel sur au moins 20 lignes tirées au hasard du fichier d'extraction : **aucun nom de tiers en clair** ; domaines hors liste blanche réduits à « autre » (REQ-M2-05).
- [ ] `pnpm sim:purge --wave J0` exécuté (ou purge automatique constatée) : aucune réponse brute pseudonymisée au-delà de 72 h.

### Rapport ⚪ (bloquant pour S2, pas pour J0)

- [ ] `pnpm sim:report --wave J0` → rapport Markdown : funnel E1-E5 par moteur, SoRV@5 avec IC, mix des sources, accord API/app.
- [ ] Les valeurs du rapport sont reprises telles quelles, sans arrondi flatteur ni interprétation ajoutée.

### Verdict H0 🔴 — au plus tard le 2026-10-04

- [ ] Règle H0 pré-enregistrée appliquée telle quelle.
- [ ] Si au moins 3 des 4 moteurs refusent de nommer des individus : **kill précoce** (EXPERIMENT_0 §6) → escalade au board.

### Entrée TEAM_MEMORY 🔴

- [ ] Ajouter une entrée datée (gabarit ci-dessous), sans aucun chiffre qui ne sorte pas du rapport ou des consoles.

```
- **2026-10-0X — [FOUNDER + Retrieval Scientist] J0 de l'expérience 0 exécuté.** Manifeste gelé le 2026-09-27 (SHA-256 : …).
  Vague J0 : … tirages sur 780 (écarts : …), fenêtre … → … UTC, coût réel … $ (plafond … $). Échantillon manuel : … lignes sur 50.
  Indexation E1 : GSC …, Bing …, site: Brave … Extraction faite le … (≤ 72 h), contrôle « aucun nom de tiers » : OK / KO.
  Verdict H0 : … (règle pré-enregistrée). Rapport : … Prochaine étape : actions A1 → A2 → A3 → A8 → A4 → A5 → A6 → A7, datées dans actions.log.
```

---

## Récapitulatif des échéances

| Date | Échéance | Bloquant |
|---|---|---|
| 2026-09-21 | Comptes API, plafonds, conditions et DPA, `.env` | 🔴 |
| 2026-09-26 | US-F00, constat du site, 13 JD collectées et nettoyées | 🔴 |
| 2026-09-27 | Décisions pré-enregistrées, gel du manifeste, dry-run, GO ou report | 🔴 |
| 2026-09-28 | « GO API », vague J0, échantillon manuel, captures d'indexation | 🔴 |
| Premier tirage + 72 h | Extraction et purge du brut | 🔴 |
| 2026-10-01 | Rapport J0 (J+3), entrée TEAM_MEMORY | ⚪ / 🔴 |
| 2026-10-04 | Verdict H0 consigné | 🔴 |
