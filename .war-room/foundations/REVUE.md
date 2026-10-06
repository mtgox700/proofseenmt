# REVUE CROISÉE ADVERSE — Dossier de fondation (2026-09-18)

> Relecteur indépendant (sous-agent sans rôle d'auteur) cumulant les rôles de **Scenario Hunter**, **Security Sentinel** et **QA Guardian**.
> 19 constats : 6 critiques, 6 hauts, 5 moyens, 2 bas. **Tous traités.** Aucun n'a été rejeté.
> Un constat a été **complété par R5** (conditions des outils de recherche), qui a été livré après la revue.

| # | Gravité | Constat | Correction | Fichier(s) |
|---|---|---|---|---|
| 1 | CRITIQUE | Rien ne prouvait la **possession des URL** : on pouvait mesurer un tiers | **US-F00** (fichier, meta, TXT DNS ; jeton public sur LinkedIn, Malt ou GitHub vérifié une fois à la main) ; aucun appariement sans URL vérifiée ; entité `OwnedUrl` | CAHIER §4.0, §7 ; CONFORMITE T1 ; MEASUREMENT_SPEC (correction 8) ; EXPERIMENT_0 |
| 2 | CRITIQUE | **Durées de conservation contradictoires** (7 j contre 72 h ; 1 040 appels contre 780 ; 4 moteurs contre 3) dans TEAM_MEMORY, ROADMAP et ARCHITECTURE | Entrée datée dans TEAM_MEMORY (règle ROADMAP §0) + bloc de corrections en tête de ROADMAP, ARCHITECTURE, MEASUREMENT_SPEC et EXPERIMENT_0 | TEAM_MEMORY ; ROADMAP ; ARCHITECTURE_V0 ; MEASUREMENT_SPEC ; EXPERIMENT_0 |
| 3 | CRITIQUE | **R5 absent** alors que REQ-M1-07 bloque tout moteur | R5 livré : OpenAI, Anthropic et Perplexity Sonar compatibles sous conditions ; Gemini, Vertex AI et Bing incompatibles. Décision Maxwell : J0 à 3 moteurs, après acceptation des conditions et DPA ; confirmations écrites exigées avant le 1er rapport vendu | CONFORMITE §5 ; CAHIER §2, §9 ; ROADMAP |
| 4 | CRITIQUE | **Paiement exclu de V0** alors que la gate (3) exige 10 pré-paiements | **US-P01 Pré-vente** ajoutée à V0 (Payment Links, CGV validées par un juriste, remboursement) | CAHIER §2, §4.0 ; ROADMAP |
| 5 | CRITIQUE | **Ré-identification B2B** malgré k ≥ 5 (statut individuel, différences, 0 %/100 %, domaines personnels, faux comptes) | Compteur global seul ; **k ≥ 10** ; instantané mensuel figé ; pas de calcul par différence sous 10 changements ; proportions par tranches ; domaines de plateforme seulement ; e-mail hors domaine de l'admin ou URL vérifiée | CAHIER US-B01-B03, REQ-M7-02 ; STRATEGIE §5 |
| 6 | CRITIQUE | **Noms de tiers persistés** par d'autres voies (domaines personnels, captures, `store=true`, sorties Inngest) | Liste blanche de domaines (REQ-M2-05) ; masquage aussi dans l'orchestrateur et les journaux ; `store: false` (REQ-M1-10) ; échantillon manuel en oui/non sans capture ; charte §5 reformulée | CAHIER ; CONFORMITE T5, T10 ; MARQUE §8 ; EXPERIMENT_0 |
| 7 | HAUTE | **Gonflement de la mesure** par des JD fournies par le client | Rejet des JD qui contiennent l'identité du client ; étiquette « JD fournies par vous » ; north star et case studies sur des **JD de marché seulement** | CAHIER US-F01, US-F02, REQ-M3-01 ; MEASUREMENT_SPEC (correction 5) |
| 8 | HAUTE | **Scan anti-triche** incomplet (commentaires, attributs, caractères invisibles, cloaking par IP, paraphrases) ; critère circulaire | Surface d'inspection élargie ; juge LLM contre les paraphrases ; comparaison IP et temporelle ; **corpus red-team séparé** ; objectif ≥ 95 % sans prétention d'exhaustivité ; charte §8 reformulée (« où nous détectons ») | CAHIER US-O01 ; MARQUE §8 |
| 9 | HAUTE | **Abus de l'audit flash** (file avant vérification, contournement par IP, JD longues, 2 000 audits manuels) | E-mail vérifié avant la file ; 1 audit flash par identité vérifiée ; JD ≤ 8 000 caractères ; plafond de budget journalier ; ≤ 100 audits flash/mois en V0.5 | CAHIER US-F01 ; STRATEGIE §5, §6 |
| 10 | HAUTE | **E1** promis dans l'audit flash, mais impossible sans GSC (et `site:` automatisé = scraping) | E1 « non mesuré » dans l'audit flash ; GSC et Bing par accès délégué dans l'audit complet | CAHIER US-F01, §9 |
| 11 | HAUTE | **Clé en main** en conflit avec REQ-M5-03 et les CGU LinkedIn | **US-F07** : hub + textes livrés ; le client publie lui-même ; jamais d'identifiants | CAHIER US-F07 ; STRATEGIE §5 |
| 12 | HAUTE | **Chiffres faux** (coût d'audit ≤ 30-36 $, « 1 % d'un TJM », Pro vendu sans re-mesure) | 2,2-8,1 $ ; ~9 % d'une journée de TJM ; « Pro fondateur » avec re-mesure manuelle (20 abonnés maximum) jusqu'à S13 | STRATEGIE §5 ; CAHIER US-F02, US-F05 ; ROADMAP |
| 13 | MOYENNE | **Critères non testables** (O5, p75 sans trafic, « complet et vérifié », comparabilité US-F05, US-O03, REQ-M1-06, north star à 1 succès) | O5 reformulé ; laboratoire + terrain non bloquant ; définition de « complet et vérifié » ; design fixe + JD témoin + delta entre vagues de même design ; ≥ 20 cas + borne de Wilson ; palier 20-100 ; appariements certains seulement | CAHIER §1, §8, US-F04, US-F05, US-O03, REQ-M1-06, REQ-M3-01 |
| 14 | MOYENNE | **Rétention contradictoire** ; nom du recruteur non retiré ; REQ-M2-02/03 inapplicable | Durées harmonisées (contrat, puis 30 j ; sauvegardes 35 j ; comptables 10 ans) ; noms de recruteurs retirés ; appariement **en mémoire avant masquage**, variantes du client exemptées | CAHIER US-F01, REQ-M2-02/03, §8 ; CONFORMITE T1 ; MEASUREMENT_SPEC (correction 7) |
| 15 | MOYENNE | **Marketing** : « nous posons à ChatGPT… », « méthode publiée » (pas encore), tagline Citabilis non sourcée, « Soyez vu », post sans variante d'échec ni témoins | Hero reformulé (API, formulations de recruteur, avertissement API/app, lien de méthode à publier avant la mise en ligne) ; taglines corrigées ; 3 variantes de post SUCCÈS / AMBIGU / ÉCHEC avec témoins | MARQUE §4, §7 ; EXPERIMENT_0 |
| 16 | MOYENNE | Échantillons manuels Gemini/Copilot pour des rapports payants, sans conditions lues | **Étalonnage interne seulement**, jamais revendu avant validation | CONFORMITE §5, T10 ; CAHIER §2 |
| 17 | MOYENNE | GSC/Bing « accès fourni par le client » | Utilisateur délégué en lecture seule, jamais d'identifiants | CAHIER §9 |
| 18 | BASSE | Mode sombre forcé vide ; tokens de focus, désactivé et graphiques manquants | Bloc sombre complet ; tokens ajoutés ; contrastes de focus et de séries vérifiés (≥ 3:1) | MARQUE §6 |
| 19 | BASSE | Base légale des interviews non tranchée | **Consentement écrit** avant l'entretien | CONFORMITE T7 ; ROADMAP (S1) |

## Constats restant ouverts (hors pouvoir du board)

| Sujet | Qui tranche | Échéance |
|---|---|---|
| Validation juridique (12 points de CONFORMITE §8 + conditions R5) | Juriste humain | Avant le 1er encaissement (2026-10-18, ROADMAP) |
| Confirmations écrites d'Anthropic (§D.4) et de Perplexity (§2.5) | Fournisseurs | Avant le 1er rapport vendu |
| Antériorités de marque (INPI/USPTO non interrogeables par script) | Conseil en propriété industrielle | Avant le dépôt (S4) |
| Nom, grille tarifaire, direction visuelle | **Founder** | Cette session |
