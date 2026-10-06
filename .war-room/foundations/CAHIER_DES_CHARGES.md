# CAHIER DES CHARGES — Proofseen (nom de code ReferencementCracker)

> Version 1.0 · 2026-09-18 · Leads : Orchestrator + Architect · Relecture : Maxwell (veto technique), Victoria (veto produit).
> Références : `../ROADMAP.md` (planning), `../MEASUREMENT_SPEC.md` (mesure), `../ARCHITECTURE_V0.md`, `STRATEGIE.md`,
> `CONFORMITE.md`. En cas d'écart, `../TEAM_MEMORY.md` l'emporte. Glossaire en §12.

## 1. Contexte et objectifs

**Contexte.** Les recruteurs utilisent l'IA pour chercher des profils, soit en demandant des noms à un assistant doté d'une recherche web,
soit en lui faisant écrire des requêtes booléennes et X-ray (`STRATEGIE.md` §0). Les freelances ne savent pas s'ils sont trouvés.

**Objectifs du produit**

| # | Objectif | Indicateur |
|---|---|---|
| O1 | Mesurer la visibilité d'un professionnel face à des JD cibles, de façon statistiquement honnête | SoRV@5 avec IC 95 %, funnel E1-E5 |
| O2 | Expliquer pourquoi (sources citées, étage du funnel qui casse) | Carte des sources, diagnostic par étage |
| O3 | Permettre de corriger honnêtement | Plan d'actions, portfolio généré, conseils plateformes |
| O4 | Prouver l'évolution | Re-mesure et delta avec IC |
| O5 | Rester conforme et loyal | 0 nom de tiers persisté (audit mensuel sur échantillon), 100 % des clients scannés avant chaque vague, 0 client accepté malgré une détection, possession des URL vérifiée, AIPD faite |

## 2. Périmètre

| Version | Période (ROADMAP) | Inclus | Exclu |
|---|---|---|---|
| **V0 — Instrument + pré-vente** | S1-S5 (2026-09-21 → 11-29) | CLI `sim-run`, `sim-extract`, `sim-report` ; fichiers JSONL ; expérience 0 ; **pré-vente (US-P01) : page d'offre + Stripe Payment Links (audit 49 €, clé en main 490 €), CGV validées par un juriste, remboursement** | Toute interface produit, tout compte, tout abonnement |
| **V0.5 — Service** | S6-S10 (2026-11-30 → 2027-02-07), **après la gate** | Landing SSG, audit flash (exécution manuelle), Stripe Payment Links, rapport PDF, gabarit de portfolio, onboarding manuel, checklist anti-triche | Comptes utilisateurs, dashboard, automatisation |
| **V1 — SaaS** | S11-S14 (2027-02-08 → 04-04) | Comptes, dashboard, audit flash en libre-service, Stripe Billing, panel partagé, monitoring, alertes, espace B2B agrégé, scan anti-triche automatisé | Talent MCP, API partenaires, multilingue au-delà de FR/EN, app mobile |
| **Hors périmètre (toutes versions)** | — | — | Automatisation sur LinkedIn ou Malt ; scraping ; mesure du classement interne des plateformes ; classement de candidats pour recruteurs ; résultats individuels visibles par un employeur ; génération de contenu non vérifiable |

**Moteurs mesurés automatiquement** (`research/R5`, lu le 2026-09-18) : **OpenAI** (recherche web) et **Anthropic** (recherche web) :
compatibles sous conditions ; **Perplexity** via l'**Agent API** (`/v1/agent`, modèle `perplexity/sonar`, sans preset ; l'ancienne API Sonar
s'arrête le 2026-09-27 ; **jamais** l'API `/search`) : compatible, avec un risque sur la clause « competitive with Perplexity » (§2.5) —
vérifier que les API Terms couvrent bien l'Agent API. Les trois restent soumis aux confirmations listées dans `CONFORMITE.md` §5.
**Incompatibles** : Gemini API et Vertex AI grounding (analyse et monitoring interdits), Bing grounding (stockage et revente interdits).
**Gemini et Copilot** : mesurés par **échantillon manuel d'étalonnage interne uniquement**, jamais revendu dans un rapport client tant que les
conditions des apps grand public ne sont pas validées ; E1 approché par Google Search Console et Bing Webmaster (accès délégué du client).

## 3. Acteurs

