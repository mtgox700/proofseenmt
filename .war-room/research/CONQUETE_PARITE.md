# Carte de parité Malt / Free-Work / Proofseen

Veille du **2026-10-05**, pages publiques uniquement (aucune connexion, aucun formulaire, aucun profil consulté).
Complète la « CARTE DE PARITÉ » de `.war-room/PROMPTS_CONQUETE.md`.

## Mode de lecture

- Chaque ligne renvoie à une source `[Sx]` listée en fin de document, lue le 2026-10-05.
- **malt.fr et help.malt.com ont répondu 403 à chaque requête.** Conformément à la règle, aucune nouvelle tentative et
  aucun contournement. Les chiffres Malt viennent donc de deux types de source, toujours signalés :
  - `[Sx*]` = **extrait affiché par le moteur de recherche** pour une page officielle Malt, page elle-même non ouverte →
    **À VÉRIFIER (bloqué)** à la main dans un navigateur par le founder ;
  - `[Sx]` sans astérisque = page tierce publique effectivement lue (presse, blog, Trustpilot).
- Quand deux sources divergent, les deux valeurs sont données.
- « à construire » = absent de Proofseen aujourd'hui. « démo » = écran existant sur données de démonstration ou fichiers
  (cf. `acquis_au_2026-10-05` du plan C1), donc pas utilisable en bêta.

---

## 1. Fonctionnalités par domaine

### 1.1 Malt

| Domaine | Ce qui est documenté publiquement | Source |
|---|---|---|
| Taille | « plus de 800 000 freelances » (novembre 2024) | [S13] |
| Profil freelance | Profil compétences, recommandations, avis clients ; complétude du profil et mises à jour récentes présentées comme signaux de visibilité | [S9] |
| Badges | Programme **Super Malter** niveaux 1/2/3 : 7 500 / 15 000 / 30 000 points sur 15 mois glissants ; note moyenne ≥ 4,5/5 ; charte signée ; points gagnés par profil complété, recommandations, facturation, bonus de fidélité client ; « 3,6 % des freelances actifs » badgés ; « 30 % de visites en plus » selon Malt | [S6*] |
| Vérification | KYC/KYB par le prestataire de paiement (Mangopay cité) : identité, immatriculation, statuts ; forme juridique, SIRET, TVA | [S5*] |
| Statut légal | Non obligatoire pour créer le profil et recevoir des propositions ; compatible portage salarial | [S29] |
| Recherche entreprise | Moteur de recherche de profils **ou** dépôt de projet avec recommandation par algorithme | [S7*] |
| Recherche IA | **AI Search** (13/11/2024) : brief en langage naturel ou PDF → liste de profils ; LLM externes + petits modèles internes + deep learning entraîné sur « des millions de paires clients/freelances évaluées » | [S13] |
| Classement | Matching en 2 temps : filtre sur critères client puis « taux de compatibilité » (minimum 70 % cité) ; facteurs cités par des tiers : pertinence mots-clés, temps de réponse affiché, avis, complétude | [S7*] [S9] |
| Missions / candidatures | Le freelance reçoit des « opportunités » (propositions) poussées par le matching, conseil de répondre même pour refuser ; client conseillé d'envoyer à 3 freelances (+50 % de devis) | [S7*] |
| Messagerie | Messagerie intégrée pour le premier contact | [S26] |
| Hors plateforme | Clause de non-contournement : relation directe dans les **12 mois** suivant la mise en relation = violation, **indemnité 10 000 €** à la charge du client (CGU non lisibles ici) | [S26] — **À VÉRIFIER (bloqué)** |
| Devis | Créé par le freelance, accepté par le client ; la page de devis affiche les frais et le net perçu | [S1*] [S8*] |
| Contrat | Cadre = CGU marketplace + devis accepté ; pas de modèle de contrat séparé trouvé | **À VÉRIFIER (bloqué)** |
| Paiement | 3 modes : **prépaiement** (séquestre, versement à la validation) ; **avance de trésorerie** (versement sous **10 jours** après validation de la fin de prestation ou du rapport mensuel) ; **paiement sur facture** aux délais du client, « généralement 30 à 60 jours » ; missions longues = prépaiements mensuels estimés avec ajustement | [S4*] |
| Facturation | **Mandat de facturation** : Malt émet la facture au nom et pour le compte du freelance ; 2 factures (projet freelance→client, frais de service Malt→freelance) | [S8*] |
| Commission freelance | **10 % HT** première collaboration ; **5 % HT** après 6 mois avec le même client ; **2 % HT** si le freelance invite son client ; micro non assujetti TVA : **12 % TTC** (6 % TTC au taux réduit) | [S1*] [S9] [S10] |
| Divergence | Un extrait tiers indique « 5 % après 3 mois » au lieu de 6 mois | [S27] vs [S1*] |
| Commission client | **Starter 5 %**, **Advanced 9 %**, **Enterprise sur devis** (FR/BE/ES) | [S2*] |
| Divergence | Un blog tiers donne des fourchettes « ~5-10 % » et « ~9-15 % » | [S10] vs [S2*] |
| Offre payante freelance | « Malt Premium 49 €/mois » (visibilité, statistiques) — seulement dans des blogs tiers, non confirmé | [S27] — **À VÉRIFIER** |
| Parrainage | 5 % du projet au-delà de 3 000 € (blog tiers) | [S10] — **À VÉRIFIER** |
| Avis / notation | Note sur 5 issue des projets ; recommandations externes distinctes des missions vérifiées | [S9] [S6*] |
| Tableaux de bord | Page projet (validation, paiement), notes de frais côté client ; détail des écrans non public | [S8*] — **À VÉRIFIER (bloqué)** |
| URSSAF | **Attestation de vigilance** exigée : PDF de moins de 6 mois, SIRET identique au profil, société active ; contrôlée à la première acceptation de projet | [S5*] |
| RGPD | Charte de protection des données publiée (non lisible : domaine bloqué) | **À VÉRIFIER (bloqué)** |
| Grands comptes | Offre Enterprise ; FMS (gestion des freelances, conformité, reporting) ; « plus de 85 intégrations » P2P dont SAP Fieldglass, Coupa, Workday | [S2*] [S28*] — **À VÉRIFIER** |
| Assurance | RC Pro incluse sur les missions passées par Malt. **Deux sources** : attestation AXA 2023 « 20 M€ » ; notice Hiscox 2024 HA RCP0388146 : 20 M€/an pour le contrat mais **500 000 € par sinistre** (mission standard), 1 M€ (Advanced), 5 M€ (Corporate), **franchise 1 000 €**, exclusions (blockchain, santé, hébergement…), hors plateforme non couvert | [S12*] vs [S11] |
| Portage | Compatible (le freelance facture via sa société de portage) ; pas d'offre portage Malt identifiée | [S29] |
| API | Intégrations entreprise (voir grands comptes) ; pas d'API publique documentée trouvée | **À VÉRIFIER** |

