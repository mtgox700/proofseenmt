# CONFORMITÉ — Dossier de fondation (Legal & Trust, lead · 2026-09-18)

> ⚠ **Ce document n'est pas un avis juridique.** C'est un dossier préparatoire à faire valider par un juriste humain (§8)
> **avant le premier encaissement** (ROADMAP S2-S3). Sources détaillées : `research/R3_CONFORMITE.md` (RGPD, AI Act,
> DPA, CGU, droit de la consommation) et `research/R5_CONDITIONS_OUTILS_RECHERCHE.md` (conditions des outils de recherche).
> Niveaux : [Confirmé] texte lu · [Probable] interprétation argumentée · [Incertain] à trancher.
>
> **AJOUT du 2026-09-20 — publication de pages profil sur proofseen.com** (`PIVOT_ANONYME.md` §6). Avant toute mise en ligne :
> (1) **consentement explicite et révocable** du freelance + notice art. 13 ; (2) **AIPD** documentée (profilage, grande échelle) ;
> (3) **test de ré-identification** (k-anonymat) sur la combinaison stack + ville + séniorité + secteur + ex-clients + TJM —
> interdits : nom de client, école, dates exactes ; (4) **dépublication sous 72 h** en cas de retrait du consentement, avec
> avertissement écrit que **l'indexation par les LLM est irréversible** ; (5) **aucun scoring ni classement automatique en V1** —
> l'annexe III point 4 de l'AI Act couvre explicitement l'« accès à l'emploi **indépendant** » (haut risque reporté au 2027-12-02,
> règlement omnibus (UE) 2026/1744) ; (6) identité révélée **avant tout engagement** (art. 1112-1 C. civ.) ; (7) clause de
> non-contournement plafonnée au **manque à gagner** (clause pénale révisable, art. 1231-5 C. civ.).
> Le pseudonyme **reste une donnée personnelle pour nous** (EDPB *Guidelines 01/2025* ; CJUE C-413/23 P du 2025-09-04).

## 1. Synthèse des positions

| Sujet | Position de travail | Risque |
|---|---|---|
| RGPD — client | Base légale : contrat. Nous sommes responsable de traitement. | Faible |
| RGPD — tiers cités par les LLM | Intérêt légitime + **masquage avant toute persistance** (correction du design initial) + notice publique | Moyen |
| AIPD | **À réaliser avant la production V1** (au moins 2 critères CEPD, liste CNIL « RH » et « profilage à partir de sources externes ») | Moyen |
| B2B | Le consultant s'inscrit lui-même ; ses résultats lui sont réservés ; l'entreprise ne voit que des agrégats mensuels (k ≥ 10, US-B02) | **Élevé si mal conçu** |
| AI Act | Usage côté candidat **hors Annexe III 4(a)** [Probable, fondé sur un **projet** de lignes directrices du 19/05/2026] ; obligations haut risque reportées au 02/12/2027 (Règl. (UE) 2026/1744) ; art. 50 applicable depuis le 02/08/2026 | Faible (B2C) / **moyen à élevé (B2B ESN)** |
| Gemini, Vertex AI et Bing grounding | **Incompatibles** : analyse, monitoring ou stockage interdits (R5) | Bloquant → **exclus de la mesure** ; Gemini et Copilot seulement en étalonnage manuel interne |
| OpenAI, Anthropic, Perplexity Sonar | Compatibles sous conditions (R5, §5) | Moyen (confirmations écrites à obtenir) |
| CGU plateformes | On conseille, le freelance applique ; aucune automatisation, aucun scraping | Faible |
| Droit de la consommation | Le freelance agit a priori en professionnel, mais **rétractation de 14 jours appliquée à tous** par choix | Faible |

## 2. Registre des traitements (projet)