| Acteur | Description | Versions |
|---|---|---|
| Visiteur | Personne non inscrite sur la landing | V0.5, V1 |
| Freelance (client B2C) | Professionnel qui mesure et améliore sa visibilité | V0.5, V1 |
| Consultant B2B | Freelance porté ou consultant ESN, inscrit **lui-même** via le lien de sa société | V1 |
| Admin B2B | Dirigeant ou RH de la société de portage/ESN ; voit **uniquement des agrégats** | V1 |
| Opérateur | Le founder ou l'équipe : exécute les audits en V0.5, supervise en V1 | V0-V1 |
| Système | Tâches planifiées : vagues, purge, alertes | V1 |

## 4. User stories et critères d'acceptation

> Format : **En tant que… je veux… afin de…** puis critères **Given / When / Then** testables. Priorité : P0 (indispensable à la version), P1, P2.

### 4.0 Pré-requis transverses (ajoutés après la revue adverse, cf. `REVUE.md`)

**US-P01 — Pré-vente (P0, V0)**
En tant que founder, je veux encaisser des pré-paiements conformes afin de passer la gate (3) du 2026-11-27.
- **Given** des CGV **validées par un juriste**, **When** un prospect reçoit un Payment Link (49 € ou 490 €), **Then** la page affiche le périmètre, la date de livraison maximale (2026-12-31), le droit de rétractation de 14 jours et la politique de remboursement intégral si la gate échoue.
- **Given** un paiement, **Then** il est journalisé (date, offre, montant) pour le décompte de la gate ; aucun lien n'est envoyé avant la validation des CGV.

**US-F00 — Preuve de possession des URL (P0, toutes versions)**
En tant qu'opérateur, je veux vérifier que les URL déclarées appartiennent au client afin de ne jamais mesurer un tiers.
- **Given** une URL de domaine déclarée, **When** le client ajoute un fichier, une balise meta ou un enregistrement TXT DNS contenant un jeton unique, **Then** l'URL passe à « vérifiée » après un contrôle réussi.
- **Given** une URL LinkedIn, Malt ou GitHub, **When** le client place le jeton dans un champ public de son profil (titre, résumé ou bio), **Then** l'opérateur vérifie **une fois, à la main**, par une visite normale sans automatisation, puis le client peut retirer le jeton.
- **Given** une identité sans aucune URL vérifiée, **Then** aucun appariement n'est calculé : le rapport ne montre que les domaines de plateforme cités (liste blanche, REQ-M3-03).
- **Given** des variantes de nom, **Then** elles doivent correspondre au nom affiché sur au moins une URL vérifiée.

### 4.1 Visiteur et freelance