### 1.2 Free-Work (et Turnover-IT, son portail recruteur)

| Domaine | Ce qui est documenté publiquement | Source |
|---|---|---|
| Positionnement | Job board IT/tech : missions freelance + CDI, forum, blog ; éditeur AGSI SAS | [S16] [S17] |
| Chiffres | **208 844 membres actifs**, 7 082 missions freelance, 4 772 CDI/CDD, 2 940 entreprises qui recrutent (page d'accueil) | [S16] |
| Divergence | Turnover-IT : « 422K profils IT et tech » (accueil) et « plus de 300 000 » dont 120 000 mis à jour en 8 mois (page CVthèque) ; listing missions freelance : 6 793 résultats | [S20] [S21] [S19] vs [S16] |
| Profil freelance | Profil/CV avec parseur de CV ; compétences, expériences, recommandations ; disponibilité et visibilité réglables à tout moment ; CV activable/désactivable | [S16] [S30] |
| Vérification | Aucune vérification d'identité, de SIRET ni de compétences décrite | [S17] (absence) |
| Badges | Aucun décrit | [S17] (absence) |
| Recherche missions | Filtres : lieu, type de contrat, durée, TJM, télétravail, expérience, date de publication ; alertes | [S19] |
| Fiche mission | Titre, recruteur, date, 3-5 compétences, démarrage, durée, télétravail, lieu, TJM si fourni | [S19] |
| Candidature | Candidature en un clic ; centralisation des candidatures | [S16] [S30] |
| Recherche entreprise | CVthèque : langage naturel ou booléen ; filtres compétences, technos, dispo, lieu, statut, expérience, TJM | [S20] [S21] |
| Classement | **« AI matching »** : identifie « les profils les plus pertinents » pour chaque offre ; candidats rangés par niveau d'adéquation | [S20] [S21] |
| Messagerie | Messagerie recruteur intégrée (statuts de qualification des candidats) | [S21] |
| Hors plateforme | Aucune restriction : Free-Work « n'est pas partie » aux relations candidat/recruteur | [S17] §2.3(c) |
| Devis / facturation | **MyBusiness** : devis, factures, avoirs, relances, synchro bancaire, export CSV. Gratuit = 5 clients, 40 000 € de CA/an, 5 documents de chaque type ; **Illimité 29 €/mois** sans engagement | [S18] |
| Contrat / paiement | Aucun : pas de séquestre, pas d'encaissement, pas de contrat | [S17] §2.1, §2.3(c) ; [S23] art. 11.4 |
| Commission freelance | **0 %** : site gratuit pour les candidats | [S17] §2.1 |
| Tarifs recruteur | Abonnement à prix fixe « indépendant du volume », sièges + offres actives + accès CVthèque modulables, essai 24 h ; **prix non affichés** sur la page tarifs | [S22] |
| CGV recruteur | Accès à durée ferme sans résiliation anticipée ni remboursement ; formule mensuelle START reconductible 30 jours, résiliable ; « aucun droit à remboursement » | [S23] art. 4.5, 5.2.1, 5.3.1 |
| Avis / notation | Aucun système d'avis | [S17] (absence) |
| Tableaux de bord | Espace candidat (candidatures, alertes) ; côté recruteur ATS SaaS | [S16] [S23] art. 3 |
| Données candidat | CV « partageables avec toute personne ayant accès à Turnover-IT » ; droits mondiaux de reproduction ; conservation durée du compte + 1 à 2 ans | [S17] §2.3(d), §2.5, §11(b) |
| Garde-fous recruteur | Interdiction d'extraire la base, de partager les données, de les utiliser pour entraîner des IA sans consentement | [S23] art. 11.7, 11.9, 11.10 |
| Grands comptes / ESN | Marketplace B2B d'intercontrats entre ESN | [S20] |
| Portage | Simulateur de revenu en portage ; contenus éditoriaux ; pas d'offre propre | [S25*] |
| Assurance | Aucune | [S17] (absence) |
| API / intégrations | Multidiffusion vers « plus de 40 ATS » ; JobConnect, Profile Sync, Talent Search API | [S20] |
| Communauté | Forum (23 000 à 28 290 fils selon la même page), réductions partenaires, baromètre TJM, simulateurs | [S16] |

---

## 2. Matrice de parité

Proofseen aujourd'hui : preuve vérifiée de possession d'URL, rapports de mesure des citations IA, profils publics
pseudonymes ; Clerk, inscription, annuaire et messagerie en **démo** (fichiers). P0 = indispensable à la bêta publique.

| Fonctionnalité | Malt | Free-Work | Proofseen aujourd'hui | Prio | Sprint |
|---|---|---|---|---|---|
| Profil freelance public (compétences, TJM, dispo) | oui | oui (CV) | oui, pseudonyme | P0 | C1/C5 |
| Profil lisible et cité par les IA | non documenté | non documenté | **oui (mesuré)** | P0 | C5 |
| Preuve de possession d'URL / portfolio vérifié | non | non | **oui** | P0 | C5/C6 |
| Vérification identité / KYC-KYB | oui (Mangopay) | non | à construire (Stripe Connect) | P0 | C3/C6 |
| Contrôle SIRET + statut actif | oui | non | à construire | P0 | C6 |
| Attestation de vigilance URSSAF (dépôt, péremption 6 mois) | oui | non | à construire | P0 | C6 |
| Badges | Super Malter (points) | non | à construire : **badges de faits vérifiés, sans niveau ni score** | P1 | C6 |
| Recherche entreprise par filtres | oui | oui (CVthèque) | démo (annuaire) | P0 | C2 |
| Recherche en langage naturel | oui (AI Search) | oui | à construire : **traduction du brief en filtres visibles et modifiables**, sans tri par score | P1 | C2 |
| Matching / classement auto de personnes | oui (taux de compatibilité) | oui (AI matching) | **refusé par principe** (AI Act) | — | — |
| Publication de mission | oui (dépôt de projet) | oui (job board) | à construire | P0 | C2 |
| Pages missions indexables | non documenté | oui (listing public) | à construire | P1 | C2/C5 |
| Alertes missions | non documenté | oui | à construire | P1 | C2 |
| Candidature / proposition | oui (opportunités poussées) | oui (1 clic) | à construire, preuves jointes | P0 | C2 |
| Statut de candidature visible du freelance | non documenté | absent (plaintes) | à construire, **statut obligatoire** | P0 | C2 |
| Messagerie intégrée | oui | oui (côté recruteur) | démo (fichiers) | P0 | C2 |
| Règle de contact hors plateforme | 12 mois / 10 000 € (À VÉRIFIER) | aucune | à construire (règle courte, écrite, visible) | P0 | C2/C3 |
| Devis en ligne avec net affiché | oui | via MyBusiness (hors relation) | à construire | P0 | C3 |
| Contrat de mission | CGU + devis | non | à construire | P0 | C3 |
| Paiement séquestre | oui (prépaiement) | non | à construire (Stripe test, live après GO PAIEMENT LIVE) | P0 | C3 |
| Avance de trésorerie (≤ 10 j) | oui | non | à construire | P2 | C3+ |
| Prépaiements mensuels (régie) | oui | non | à construire | P1 | C3 |
| Mandat de facturation | oui | non | à construire | P0 | C3 |
| Facturation électronique conforme | non documenté | « logiciel certifié » (MyBusiness) | à construire | P1 | C3 |
| Commission affichée avant devis | oui | 0 % | à construire | P0 | C3/C7 |
| Avis vérifiés liés à une mission payée | oui | non | à construire | P1 | C4/C6 |
| Tableau de bord freelance | oui | oui (candidatures) | démo | P0 | C4 |
| Tableau de bord entreprise | oui | oui (ATS) | démo (espace client par jeton) | P0 | C4 |
| Rapport de visibilité IA du profil | non | non | **oui** | P0 | C4/C5 |
| RGPD : registre, export, suppression, durées | charte publiée | CGU §11 | à construire | P0 | C6 |
| Assurance RC Pro mission | oui (Hiscox/AXA) | non | à construire (partenaire) | P2 | C6+ |
| Portage | compatible | simulateur | à construire (compatibilité de statut) | P2 | C6+ |
| Offre grands comptes / FMS | oui | marketplace ESN | à construire | P2 | après C7 |
| Intégrations P2P / ATS / API | 85+ (À VÉRIFIER) | 40+ ATS, API | à construire | P2 | après C7 |
| Forum / contenus communauté | blog | forum + simulateurs | à construire | P2 | après C7 |

---

## 3. Angles d'attaque

### 3.1 Malt

1. **Coût cumulé élevé à la première mission.** 10 % HT côté freelance + 5 à 9 % HT côté client [S1*] [S2*] : jusqu'à
   environ 19 % du montant HT du devis cumulés (calcul de notre part, À VÉRIFIER sur la page tarifs). Les micro non
   assujettis paient 12 % TTC [S9]. → Proofseen : **une seule commission affichée en clair avant le devis**, simulateur
   net perçu public.
2. **Paiement conditionné à la validation du client.** Hors prépaiement : 10 jours après validation, ou 30 à 60 jours
   [S4*] ; les retards et fonds bloqués sont le 2e thème négatif sur Trustpilot [S14]. → Séquestre à l'acceptation du
   devis, **validation tacite datée** si le client ne répond pas, délai de versement affiché par mission.
3. **Note Trustpilot moyenne et polarisée.** 3,5/5 sur 1 546 avis lus le 2026-10-05, 15 % d'avis 1 étoile [S14] ; un tiers
   cite 3,7/5 sur 1 536 avis [S9]. Thèmes : support peu réactif, peu de missions malgré un profil complet, frais jugés
   élevés, système de niveaux [S14]. → Support humain avec délai de réponse publié ; mesurer et publier nos propres
   délais, jamais d'avis fabriqué.
4. **Visibilité dépendante d'un algorithme interne.** Opportunités poussées par matching et score de compatibilité
   [S7*] ; plaintes « aucune mission » [S14]. → Proofseen rend le freelance **trouvable hors plateforme** (profil cité par
   les IA, mesuré par rapport), donc moins dépendant d'un classement maison.
5. **Programme de niveaux à points.** 3,6 % de badgés, seuils de points sur 15 mois [S6*] ; perte de niveau dénoncée
   [S14]. → Badges binaires de **faits vérifiés** (URL possédée, SIRET actif, attestation à jour, mission payée), sans
   niveau ni rang.
6. **Verrou de sortie.** Non-contournement 12 mois / 10 000 € [S26] (À VÉRIFIER). → Règle de contact courte, lisible,
   justifiée par le séquestre et l'assurance, pas par une pénalité.
7. **Assurance moins large que l'affiche.** « 20 M€ » communiqué, mais 500 000 € par sinistre et 1 000 € de franchise en
   mission standard, liste d'exclusions [S11]. → Afficher les plafonds réels dès la bêta si une assurance est proposée.
8. **Classement automatique de personnes (AI Act).** AI Search et le taux de compatibilité classent des freelances
   [S13] [S7*] ; l'Annexe III point 4(a) vise les systèmes de sélection de personnes et l'accès au travail indépendant
   [S24]. → **Signalé, pas jugé** (analyse juridique = founder). Alternative Proofseen : le brief est converti en
   **filtres visibles et modifiables** ; résultats triés seulement par un critère choisi par l'utilisateur (date de
   mise à jour, TJM, disponibilité) ; chaque fait affiché porte sa preuve.