| # | Traitement | Personnes | Rôle | Base légale | Données | Conservation |
|---|---|---|---|---|---|---|
| T1 | Gestion du compte et de la relation client | Clients (freelances, consultants, admins B2B) | RT | Contrat 6(1)(b) | Identité, **URL vérifiées (preuve de possession)**, e-mail, consentements, facturation | Durée du contrat, puis suppression ≤ 30 j (sauvegardes ≤ 35 j) ; e-mail de prospection : 3 ans après le dernier contact si opt-in ; pièces comptables : 10 ans |
| T2 | Construction et envoi des prompts aux LLM | Client (indirectement), recruteurs nommés dans une JD | RT ; fournisseurs = sous-traitants | 6(1)(b) ; 6(1)(f) pour les résidus | JD nettoyée des contacts ; **aucun nom de client dans le prompt** | Durée du contrat |
| T3 | Réception des réponses contenant des noms de tiers | Tiers (autres professionnels) | RT | Intérêt légitime 6(1)(f) | **Masquage en mémoire avant écriture** ; brut **pseudonymisé** (jetons), chiffré ; **la table jeton ↔ nom n'est jamais conservée** (elle n'existe qu'en mémoire le temps du masquage d'une réponse : `packages/extract/src/mask.ts`) | **72 h maximum** |
| T4 | Détection du client, score, recommandations (profilage art. 4(4), sans décision au sens de l'art. 22) | Client | RT | 6(1)(b) | Matches, métriques, rapports | Durée du contrat |
| T5 | Métriques agrégées (domaines cités) | Aucune : **seuls les domaines de plateforme** (liste blanche) sont gardés ; les domaines personnels de tiers sont réduits à la catégorie « autre » | RT | 6(1)(f) | Domaines de plateforme, fréquences | Illimitée (anonymes) |
| T6 | Inscription de consultants via une licence B2B | Consultants | RT vis-à-vis du consultant (scénario B, R3 §1.5) ; l'entreprise n'est que payeuse | Contrat avec le consultant | Idem T1-T4 ; l'entreprise ne reçoit que des agrégats | Idem |
| T7 | Interviews de recruteurs (expérience 0) | Recruteurs interrogés | RT | **Consentement** (recueilli par écrit avant l'entretien : finalité, durée, droit de retrait) | Notes **pseudonymisées**, prompts anonymisés ; aucun enregistrement audio sans accord séparé | 12 mois |
| T10 | Échantillon manuel d'étalonnage (apps grand public) | Tiers affichés à l'écran | RT | 6(1)(f) | **Uniquement oui/non et rang du client** ; aucune capture non caviardée conservée | Durée de l'expérience |
| T8 | Scan anti-triche des surfaces du client | Client | RT | 6(1)(b) + 6(1)(f) (prévention de la fraude) | URL, motifs détectés, verdict | Durée du contrat |
| T9 | Pré-vente et facturation | Clients | RT | Contrat + obligation légale | Paiements (via Stripe) | 10 ans (comptable) |

## 3. Analyse d'impact simplifiée (pré-AIPD)

| Risque pour les personnes | Vraisemblance | Gravité | Mesures |
|---|---|---|---|
| Stockage involontaire de noms de tiers | Moyenne (erreur de NER) | Moyenne | Masquage en mémoire ; pseudonymisation ; purge à 72 h ; tests sur corpus de noms FR/EN ; audit mensuel |
| Informations fausses sur des tiers (hallucinations) diffusées par nous | Faible | Élevée (diffamation) | Aucun affichage d'information sur des tiers ; rapports en domaines seulement |
| Employeur qui exploite les résultats d'un consultant (classement, décision) | Moyenne sans garde-fou | Élevée (AI Act, RGPD) | Scénario B ; agrégats k ≥ 10 ; aucun endpoint individuel ; clause contractuelle d'interdiction |
| Client qui trompe les recruteurs (faux profil) | Moyenne | Moyenne | Scan anti-triche ; clause de véracité ; refus de générer des compétences absentes |
| Fuite de données clients | Faible | Moyenne | Chiffrement, secrets, limitation de débit, revue de sécurité |
| Transferts hors UE | Certaine (fournisseurs US) | Moyenne | CCT en base (pas seulement le DPF, pourvoi C-703/25 P pendant), TIA, résidence UE quand elle est disponible |

→ **L'AIPD complète est à rédiger avant la production V1** (ROADMAP S10-S11), ainsi que la note de mise en balance de l'intérêt légitime et la note de classification AI Act.

## 4. DPA à signer ou accepter

| Fournisseur | DPA | Actions |
|---|---|---|
| OpenAI | https://openai.com/policies/data-processing-addendum/ | Accepter ; demander la ZDR ; étudier la résidence UE |
| Anthropic | https://www.anthropic.com/legal/data-processing-addendum | Accepter ; **clarifier la rétention par défaut** (sources contradictoires : 30 j ou aucune) ; demander la ZDR |
| Perplexity | Trust Center (non lu) | **Obtenir et lire le DPA et les CGU API avant tout usage** |
| Google (Gemini, payant uniquement) | https://business.safety.google/processorterms/ | Seulement si usage non-grounded (extraction) ; **Gemini gratuit interdit** |
| Stripe, Resend, Clerk, Neon, Inngest, Vercel | DPA standard de chacun | À signer avant la V1 ; région UE quand elle existe |

## 5. Conditions d'usage des outils de recherche (R5)

→ Voir `research/R5_CONDITIONS_OUTILS_RECHERCHE.md` (lu le 2026-09-18). **Règle produit (REQ-M1-07)** : aucun moteur n'est activé, **y compris pour
l'expérience 0**, tant que ses conditions n'ont pas été lues et jugées compatibles avec l'analyse automatisée de ses réponses.

| Outil | Verdict (R5) | Condition avant usage |
|---|---|---|
| OpenAI (recherche web, Responses API) | **Compatible sous conditions** : le client est propriétaire de l'Output ; citations visibles et cliquables **si** des résultats web sont affichés | Index sous-jacent et conditions tierces (§3.4) à clarifier |
| Anthropic (recherche web / fetch) | **Compatible sous conditions** : le client est propriétaire de ses Outputs ; affichage des citations, sinon consultation juridique | **Confirmation écrite qu'un service de monitoring n'est pas une « resale » (§D.4)** |
| Perplexity Sonar (chat) | **Compatible** : le client est propriétaire de l'Output | Portée de la clause §2.5 « competitive with Perplexity » ; **exclure l'API `/search`** (Output non possédé, données réutilisées) |
| Gemini API grounding / Vertex AI grounding | **Incompatible** : analyse, monitoring et collecte des liens interdits [Confirmé] | Seulement avec un accord commercial dérogatoire |
| Bing grounding (Azure Foundry) | **Incompatible** : réservé aux expériences de recherche ; stockage et revente interdits | Exception « work product » à faire trancher |
| Brave Search API | **Ambigu** : stockage, base de données, œuvres dérivées, revente et benchmark de services d'IA interdits | Plan « storage rights » avec usage déclaré par écrit |
| Google Custom Search JSON API | **Indisponible** : fermé aux nouveaux clients, arrêt le 2027-01-01 | — |
| Apps grand public (Gemini, Copilot, ChatGPT…), échantillon manuel | **Non évalué** pour un usage commercial | Usage limité à l'**étalonnage interne** ; jamais vendu dans un rapport avant validation |

**Décision Maxwell (2026-09-18)** : V0 = OpenAI + Anthropic + Perplexity Sonar. J0 (2026-09-28) peut se tenir avec ces 3 moteurs,
**à condition que le founder ait accepté les conditions et DPA en vigueur**. Les confirmations écrites (Anthropic §D.4, Perplexity §2.5) sont
demandées en S1, et **exigées avant le premier rapport vendu**, pas avant l'expérience 0, qui est interne et non commerciale.

## 6. AI Act : position argumentée

1. **Qualification** : nous sommes « fournisseur » d'un système d'IA bâti sur des modèles GPAI tiers [Probable].
2. **Annexe III, point 4(a)** vise les systèmes destinés au recrutement ou à la sélection, notamment pour **évaluer des candidats** [Confirmé].
   Notre système est **destiné au candidat**, qui reste seul destinataire de ses résultats. Le projet de lignes directrices de la Commission
   (19/05/2026, non définitif) exclut les outils d'aide au candidat dont les résultats lui sont réservés [Probable].
3. **Risque de bascule** : usage B2B où une ESN comparerait ses consultants pour choisir qui placer, ce qui tomberait sous 4(a) ou 4(b).
   Comme notre score est un profilage, la dérogation de l'art. 6(3) ne serait **pas** disponible. → **Garde-fous par design** (agrégats, aucune
   vue individuelle, clause contractuelle) + **note de classification** interne sur le modèle de l'art. 6(4).
4. **Art. 50** (depuis le 02/08/2026) : mentionner que les suggestions de réécriture sont générées par IA (exception « édition standard » à trancher par le juriste).
5. **Art. 4 (maîtrise de l'IA)** : politique interne courte pour l'équipe.
6. **Politiques des fournisseurs** : Anthropic classe les outils d'embauche en usage à haut risque et OpenAI interdit l'automatisation des décisions
   à fort enjeu sans revue humaine. Notre usage (mesure côté candidat, sans décision) semble hors champ [Probable] ; nous le **documentons**.

## 7. Règles de conseil sur les plateformes

| On recommande | On interdit (et le produit refuse) |
|---|---|
| Réécrire titre, résumé et expériences avec des faits **vrais** et le vocabulaire des JD | Toute information inexacte (LinkedIn §3.1, Malt §7.1) |
| Publier soi-même des articles et posts sur des missions réelles | Publication automatisée, bots, extensions qui agissent sur le compte (LinkedIn §8.2) |
| Compléter son profil Malt, Codeur ou GitHub | Scraping, même « manuel » à grande échelle (Malt §10.2) ; faux comptes ; revente de données (GitHub §4, §7) |
| Obtenir des mentions tierces **réelles** (talks, articles invités, open source) | Échanges de mentions artificiels, faux témoignages, réseaux de sites |
| Site perso statique, lisible, ouvert aux bots de recherche | Texte caché, instructions adressées aux IA, cloaking |

## 8. Mentions légales, CGU/CGV et points à faire valider par un juriste

**Documents à produire (S2-S5)** : mentions légales (LCEN art. 1-1, version SREN) · politique de confidentialité (sous-traitants, durées) ·
**notice « personnes citées par les IA »** (art. 14(5)(b)) · CGU (clause de véracité, usages interdits, **destination "usage candidat uniquement"**) ·
CGV (pré-vente, rétractation de 14 jours avec renonciation expresse pour l'audit livré, remboursement intégral si la gate échoue, médiateur ;
**pas de lien ODR**, plateforme fermée le 20/07/2025) · contrat de licence B2B (interdiction d'exploiter des résultats individuels, agrégats seulement).

**Points à faire valider (12, repris de R3 §7)**
1. Suffisance de la mise en balance de l'intérêt légitime avec un brut pseudonymisé de 72 h.
2. Avis public (art. 14(5)(b)) et articulation avec l'art. 11 après masquage.
3. Caractère obligatoire de l'AIPD, et nécessité ou non d'une consultation préalable de la CNIL (art. 36).
4. Rôles RGPD en B2B (scénario B) et contenu du contrat.
5. Solidité d'une position AI Act fondée sur un **projet** de lignes directrices ; risque de requalification en B2B.
6. Documentation ou enregistrement au titre des art. 6(4) et 49(2) selon l'Omnibus 2026/1744.
7. Art. 50(2) : marquage des suggestions générées.
8. Fournisseurs : rétention Anthropic, statut DPF, CGU Perplexity, conditions des outils de recherche (R5), politiques d'usage emploi.
9. TIA des transferts vers les États-Unis.
10. Droit de la consommation : qualification du service, pré-vente, salariés portés, médiation.
11. Responsabilité si un client publie des informations inexactes après nos conseils ; clause de véracité et limitation de responsabilité.
12. Propriété des sorties LLM ; **usage nominatif des marques ChatGPT, Claude, Perplexity et Gemini** dans notre communication (usage descriptif ou référentiel).

**Ajout de Legal & Trust** : recherche d'antériorités de marque par un **conseil en propriété industrielle** sur le nom retenu (`MARQUE.md`).