**US-F01 — Audit flash (P0, V0.5 manuel / V1 libre-service)**
En tant que freelance, je veux coller une offre et mes liens de profil afin de savoir si les IA me trouvent.
- **Given** un visiteur, **When** il soumet 1 JD (**≤ 8 000 caractères**) et ses URL, **Then** rien n'est mis en file avant que son e-mail soit **vérifié** (lien magique) et qu'au moins une URL passe US-F00.
- **Given** une identité vérifiée, **Then** **1 seul audit flash** est autorisé par identité (et non par e-mail ou par IP).
- **Given** le **plafond de budget journalier** des audits flash atteint, **Then** la demande passe en liste d'attente avec une date estimée.
- **Given** une JD soumise, **Then** e-mails, téléphones, **noms de recruteurs** et URL sont retirés avant tout envoi (fixtures de test).
- **Given** une JD qui contient une variante du nom du client ou l'une de ses URL, **Then** elle est **rejetée** (anti-gonflement).
- **Given** un audit flash terminé (1 JD × 2 formulations × 3 moteurs × 3 tirages = 18 appels), **Then** le rapport montre **E2 à E5** par moteur (**E1 « non mesuré »** dans l'audit flash), les domaines de plateforme les plus cités et 3 actions ; **aucun nom ni domaine personnel de tiers**.

**US-F02 — Audit complet payant (P0)**
En tant que freelance, je veux un diagnostic complet sur 3 JD afin de savoir précisément quoi corriger.
- **Given** un paiement de 49 € confirmé par Stripe (webhook signé), **When** le client fournit 3 JD qui passent les contrôles d'US-F01, **Then** une vague complète de 3 × 4 × 3 × 5 = 180 appels (+ 1 JD témoin) est lancée et le rapport est livré sous 48 h en V0.5, sous 2 h en V1. Coût API estimé : **2,2 à 8,1 $** (MEASUREMENT_SPEC §10-ter, 3 moteurs).
- **Given** des JD fournies par le client, **Then** le rapport les étiquette « JD fournies par vous ». Les **case studies publiques et la north star business ne se calculent que sur des JD de marché**.
- **Given** un rapport complet, **Then** chaque métrique affiche son IC 95 %, le nombre de tirages, les versions des modèles et la date de mesure.
- **Given** un taux d'apparition à 0 %, **Then** le rapport affiche le Retrieval Rate et l'étage du funnel qui casse, jamais seulement « 0 ».

**US-F03 — Plan de correction (P0)**
En tant que freelance, je veux une liste d'actions priorisées afin d'agir sans expertise SEO.
- **Given** un rapport complet, **Then** le plan contient au plus 8 actions, chacune avec la couche (hub, satellite, preuve tierce, fraîcheur), l'effort estimé, la justification sourcée (renvoi à `RESEARCH_GROUND_TRUTH`) et le lieu où l'appliquer.
- **Given** une action concernant LinkedIn, Malt ou GitHub, **Then** elle est formulée comme une **suggestion que le freelance applique lui-même** ; aucun bouton ne publie à sa place.

**US-F04 — Portfolio généré (P0 V0.5 gabarit / P1 V1 générateur)**
En tant que freelance, je veux générer un site portfolio lisible par les IA à partir de mes vraies missions afin de disposer d'un hub citable.
- **Given** un profil complet (identité, missions avec faits déclarés), **When** le portfolio est généré, **Then** chaque page est en HTML statique dont le texte est présent **sans exécution de JavaScript** (test par requête HTTP brute).
- **Given** la génération, **Then** le robots.txt autorise Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, Claude-User et PerplexityBot, et un sitemap est produit.
- **Given** un fait chiffré saisi par le client, **When** il est publié, **Then** il porte l'attestation « déclaré par l'intéressé » dans les métadonnées internes, et le client a coché la case d'exactitude (non publiée en texte caché).
- **Given** une page publiée, **Then** le score Lighthouse Performance, SEO et Accessibilité est ≥ 95 en desktop **et** en mobile, **mesuré par l'opérateur** avant la livraison (pas de score déclaré sans mesure).
- **Given** un domaine du client, **Then** le portfolio est servi sur ce domaine ; à défaut, sur un sous-domaine de Proofseen, **indexé uniquement si le profil est « complet et vérifié »**, c'est-à-dire : au moins une URL vérifiée (US-F00), titre, stack, ville, disponibilité datée et au moins 2 missions avec attestation d'exactitude, scan anti-triche passé.

**US-F05 — Monitoring et alertes (P1 ; V0.5 « Pro fondateur » manuel, 20 abonnés maximum ; V1 automatisé)**
En tant qu'abonné Pro, je veux une re-mesure mensuelle et une alerte quand j'apparais afin de suivre mes progrès.
- **Given** un abonnement Pro actif, **When** le cycle mensuel arrive, **Then** une vague privée au **design fixe** (3 JD × 2 formulations × 3 moteurs × 3 tirages + 1 JD témoin × 2 × 3 × 3 = **72 appels**) est exécutée.
- **Given** deux vagues de monitoring, **Then** le delta avec IC est calculé **uniquement entre vagues de même design** ; un audit complet (4 formulations × 5 tirages) n'est jamais comparé directement à un monitoring.
- **Given** la JD témoin, **When** son **Retrieval Rate** varie de plus de 5 pts entre deux vagues, **Then** le rapport affiche « variation des moteurs : delta à interpréter avec prudence ».
- **Given** un tirage où le client est apparié « **certain** », **Then** une alerte e-mail est envoyée au plus 1 fois par semaine (regroupement).

**US-F07 — Clé en main (P0 V0.5, 10 par mois maximum)**
En tant que freelance, je veux qu'on prépare ma surface de profil afin de gagner du temps.
- **Given** une commande à 490 €, **Then** le livrable comprend : **le hub généré et publié sur son domaine** (US-F04), **les textes de réécriture** pour LinkedIn, Malt et GitHub (fichier), la liste des preuves tierces à obtenir, et une re-mesure à J+45.
- **Given** les plateformes tierces, **Then** **le client publie lui-même** ; l'opérateur ne se connecte **jamais** à ses comptes et ne reçoit **jamais** ses identifiants.

**US-F06 — Données et compte (P0, V1)**
En tant que freelance, je veux exporter et supprimer mes données afin d'exercer mes droits RGPD.
- **Given** une demande d'export, **Then** un fichier JSON avec identité, JD, métriques et rapports est disponible sous 72 h.
- **Given** une suppression de compte, **Then** toutes les données personnelles du client sont supprimées sous 30 jours, et les agrégats de panel restent anonymes.

### 4.2 B2B (portage, ESN)

**US-B01 — Invitation des consultants (P0, V1)**
En tant qu'admin B2B, je veux inviter mes consultants afin de leur offrir Proofseen.
- **Given** une licence active, **When** l'admin génère un lien d'invitation, **Then** le consultant crée **lui-même** son compte, vérifie une adresse e-mail **qui n'est pas du domaine de l'admin** ou vérifie une URL (US-F00), puis accepte les CGU ; l'admin ne peut ni saisir ni importer d'identité.
- **Given** des consultants inscrits, **Then** l'admin ne voit **qu'un compteur global** d'activés, mis à jour **une fois par mois** (instantané figé), jamais un statut individuel.

**US-B02 — Tableau de bord agrégé (P0, V1)**
En tant qu'admin B2B, je veux des indicateurs d'ensemble afin de mesurer la valeur de la licence.
- **Given** moins de **10** consultants activés dans l'instantané mensuel, **Then** aucune statistique autre que le compteur n'est affichée.
- **Given** au moins 10 activés, **Then** sont affichés, sur l'instantané mensuel : taux d'activation, part des consultants avec une visibilité mesurée **par tranches** (« moins de 25 % », « 25-50 % », « 50-75 % », « plus de 75 % » ; jamais 0 % ni 100 %), top **domaines de plateforme** (liste blanche) ; **aucune liste nominative, aucun classement, aucun filtre**.
- **Given** un changement entre deux instantanés qui concerne **moins de 10** personnes (arrivées + départs), **Then** les indicateurs du mois précédent restent affichés (pas de calcul par différence).
- **Given** une requête API de l'admin visant un consultant, un sous-groupe ou un filtre, **Then** elle est refusée (test d'autorisation).