### 3.2 Free-Work

1. **Aucune protection de paiement ni contrat.** Free-Work « n'est pas partie » aux relations [S17] §2.3(c) ;
   Turnover-IT n'intervient pas dans le paiement [S23] art. 11.4. → Séquestre + contrat + facture : l'argument central
   face à un job board gratuit.
2. **CV diffusé à tous les recruteurs abonnés.** Partage avec « toute personne ayant accès » à Turnover-IT, droits
   mondiaux de reproduction [S17] §2.3(d), §2.5. → Profil pseudonyme, coordonnées jamais exposées, **journal de qui a
   consulté**.
3. **Candidatures sans retour.** Fils de forum publics « Candidatures jamais consultées », « Les offres sans réponses »,
   « Pas de retour suite candidature » [S30] ; même thème sur Trustpilot [S15]. → Statut obligatoire (reçue, lue,
   retenue, refusée) avec délai, visible du freelance.
4. **Signal Trustpilot faible et négatif.** 2,8/5 mais sur **3 avis seulement**, tous 1 étoile [S15] : échantillon non
   représentatif, à citer comme tel. Thèmes : données personnelles, courriels après désinscription.
5. **Aucune vérification ni avis.** Pas de contrôle d'identité, de SIRET, ni de notation dans les CGU [S17]. → Faits
   vérifiés et avis liés à une mission payée.
