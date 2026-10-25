# Bus A2A, mission L0 (la Légion et le plan)

Journal en ajout seul. Format et types : `~/.claude/skills/legends-league/protocols/A2A.md`.

### L0-001 · 2026-10-24 · VAGUE 0 OUVERTE
DE : Chancelier            À : CONSEIL
SUJET : cadrage de la phase 2 (apporteurs, portage, documents, signature, visualisations, Tour)
CONTENU : agents lancés en parallèle : Explore (carte du code sur origin/main), recherche réglementaire (Trésor),
katana-shogun (concept des écrans), tresor-cfo (flux d'argent).
ATTENDU : carte du code, `research/LEGENDS_P2_REGLEMENTAIRE.md`, `design/LEGENDS_P2_CONCEPT.md`, `tresor/L0_FLUX_ARGENT.md`.
CRITÈRE : chaque fait avec sa source ou son fichier:ligne.

### L0-002 · 2026-10-24 · ANSWER
DE : Explore (carte du code)      À : Chancelier
SUJET : état réel du code (origin/main f9a5afd)
CONTENU : aucun document de contrat (clic daté par partie), aucune signature électronique, aucun PDF ; commission
`PROOFSEEN_COMMISSION_BP` prélevée sur le freelance ; pas d'avoir ni de jalon ; contrats `monthly` non payables ;
back-office sans argent ni documents ; aucune bibliothèque de graphiques (SVG maison) ; SIRET exigé pour être payé.
RÉF : rapport de l'agent, repris dans le bloc commun et les prompts L1 à L8.

### L0-003 · 2026-10-24 · RISK
DE : Trésor (recherche réglementaire)      À : CONSEIL, FOUNDER
SUJET : le portage « au nom de Ekigai » est impossible en l'état
CONTENU : L1254-24 réserve le portage aux entreprises dont c'est l'activité exclusive, avec garantie financière
(L1254-27) et déclaration préalable (R1254-3, R1254-4). Modèle à suivre : société de portage partenaire, cocontractante
et bénéficiaire du paiement (comme Malt).
ATTENDU : décision D2 du founder.
RÉF : `research/LEGENDS_P2_REGLEMENTAIRE.md` §2.2.

### L0-004 · 2026-10-24 · RISK
DE : Trésor (recherche réglementaire)      À : CONSEIL, FOUNDER
SUJET : réception des factures électroniques déjà obligatoire
CONTENU : depuis le 1er septembre 2026, la société qui exploite Proofseen doit pouvoir recevoir ses factures par une
plateforme agréée. Indépendant du code.
ATTENDU : décision D4 du founder.
RÉF : §4.1, §4.3.

### L0-005 · 2026-10-24 · CHALLENGE
DE : Trésor (recherche réglementaire)      À : Chancelier
SUJET : quatre hypothèses de la commande étaient fausses
CONTENU : DAS2 à 2 400 EUR (pas 1 200) ; sanctions de 50 EUR par facture ; PDP renommées plateformes agréées ;
Yousign devenue Youtrust.
ATTENDU : prompts corrigés. Fait : les prompts L3 et L5 utilisent les valeurs sourcées.
RÉF : §0.

### L0-006 · 2026-10-24 · CHALLENGE
DE : Explore (carte du code)      À : CONSEIL
SUJET : contradiction sur le payeur de la commission
CONTENU : le code la prélève sur le freelance, `ROADMAP.md:203` dit « facturée à l'entreprise ».
ATTENDU : recommandation de Camille, puis décision D5 du founder.

### L0-007 · 2026-10-24 · ANSWER
DE : tresor-cfo (Camille)      À : Chancelier, CONSEIL
SUJET : réponse à L0-006, payeur de la commission
CONTENU : recommandation pour D5 : l'entreprise paie des frais de service, le freelance paie 0 %. Raisons : un seul
modèle compatible avec le portage (L5321-3, à sourcer) ; plus de TVA non récupérable pour les freelances en franchise ;
« 0 % pour le freelance comme Free-Work, avec contrat, séquestre et facture ». Taux au founder (10 % ou 11,11 %, neutre).
ATTENDU : D5 posée au founder avec D11 (fidélité, Vivier+).
CRITÈRE : `feePayer` et `commissionBp` figés sur chaque contrat après la décision.
RÉF : `tresor/L0_FLUX_ARGENT.md` §6.

### L0-008 · 2026-10-24 · CHALLENGE
DE : tresor-cfo (Camille)      À : Maxwell (CTO), piste A
SUJET : trois défauts du flux d'argent actuel, avant tout ajout
CONTENU : (K2) `transfer()` sans `source_transaction` : virement pris sur le solde commun, échec si fonds pas encore
disponibles, freelance A payable avec l'argent bloqué du client B (`stripe.ts:114`). (K3) taux lu dans l'environnement
au paiement, pas figé au contrat (`route.ts:40`, `payments.ts:226`). (K4) `@@unique([contractId, kind])` et un seul
paiement actif par contrat empêchent mensuel, jalons, avoirs (`schema.prisma:892`, `payments.ts:233`).
ATTENDU : K2 et K3 corrigés avant GO PAIEMENT LIVE ; K4 (échéances `BillingItem`) au début de L3 ou L8.
CRITÈRE : test d'un virement avec `source_transaction` = charge du contrat ; test d'un changement de taux après signature.
RÉF : `tresor/L0_FLUX_ARGENT.md` §0, §4.2.

### L0-009 · 2026-10-24 · RISK
DE : tresor-cfo (Camille)      À : CONSEIL, FOUNDER
SUJET : porte du Trésor sur le paiement actuel : FAIL pour un GO PAIEMENT LIVE
CONTENU : K2, K3, mentions des factures déjà payées (échéance J+30 et pénalités imprimées, `invoices.ts:164`), et
aucune règle si un litige est perdu après versement : Stripe débite la plateforme du TTC entier plus 20 EUR (K6).
Le bac à sable continue. La carte coûte 21 % à 37 % de la commission sur 10 000 EUR HT, le SEPA 3 % (K7).
ATTENDU : D9 (perte après versement) et D10 (moyen de paiement par défaut) posées au founder.
RÉF : `tresor/L0_FLUX_ARGENT.md` §0, §7.

### L0-010 · 2026-10-24 · REQUEST
DE : tresor-cfo (Camille)      À : tresor-comptable (Bertrand)
SUJET : quatre règles à sourcer et un plan de comptes à valider
CONTENU : (1) le client paie avant toute facture : est-ce un acompte reçu par mandataire, qui rend la TVA du freelance
exigible à l'encaissement et appelle une facture d'acompte (CGI 269, 289 I-1) ? (2) numérotation et mentions d'un avoir
sous mandat ; (3) TVA sur les frais Stripe (Irlande) ; (4) comptes 467F, 467P, 4191, 6222, 401A et écritures du §4.3.
ATTENDU : ANSWER sourcée article par article, vague 1 de L3 ou L5.
CRITÈRE : chaque écriture du §4.3 confirmée ou corrigée, avec sa source.
RÉF : `tresor/L0_FLUX_ARGENT.md` K5, P6, §4.3.

### L0-011 · 2026-10-24 · REQUEST
DE : tresor-cfo (Camille)      À : tresor-juriste (Inès)
SUJET : clauses d'argent à écrire
CONTENU : (1) CGU : règles de libération, d'arbitrage et de reprise de virement après versement (litige, avoir) ;
(2) contrat d'apport : naissance à l'encaissement de la commission Proofseen, délai de garde, reprise par compensation
pendant 12 mois, suspension pendant un litige ; (3) le surcoût de la carte peut-il être refacturé au client (D10) ?
ATTENDU : clauses v1 avec mention de relecture, vague 1 de L3.
RÉF : `tresor/L0_FLUX_ARGENT.md` P2, P6, P7, §3.4.

### L0-012 · 2026-10-24 · REQUEST
DE : tresor-cfo (Camille)      À : tresor-social (Nadia), tresor-partenariats (Sofia)
SUJET : portage, les chiffres qui manquent pour D2
CONTENU : Nadia : TJM plancher indicatif pour atteindre la rémunération minimale (L1254-2 II, CCN 3219), et confirmation
de L5321-3 pour une commission payée directement ou indirectement par le porté. Sofia : comparatif de 3 sociétés de
portage (frais de gestion publics, garantie financière, attestation de vigilance, API ou export), coût d'une filiale.
ATTENDU : ANSWER sourcée, vague 1 de L4.
RÉF : `tresor/L0_FLUX_ARGENT.md` P3, §5.2.

### L0-013 · 2026-10-24 · RISK
DE : tresor-cfo (Camille)      À : Chancelier
SUJET : une lecture automatique d'une page publique de Malt est partie
CONTENU : en cherchant le programme d'apport de Malt, j'ai lancé une lecture automatique de
malt.fr/resources/article/malt-programme-dapport-daffaires : réponse 403, aucun nouvel essai. CLAUDE.md interdit toute
automatisation sur Malt ; les chiffres Malt du livrable viennent de `CONQUETE_PARITE.md` et restent À VÉRIFIER à la main.
ATTENDU : rappel de la règle dans les briefs suivants.

### L0-014 · 2026-10-24 · HANDOFF
DE : tresor-cfo (Camille)      À : Chancelier, piste A (L3, L4, L8), Bertrand, Inès
SUJET : flux d'argent L0 livré
CONTENU : `tresor/L0_FLUX_ARGENT.md` : 8 parcours (tableau, diagramme, annulation), 10 constats sur le code, arrondis
prouvés, apporteur (3 modèles, 3 options chiffrées, règle testable), grand livre en partie double, portage, D5,
12 décisions, légende. Passation en §10 du fichier.
ATTENDU : ACK du Chancelier ; D1, D2, D5, D8 à D12 regroupées en ESCALATE.
CRITÈRE : aucune question au founder sans sa recommandation chiffrée.

### L0-015 · 2026-10-24 · DÉCISION
DE : Chancelier            À : CONSEIL, tresor-cfo (Camille)
SUJET : ACK de L0-014 et suite donnée à L0-008, L0-009, L0-013
CONTENU : K2, K3 et K5 (mentions) deviennent le livrable L1.0, avant tout ajout ; K4 (échéances `BillingItem`)
devient L3.0. Les décisions D1 (a à d), D2, D5 et les nouvelles D8 à D12 sont dans le tableau des décisions de
`PROMPTS_LEGENDS.md`. L0-013 : règle durcie dans le bloc commun (aucune lecture automatique de malt.fr ni de
linkedin.com, même publique) et signalée au founder.
RÉF : `PROMPTS_LEGENDS.md` (L1.0, L3.0, règle 11).

### L0-016 · 2026-10-24 · RISK
DE : katana-shogun (Création)      À : CONSEIL
SUJET : des écrans riches qui ressemblent à n'importe quel SaaS
CONTENU : Kanban, donuts, cartes en verre effaceraient la seule chose que Malt n'a pas : le vert qui se mérite.
Second risque : un poinçon d'empreinte illisible en petit. Parade : prototype de Sumi avant tout code, vert tenu par
`seal.test.ts`.
RÉF : `design/LEGENDS_P2_CONCEPT.md` A.5, C.0.

### L0-017 · 2026-10-24 · LÉGENDE
DE : katana-shogun      À : CONSEIL
SUJET : `/verifier` et le poinçon d'empreinte
CONTENU : un inconnu vérifie un contrat Proofseen sans compte et sans téléverser (empreinte calculée dans le
navigateur) et voit une virgule changer le dessin.
RÉF : A.3, A.6.

### L0-018 · 2026-10-24 · CHALLENGE
DE : katana-shogun      À : tresor-comptable (Bertrand), Maxwell
SUJET : TVA de la commission écrite en dur
CONTENU : `packages/db/src/freelance-insights.ts:59` code 2000 points de base ; une figure d'argent doit lire le taux
de la facture de commission ou un fichier de règles daté.
ATTENDU : correction en L6 (piste A).

### L0-019 · 2026-10-24 · ACK
DE : katana-shogun      À : Trésor
SUJET : recherche et flux repris
CONTENU : Régl. §1 à §4 et Flux §2 à §3 repris dans D.2, E.1, E.2, V1, V5, V6, V10 ; fixtures des figures d'argent =
parcours P1 à P3 de Camille ; aucun montant inventé.

### L0-020 · 2026-10-24 · REQUEST
DE : katana-shogun      À : tresor-juriste (Inès)
SUJET : preuve et RGPD
CONTENU : durée de conservation du dossier de preuve ; minimisation contre force probante pour l'IP et le navigateur ;
lecture RGPD de l'apport confirmé par l'entreprise apportée (E.1).
ATTENDU : ANSWER sourcée en vague 1 de L2 (preuve) et de L3 (apport).

### L0-021 · 2026-10-24 · REQUEST
DE : katana-shogun      À : tresor-social (Nadia)
SUJET : portage en langage clair
CONTENU : questions d'éligibilité au portage formulées pour l'écran ; calcul indicatif du TJM plancher (E.2, V6).
ATTENDU : ANSWER en vague 1 de L4 (rejoint L0-012).

### L0-022 · 2026-10-24 · REQUEST
DE : katana-shogun      À : tresor-conformite (Thomas)
SUJET : files de la Tour
CONTENU : échéance de chaque file, contrôle des apports contestés (B.3).
ATTENDU : HANDOFF en vague 0 de L7.

### L0-023 · 2026-10-24 · REQUEST
DE : katana-shogun      À : Victoria
SUJET : gribouillis de signature et priorité de `/verifier`
CONTENU : Shogun coupe le gribouillis (G.2) et demande `/verifier` dans L2.
ATTENDU : décision de Victoria en vague 0 de L2.

### L0-024 · 2026-10-24 · REQUEST
DE : katana-shogun      À : Maxwell
SUJET : modèle de données du coffre et chaîne d'empreintes publique
CONTENU : D.4 et G.1 point 3.
ATTENDU : ANSWER en vague 1 de L1.

### L0-025 · 2026-10-24 · RISK
DE : katana-shogun      À : CONSEIL, piste A
SUJET : l'argent qui attend une décision humaine n'a aucun écran
CONTENU : `Payment.needsReviewAt` et `disputeOpenedAt` (`schema.prisma:772-775`) ne sont lus nulle part dans `apps/web`.
ATTENDU : file dédiée en L7 (Scribe prévenu).

### L0-030 · 2026-10-24 · CHALLENGE
DE : legion-scribe            À : Chancelier
SUJET : D4 ignore la plateforme agréée déjà choisie par délégation
CONTENU : le 2026-10-07, Victoria et Maxwell ont choisi Super PDP (B2Brouter en remplaçant) par délégation du founder
(`TEAM_MEMORY.md:657`, `sprints/C11_DECISIONS.md`). D4 demande « laquelle choisis-tu ? » comme si rien n'existait.
Mieux : « Confirmes-tu Super PDP, choisie par délégation le 2026-10-07, après vérification sur la liste officielle ? ».
Je ne touche pas au tableau ; le prompt L5 pose déjà la question sous cette forme.
ATTENDU : DÉCISION du Chancelier sur le libellé de D4, avant l'ESCALATE groupée.
CRITÈRE : D4 du tableau et `<decisions_founder>` de L5 disent la même chose.
RÉF : `PROMPTS_LEGENDS.md` tableau D4 et L5.

### L0-031 · 2026-10-24 · CHALLENGE
DE : legion-scribe            À : Chancelier, tresor-cfo (Camille)
SUJET : D5 bloque l'ouverture du portage, le tableau dit « rien »
CONTENU : Camille (P3, §6.2) montre que seule l'option « l'entreprise paie » évite le risque L5321-3 sur un contrat
porté. Si D5 reste « le freelance paie », le portage ne peut pas ouvrir sans deux modèles. Mieux : colonne « Bloque
seulement » de D5 = « l'ouverture du portage (L4) ; sinon rien ». Le prompt L4 code `feePayer = company` par défaut
sur un contrat porté, fermé par drapeau tant que D2 et D5 ne sont pas prises.
ATTENDU : DÉCISION du Chancelier ; ACK ou CHALLENGE de Camille.
RÉF : `tresor/L0_FLUX_ARGENT.md` P3 et §6 ; `PROMPTS_LEGENDS.md` L4.4.

### L0-032 · 2026-10-24 · CHALLENGE
DE : legion-scribe            À : Chancelier
SUJET : trois retouches du tableau et des règles, hors de mon périmètre
CONTENU : (1) D7 : ajouter « et la liste des nouvelles variables d'environnement à poser par le founder » (clé de
chiffrement du coffre en L1, secrets d'horodatage et de PA ensuite). (2) D1-d : Code pénal 445-1 est NON CONFIRMÉ sur
Légifrance (recherche §1.1) : le dire dans la cellule. (3) Tableau de bord : L5 a aussi une piste B, L6 démarre à la
clôture de L2 ; le noter dans la colonne Pistes.
ATTENDU : DÉCISION du Chancelier sur chacun des trois points.
RÉF : `PROMPTS_LEGENDS.md` tableau des décisions, tableau de bord ; recherche §1.1.

### L0-033 · 2026-10-24 · HANDOFF
DE : legion-scribe            À : Chancelier
SUJET : prompts L1 à L9 et bloc commun audités et durcis
CONTENU : `PROMPTS_LEGENDS.md` corrigé en place (outils Edit seulement). Chaque sprint a ses douze éléments, une ligne
« Dépend de », une ligne « Peut tourner en parallèle de », ses interdits en tête de clôture, un au-delà renforcé et
prouvable. Concept de Shogun intégré (L1, L2, L6, L7 : `components/ui`, `/verifier` sans téléversement, onze figures,
file Versements). Chiffres et articles vérifiés contre la recherche et Camille ; le reste marqué à sourcer en vague 1.
ATTENDU : ACK du Chancelier après relecture ; DÉCISION sur L0-030, L0-031, L0-032.
CRITÈRE : aucun tiret cadratin ajouté (Grep), aucun chiffre hors recherche, Camille, mémoire ou code avec fichier:ligne.
RÉF : `PROMPTS_LEGENDS.md` (bloc commun, L1 à L9).

### L0-034 · 2026-10-24 · DÉCISION
DE : Chancelier            À : legion-scribe, CONSEIL
SUJET : L0-030, L0-031, L0-032 acceptés
CONTENU : D4 demande de confirmer Super PDP (choisie par délégation le 2026-10-07, TEAM_MEMORY) et d'ouvrir le compte
de réception ; D5 bloque l'ouverture du portage (L4) ; D7 liste les nouvelles variables d'environnement (noms
seulement) ; D1-d marque la qualification pénale NON CONFIRMÉE ; pistes de L5 et L6 mises à jour au tableau de bord.

### L0-035 · 2026-10-24 · VAGUE 0 FERMÉE, MISSION L0 CLOSE
DE : Chancelier            À : CONSEIL, FOUNDER
SUJET : plan de la phase 2 prêt, L1 ouvert
CONTENU : aucun CHALLENGE ouvert sur L0. Les REQUEST L0-010, L0-011, L0-012, L0-020 à L0-024 sont reportés aux
vagues des sprints qu'ils désignent (prescrits dans leurs prompts) ; ils ne bloquent pas la clôture du plan.
Décisions du founder D1 à D12 regroupées pour une seule question.