**US-B03 — Désinscription libre (P0, V1)**
En tant que consultant, je veux quitter la licence sans prévenir mon employeur afin de garder le contrôle.
- **Given** un consultant inscrit, **When** il se désinscrit, **Then** ses données sont détachées de l'organisation ; le compteur de l'admin ne change qu'à l'instantané mensuel suivant, et selon la règle des 10 personnes.

### 4.3 Opérateur

**US-O01 — Scan anti-triche à l'onboarding (P0, V0.5 manuel / V1 automatisé)**
En tant qu'opérateur, je veux détecter les surfaces trompeuses d'un client afin de refuser la triche.
- **Given** les URL vérifiées du client **et les URL du client citées dans les tirages**, **When** le scan s'exécute (à l'onboarding **et avant chaque vague**), **Then** il inspecte : texte invisible (couleur du fond, `display:none`/`visibility:hidden`/`opacity:0` avec contenu, hors écran, taille < 2 px), **caractères invisibles** (zero-width, bloc Unicode Tags U+E0000–E007F), **commentaires HTML**, attributs `alt`/`aria-label`/`title`, balises meta, JSON-LD, `llms.txt`, et le texte des images via OCR (V1).
- **Given** ce contenu extrait, **Then** un classifieur (liste de motifs versionnée **+ juge LLM sans outils**, pour détecter les paraphrases) signale toute instruction adressée à une IA.
- **Given** le cloaking, **Then** le contenu est comparé entre un UA navigateur et un UA de bot, **et depuis une IP non attribuable à Proofseen**, à deux moments différents.
- **Given** une détection, **Then** l'onboarding (ou la vague) est bloqué avec un motif lisible ; le client peut corriger et relancer.
- **Given** un **corpus red-team tenu séparé**, rédigé par une personne qui n'a pas écrit le scan et renouvelé chaque trimestre, **Then** le taux de détection mesuré est publié en interne, avec un objectif de ≥ 95 % et moins de 5 % de faux positifs sur des pages saines. *(Ce n'est pas une garantie de détection exhaustive.)*

**US-O02 — Budget par vague (P0, V0)**
- **Given** un plafond de coût configuré, **When** le coût cumulé d'une vague l'atteint, **Then** la vague s'arrête net, l'état est journalisé et aucun appel supplémentaire n'est fait.

**US-O03 — Revue des appariements (P1)**
- **Given** des appariements « probables », **Then** 10 % d'entre eux (**20 au minimum, cumulés sur les vagues récentes**) sont revus à la main ; si la **borne basse de Wilson** de la précision est < 90 %, les appariements « probables » sont exclus des rapports clients jusqu'à correction (seuls les « certains » restent affichés).