6. **Tarifs recruteur opaques et sans remboursement.** Prix non affichés [S22] ; durée ferme sans résiliation ni
   remboursement [S23] art. 4.5, 5.2.1. → Commission au succès uniquement, prix publics.
7. **Chiffres de base incohérents entre pages.** 208 844 membres actifs [S16] vs 422K [S20] vs plus de 300 000 [S21]. →
   Publier des chiffres datés et sourcés (règle Proofseen : aucun chiffre inventé).
8. **AI matching qui range les candidats.** « Profils les plus pertinents » rangés par adéquation [S20] [S21] : même
   catégorie Annexe III 4(a) [S24]. → Même alternative par filtres que pour Malt.
9. **Facturation gratuite plafonnée.** MyBusiness gratuit limité à 5 clients et 40 000 € [S18]. → Facturation incluse
   pour toute mission passée par Proofseen (mandat de facturation).

**Ce qu'il ne faut pas sous-estimer** : Free-Work est à 0 % pour le freelance [S17] et possède un trafic IT massif
(forum, simulateurs, plus de 6 700 missions listées [S19]). Proofseen ne gagne pas sur le prix face à lui, mais sur la
sécurité de paiement, la preuve et la visibilité IA.

---

## 4. Sources (toutes lues ou tentées le 2026-10-05)