## 5. Parcours clés

| Parcours | Étapes |
|---|---|
| **Inscription** (V1) | Landing → « Mesurer ma visibilité » → e-mail (lien magique) → identité (nom, variantes, URL possédées) → consentement CGU et confidentialité → scan anti-triche → tableau de bord vide avec CTA d'audit flash |
| **Audit flash** | JD + URL → file d'attente → e-mail « prêt » → rapport simplifié → CTA audit complet ou Pro |
| **Audit payant** | CTA → Stripe Checkout → webhook → saisie de 3 JD → vague → rapport complet + plan de correction |
| **Génération du portfolio** | Plan de correction → « Créer mon hub » → formulaire missions (faits déclarés + case d'exactitude) → aperçu → domaine du client (instructions DNS) ou sous-domaine → publication → soumission GSC et Bing guidée → check-list de vérification |
| **Monitoring** | Abonnement Pro → vague mensuelle → e-mail de synthèse (delta + IC) → alertes → re-priorisation du plan |
| **Tableau de bord Vivier** | Admin : licence → lien d'invitation → suivi des activations → agrégats mensuels (k ≥ 10) ; Consultant : inscription autonome → parcours freelance standard, résultats privés |

## 6. Exigences fonctionnelles par module

### M1 — Recruiter Simulator
- **REQ-M1-01** Formulations versionnées (P1-P4 figées + v2 issues des interviews), jamais modifiées en place.
- **REQ-M1-02** Un adaptateur par moteur, avec une interface commune `runDraw → {texte, citations, résultats de recherche, modèle, usage, coût}`.
- **REQ-M1-03** Enregistrement à chaque tirage de la version du modèle, de l'horodatage, du coût et de l'identifiant de formulation.
- **REQ-M1-04** Plafond de recherches par appel (`max_uses` ou équivalent) et plafond de coût par vague.
- **REQ-M1-05** Vague exécutée en ≤ 48 h ; JD témoins incluses dans toute vague de mesure avant/après.
- **REQ-M1-06** Panel partagé par cluster (V1), dont la fréquence dépend de la densité : mensuelle (< 20 clients), bimensuelle (20-100), hebdomadaire (> 100).
- **REQ-M1-10** Appels API avec **non-conservation côté fournisseur** quand l'option existe (ex. `store: false` chez OpenAI) ; ZDR demandée.
- **REQ-M1-07** Aucun moteur activé en production sans validation de ses conditions d'usage (checklist `CONFORMITE.md` §6).
- **REQ-M1-08** Le nom du client n'est **jamais** envoyé dans le prompt : le prompt ne contient que la JD nettoyée et la formulation.
- **REQ-M1-09 (V1.5, à instruire)** Simulateur de requêtes X-ray : le LLM génère la requête booléenne d'une JD, puis on vérifie si les URL du client ressortent. **Exécution directe via une API de recherche : bloquée à ce jour** (R5 : Brave Search API ambiguë, stockage et benchmark d'IA interdits ; Google Custom Search fermé aux nouveaux clients et arrêté le 2027-01-01 ; Bing grounding incompatible). **Piste à instruire** : faire exécuter la requête par l'outil de recherche web d'OpenAI ou d'Anthropic, dont les conditions sont compatibles, après validation par un juriste.
- **REQ-M1-11** Si un rapport **affiche** des résultats web issus d'un moteur, les citations sont visibles et cliquables, conformément aux exigences d'affichage d'OpenAI et d'Anthropic (R5). Par défaut, les rapports n'affichent que des agrégats de domaines de plateforme.

### M2 — Extraction et appariement
- **REQ-M2-01** Extraction structurée des candidats (nom, URL, rang) par un LLM **sans outils**, sortie validée par un schéma strict ; toute sortie invalide est rejetée et retentée 1 fois.
- **REQ-M2-02** Appariement **en mémoire, avant masquage** : déterministe par URL vérifiée d'abord (« certain »), puis nom + attribut concordant + juge LLM (« probable »).
- **REQ-M2-03** **Masquage des noms de tiers en mémoire, avant toute écriture**, y compris dans les sorties d'étapes de l'orchestrateur (Inngest) et dans les journaux. **Seules les variantes du nom du client sont exemptées.** Les réponses brutes ne sont stockées que **pseudonymisées** (jetons), chiffrées, **72 h maximum**.
- **REQ-M2-05** Domaines cités : seuls les **domaines de plateforme** d'une liste blanche versionnée (linkedin.com, github.com, malt.fr, codeur.com, dev.to, medium.com…) et les domaines vérifiés du client sont conservés. Tout autre domaine est enregistré sous la catégorie « domaine personnel / autre », sans sa valeur.
- **REQ-M2-04** Défense anti-injection : le contenu des réponses est traité comme une donnée ; le juge ne reçoit jamais d'instruction issue du contenu ; tests avec des fixtures d'injection.

### M3 — Rapports
- **REQ-M3-01** Funnel E1-E5 par moteur, SoRV@5 avec IC (Wilson par cellule, bootstrap par grappe sur les JD en agrégé, 2 000 itérations), carte des sources (domaines de plateforme), diagnostic par étage. **Seuls les appariements « certains » comptent** dans la north star business : un profil est « rendu visible » quand il a au moins 2 appariements certains sur au moins 2 JD de marché **et** que la borne basse de l'IC bootstrap de SoRV@5 est > 0.
- **REQ-M3-02** Mentions obligatoires : nombre de tirages, moteurs, versions, dates, « mesure d'une tendance, pas une garantie ».
- **REQ-M3-03** Aucun nom ni aucune URL de profil tiers dans un rapport.
- **REQ-M3-04** Export PDF (V0.5) et vue web (V1), accessibles (AA).

### M4 — Générateur de portfolio
- **REQ-M4-01** Sortie statique (SSG), sans JavaScript nécessaire à la lecture, FR/EN.
- **REQ-M4-02** Pages : accueil (titre, stack, ville, mode, disponibilité datée), une page par mission, contact.
- **REQ-M4-03** robots.txt et sitemap conformes à US-F04 ; JSON-LD `Person` en hygiène (non vendu comme levier).
- **REQ-M4-04** Interdits techniques : aucun texte masqué, aucune balise ou attribut contenant des instructions aux IA, aucune page générée par combinaison stack × ville.
- **REQ-M4-05** Budget de performance : ≤ 50 Ko de JS par page publique, CLS = 0, polices auto-hébergées sous-ensemblées.

### M5 — Conseils plateformes
- **REQ-M5-01** Réécritures proposées pour LinkedIn, Malt et GitHub, à partir des faits déclarés et du vocabulaire des JD.
- **REQ-M5-02** Refus de générer une compétence absente du profil déclaré (test : JD exigeant X, profil sans X → aucune suggestion ne contient X).
- **REQ-M5-03** Aucune connexion aux comptes du client sur ces plateformes, aucune publication automatique.

### M6 — Facturation
- **REQ-M6-01** V0.5 : Stripe Payment Links. V1 : Stripe Checkout + Billing (mensuel et annuel), factures conformes.
- **REQ-M6-02** Webhooks signés, idempotents ; aucun service livré sans paiement confirmé.
- **REQ-M6-03** Rétractation de 14 jours proposée à tous (`CONFORMITE.md`) ; remboursement intégral des pré-ventes si la gate échoue.