`*` = page officielle bloquée (HTTP 403), contenu connu par l'extrait du moteur de recherche uniquement → À VÉRIFIER (bloqué).

| Id | URL | État |
|---|---|---|
| S1* | https://help.malt.com/hc/fr/articles/29539691425938-Comment-fonctionne-la-commission-Malt-pour-freelances | 403 |
| S2* | https://help.malt.com/hc/fr/articles/29567589850002-Quels-sont-les-frais-de-service-et-offres-Malt | 403 |
| S3 | https://www.malt.fr/c/pricing | 403, rien d'exploité |
| S4* | https://help.malt.com/hc/fr/articles/29542912511122-Sous-quel-d%C3%A9lai-vais-je-recevoir-mes-paiements | extrait |
| S5* | https://help.malt.com/hc/fr/articles/29598923962770-Comment-obtenir-mon-attestation-de-vigilance-URSSAF | extrait |
| S6* | https://help.malt.com/hc/fr/articles/29561329181586-Comment-fonctionne-le-programme-Super-Malter | extrait |
| S7* | https://help.malt.com/hc/fr/articles/29534878703506-Comment-fonctionnent-les-opportunit%C3%A9s-pour-freelances | extrait |
| S8* | https://help.malt.com/hc/fr/articles/29540886429586-Comment-fonctionnent-la-facturation-et-le-paiement | extrait |
| S9 | https://lefreelance.fr/articles/malt-avis-2026/ | lu (tiers) |
| S10 | https://parrainduweb.fr/blog/commission-malt | lu (tiers, MAJ 2026-08-14) |
| S11 | https://www.clikassur.fr/blog/rc-pro-plateformes-freelance-malt-comet/ | lu (tiers, cite la notice Hiscox 2024) |
| S12* | https://cdn.malt.com/legals/2023/Attestation%20Freelance%20+%20Garanties%202023.pdf | extrait, non ouvert |
| S13 | https://www.lemondeinformatique.fr/actualites/lire-malt-lance-un-assistant-ia-de-selection-des-freelances-95241.html | lu (presse) |
| S14 | https://fr.trustpilot.com/review/malt.fr | lu |
| S15 | https://fr.trustpilot.com/review/free-work.com | lu |
| S16 | https://www.free-work.com/fr/tech-it | lu |
| S17 | https://www.free-work.com/fr/terms | lu |
| S18 | https://www.free-work.com/fr/mybusiness | lu |
| S19 | https://www.free-work.com/fr/tech-it/jobs?contracts=contractor | lu |
| S20 | https://www.turnover-it.com/ | lu |
| S21 | https://www.turnover-it.com/solutions/cv-database | lu |
| S22 | https://www.turnover-it.com/pricing | lu, prix non affichés |
| S23 | https://www.turnover-it.com/cgv.php | lu |
| S24 | https://artificialintelligenceact.eu/annex/3/ | lu |
| S25* | https://www.free-work.com/fr/calculators/portage-salarial | extrait |
| S26 | https://misterportage.fr/tout-pour-se-lancer-en-portage-salarial/avis-malt/ (et publication LinkedIn publique citée par le moteur, non ouverte) | extrait, CGU Malt bloquées → À VÉRIFIER |
| S27 | https://freelancekit.fr/avis/malt , https://www.editionweb.fr/malt-avis-notre-analyse-complete-de-la-plateforme-freelance-en-2026/ | extraits tiers → À VÉRIFIER |
| S28* | https://www.sap.com/products/spend-management/partners/malt-community-leading-highly-skilled-freelance-marketplace.html | 403 ; « 85 intégrations » = extrait |
| S29 | https://meilleur-portage.fr/blog/malt-avis-plateforme-freelance/ | extrait tiers |
| S30 | https://www.free-work.com/fr/tech-it/forum/t/candidatures-jamais-consultees-sur-le-free-work (et fils « offres sans réponses », « pas de retour suite candidature ») | titres publics via le moteur |

### À vérifier à la main par le founder (navigateur, sans contournement)

1. Page tarifs Malt (malt.fr/c/pricing) : 5 % / 9 % / sur devis côté client, et cumul réel avec les 10 % freelance.
2. Délai de baisse à 5 % : 6 mois [S1*] ou 3 mois [S27].
3. CGU Malt : durée et montant de la clause de non-contournement (12 mois, 10 000 €).
4. Existence et prix d'un « Malt Premium » freelance (49 €/mois cité par des tiers seulement).
5. Assureur actuel Malt (AXA 2023 ou Hiscox 2024) et plafonds 2026.
6. Prix Turnover-IT (non affichés publiquement).