### M7 — Espace B2B
- **REQ-M7-01** Organisation, licence, lien d'invitation, compteur d'activés.
- **REQ-M7-02** Agrégats seulement, **k ≥ 10, instantané mensuel figé, proportions par tranches, pas de calcul par différence** sous 10 changements, aucun endpoint individuel ni filtre côté admin (tests d'autorisation) ; contrat de licence interdisant toute exploitation individuelle (AI Act, CONFORMITE §6).
- **REQ-M7-03** Désinscription autonome du consultant.

### M8 — Onboarding et scan anti-triche
- Voir US-O01. Liste de motifs versionnée ; re-scan à chaque vague (un client peut tricher après l'onboarding).

### M9 — Exploitation
- **REQ-M9-01** Purge automatique et journalisée (réponses brutes à 72 h, comptes supprimés à 30 j).
- **REQ-M9-02** Tableau de bord interne des coûts par moteur, par vague et par client.

## 7. Modèle de données conceptuel

| Entité | Attributs principaux | Relations |
|---|---|---|
| **Account** | e-mail, rôle (freelance / consultant / admin B2B / opérateur), consentements datés | 1–1 Identity (freelance/consultant) ; N–1 Organisation (optionnel) |
| **Identity** | nom et variantes, ville, stack déclarée | 1–N OwnedUrl ; 1–N Mission ; 1–N Match |
| **OwnedUrl** | URL, méthode de preuve (fichier, meta, TXT DNS, jeton sur le profil), statut, date de vérification | N–1 Identity |
| **Mission** | intitulé, client (optionnel), faits déclarés, attestation d'exactitude | N–1 Identity |
| **Organisation** | type (portage/ESN), licence, palier | 1–N Account (consultants) ; 1–N Invitation |
| **JobDescription** | texte nettoyé, langue, source (client / marché), privé ou panel | N–1 Cluster |
| **Cluster** | rôle × stack × séniorité × lieu × mode × langue | 1–N JobDescription ; 1–N Wave |
| **PromptTemplate** | id, version, texte, langue | — |
| **Wave** | type (audit, monitoring, panel, expérience), moteurs, n, plafond, statut, coût | 1–N Draw |
| **Draw** | moteur, version du modèle, formulation, horodatage, coût, hash de la réponse, domaines cités **(liste blanche + catégorie « autre », REQ-M2-05)** | N–1 Wave ; 0–N Match |
| **RawResponse** (pseudonymisée) | contenu chiffré avec jetons, date de purge (≤ 72 h) | 1–1 Draw |
| **Match** | client, type (certain/probable), rang, URL du client citée, revue manuelle | N–1 Draw ; N–1 Identity |
| **Report** | métriques, IC, diagnostic, plan d'actions, version | N–1 Identity ; N–N Wave |
| **Portfolio** | domaine, statut de publication, dernière mesure de perf | 1–1 Identity |
| **ScanResult** | date, motifs détectés, verdict | N–1 Identity |
| **Payment / Subscription** | offre, statut Stripe, dates | N–1 Account ou Organisation |

**Jamais stockés** : noms, URL ou domaines personnels de tiers ; contacts de recruteurs ; réponses brutes non pseudonymisées ; captures d'écran non caviardées (l'échantillon manuel ne consigne qu'un oui/non et le rang du client).

## 8. Exigences non fonctionnelles

| Domaine | Exigence | Vérification |
|---|---|---|
| **Performance (Elias)** | Toutes les pages publiques (landing, portfolios, pages légales) : Lighthouse Performance, SEO et Accessibilité ≥ 95 en **desktop ET mobile** (mesure de laboratoire) ; LCP < 2,5 s, TBT < 200 ms, CLS < 0,1 en laboratoire ; **données terrain (INP p75 via CrUX) suivies dès qu'elles existent**, sans être bloquantes | Mesure par l'opérateur avant chaque mise en production ; Lighthouse CI en V1 ; **aucun score déclaré sans mesure** |
| Discoverability | Pages publiques en SSG, texte visible sans JS, robots.txt et sitemap conformes | Requête HTTP brute en CI |
| **Sécurité** | OWASP Top 10 ; secrets en variables d'environnement, vérifiés au démarrage ; limitation de débit sur tous les endpoints publics ; webhooks signés ; autorisation testée (B2B) ; anti-injection M2-04 ; dépendances auditées | Revue Security Sentinel avant chaque version ; tests d'autorisation et d'injection |
| **RGPD** | Masquage avant persistance (y compris orchestrateur et journaux) ; brut pseudonymisé ≤ 72 h ; purge journalisée ; export et suppression (données supprimées ≤ 30 j après la demande, **sauvegardes purgées par rotation ≤ 35 j**, pièces comptables conservées 10 ans) ; AIPD avant la production V1 ; DPA signés | Tests de purge ; registre ; `CONFORMITE.md` |
| Accessibilité | WCAG 2.2 AA (contrastes vérifiés dans `MARQUE.md`, navigation clavier, focus visible) | Audit axe + test manuel |
| Observabilité | Journaux structurés sans donnée personnelle ; suivi des coûts API ; alerte sur échec de vague ou de purge | Tableau de bord interne |
| Coûts | Plafond par vague ; coût par audit complet ≤ 36 $ ; alerte à 80 % du budget mensuel | Relevé par vague |
| Qualité | Couverture ≥ 80 % sur `stats`, `extract` et les règles d'autorisation ; E2E des parcours P0 | CI |
| Disponibilité | V1 : 99 % mensuel (HYPOTHÈSE, pas de SLA contractuel avant M12) | Monitoring |

## 9. Intégrations

| Service | Usage | Version | Condition |
|---|---|---|---|
| OpenAI API (recherche web) | Mesure | V0 | DPA ; `store: false` ; compatible sous conditions (R5) |
| Anthropic API (recherche web) | Mesure + extraction (modèle sans outils) | V0 | DPA ; compatible sous conditions ; **confirmer par écrit que le monitoring n'est pas une « resale »** (R5) |
| Perplexity Sonar API (chat) | Mesure | V0 | Compatible ; clause §2.5 « competitive » à faire valider ; **ne pas utiliser `/search`** (R5) |
| Gemini API, Vertex AI, Bing grounding | **Aucune mesure** ; Gemini non-grounded payant possible pour l'extraction | — | Incompatibles pour notre usage (R5) |
| Google Search Console, Bing Webmaster Tools | Étage E1, citations Copilot (audit complet et Pro seulement ; E1 « non mesuré » dans l'audit flash) | V0 (manuel), V1 (guidé) | **Accès en tant qu'utilisateur délégué, en lecture seule, ajouté par le client ; jamais d'identifiants** |
| Stripe | Paiements | V0.5, V1 | — |
| Resend | E-mails | V1 | DPA |
| Clerk | Authentification | V1 | DPA |
| Neon, Inngest, Vercel | Infrastructure | V1 | DPA ; région UE si disponible |

## 10. Planning (aligné sur `ROADMAP.md`)

| Période | Livrable du cahier des charges |
|---|---|
| S1-S5 (P0) | V0 : M1 (sans panel), M2, M3 (rapport Markdown) ; US-O02 |
| S6-S10 (P1) | V0.5 : landing, US-F01 (manuel), US-F02, US-F03, US-F04 (gabarit), US-O01 (manuel), M6 Payment Links |
| S11-S14 (P2) | V1 : comptes, US-F01 libre-service, US-F05, US-F06, US-B01-B03, M1 panel, M6 Billing, M7, M8 automatisé |
| M7+ | REQ-M1-09 (X-ray) si validé ; générateur de portfolio complet ; offre ESN après AIPD |

## 11. Risques du projet (spécifiques au cahier des charges)

| Risque | Parade |
|---|---|
| Conditions des outils de recherche incompatibles (comme Gemini) | REQ-M1-07 ; échantillons manuels ; X-ray via API autorisée (R5) |
| Qualité du masquage NER (un nom de tiers stocké par erreur) | Masquage en mémoire + pseudonymisation + tests sur un corpus de noms FR/EN ; audit mensuel |
| Faux positifs du scan anti-triche | Seuils calibrés sur fixtures ; recours manuel |
| Périmètre V1 trop large pour 8 semaines | Découpage P0/P1/P2 des US ; les US P1 peuvent glisser à M7 |
| Écart entre les résultats API et ceux des apps | Calibration à chaque vague ; bascule sur des modèles supérieurs |

## 12. Glossaire (lecteur non technique)

| Terme | Signification |
|---|---|
| **JD** | *Job description* : l'offre de mission |
| **LLM** | Modèle de langage : ChatGPT, Claude, Perplexity, Gemini |
| **Moteur** | Un LLM avec sa recherche web |
| **Tirage** | Une question posée une fois à un moteur. On en fait plusieurs, car les réponses varient. |
| **Vague** | L'ensemble des tirages d'une mesure |
| **Funnel E1-E5** | Les 5 étapes pour être trouvé : indexé → récupéré → nommé → dans le top 5 → cité comme source |
| **SoRV@5** | Probabilité d'apparaître dans les 5 premiers profils proposés |
| **IC 95 %** | Intervalle de confiance : la fourchette dans laquelle se situe probablement la vraie valeur |
| **Cluster** | Famille d'offres similaires (même rôle, stack, ville…) |
| **Panel partagé** | Mesures d'un cluster mutualisées entre tous les clients concernés |
| **Hub / surface de profil** | Le site du freelance et ses profils (LinkedIn, GitHub, Malt), cohérents entre eux |
| **SSG / HTML statique** | Pages pré-générées, lisibles sans exécuter de code : c'est ce que lisent les robots des IA |
| **Requête X-ray / booléenne** | Recherche Google du type `site:linkedin.com/in "React" "Paris"`, souvent écrite par un LLM pour le recruteur |
| **Masquage NER** | Détection et effacement automatique des noms de personnes |
| **k-anonymat (k ≥ 10)** | On n'affiche une statistique que si elle porte sur au moins 10 personnes |
| **AIPD** | Analyse d'impact RGPD obligatoire pour les traitements à risque |
| **Gate** | Point de décision go / no-go aux seuils fixés à l'avance |
