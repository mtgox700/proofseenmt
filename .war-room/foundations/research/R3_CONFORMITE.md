# R3 — Dossier conformité (RGPD, AI Act, DPA fournisseurs, CGU plateformes, droit conso)

> **Statut : note de recherche préparatoire, PAS un avis juridique.** Rédigée le 2026-09-18 par l'assistant de recherche Legal & Trust de la War Room. Toutes les positions ci-dessous sont des hypothèses de travail à faire valider par un juriste (section finale). Les sources sont primaires quand c'était possible. Quand une page n'a pas pu être lue (erreur 403, PDF illisible), c'est indiqué.
>
> Légende : **[Confirmé]** = texte primaire lu. **[Probable]** = interprétation raisonnable des textes. **[Incertain]** = sources contradictoires ou non lues.

---

## 0. Synthèse exécutive

| Sujet | Position de travail | Niveau de risque |
|---|---|---|
| RGPD — client freelance | Base contrat (art. 6(1)(b)). Nous sommes responsable de traitement. | Faible |
| RGPD — tiers cités par les LLM | Intérêt légitime (art. 6(1)(f)) + masquage NER **avant** tout stockage. Information par avis public (art. 14(5)(b)), défendable mais à documenter. | Moyen |
| RGPD — AIPD | Fortement recommandée, probablement obligatoire (au moins 2 critères CEPD remplis). | Moyen |
| RGPD — B2B (ESN, portage) | Rôles mixtes. Aucun consultant ne doit être inscrit sans son opt-in direct. Les résultats ne doivent pas remonter à l'employeur. | **Élevé si mal conçu** |
| AI Act — haut risque | Outil côté candidat : **hors Annexe III point 4(a)** selon le projet de lignes directrices de la Commission (mai 2026). Risque de requalification si l'ESN utilise l'outil pour comparer ou affecter ses consultants (4(a)/4(b)). | Faible (B2C) / **Moyen-élevé (B2B)** |
| AI Act — calendrier | Omnibus adopté (Règl. (UE) 2026/1744, en vigueur le 27/07/2026). Annex III reporté au **2 décembre 2027**. L'art. 50 s'applique depuis le 2 août 2026. | — |
| DPA fournisseurs | OpenAI, Anthropic, Google (payant uniquement) : DPA processeur + CCT. Perplexity : DPA via Trust Center, non vérifié. **Gemini gratuit interdit.** « Grounding with Google Search » interdit d'**analyser** les résultats : c'est bloquant pour notre usage. | Moyen |
| CGU plateformes | Conseils de réécriture OK. Interdits : automatisation, scraping, contenu inexact, faux comptes. | Faible si le périmètre reste encadré |
| Droit conso | Freelance qui achète pour son activité = professionnel, donc pas de rétractation légale en principe. Par prudence, appliquer le régime consommateur (14 j + renonciation expresse). | Faible |

---

## 1. RGPD

Texte : Règlement (UE) 2016/679 — https://eur-lex.europa.eu/eli/reg/2016/679/oj

### 1.1 Cartographie des traitements et bases légales probables

| # | Traitement | Personnes concernées | Rôle probable | Base légale probable | Commentaire |
|---|---|---|---|---|---|
| T1 | Compte, facturation, identité professionnelle fournie par le client (nom, URL de profils, compétences) | Client freelance | Responsable de traitement (RT) | Art. 6(1)(b), exécution du contrat | [Probable]. C'est le cœur du service demandé par le client. |
| T2 | Envoi aux API LLM de prompts de type recruteur construits à partir de l'offre fournie par le client (nettoyée des contacts) | Client (indirectement), recruteurs éventuellement nommés dans l'offre | RT. Les fournisseurs LLM sont sous-traitants via leur DPA (§3). | 6(1)(b) pour le client ; 6(1)(f) pour les résidus | La suppression des contacts de l'offre avant envoi est une mesure de minimisation (art. 5(1)(c)). |
| T3 | Réception et conservation chiffrée 7 j des réponses brutes contenant des noms de **tiers** (autres freelances) | Tiers | RT | **Art. 6(1)(f), intérêt légitime** | Voir 1.2. Point le plus sensible. |
| T4 | Détection du client dans les réponses, calcul d'un score de visibilité, recommandations | Client | RT | 6(1)(b) | Il s'agit d'un **profilage** au sens de l'art. 4(4) (évaluation d'aspects liés au travail). Pas de décision produisant des effets juridiques : l'art. 22 ne s'applique a priori pas. |
| T5 | Persistance de métriques agrégées (domaines cités, fréquences) | Aucune si le NER a bien fonctionné | RT | 6(1)(f) | Si le masquage est robuste, il ne reste plus de donnée personnelle. Risque résiduel en cas d'erreur du NER. |
| T6 | Inscription de consultants par une ESN ou une société de portage | Consultants salariés ou portés | Voir 1.5 | Voir 1.5 | Configuration la plus risquée. |

### 1.2 Tiers cités : intérêt légitime (art. 6(1)(f))

- **Le test en trois étapes** du CEPD (intérêt légitime, nécessité, mise en balance) doit être documenté *avant* le traitement. Lignes directrices 1/2024, version 1.0 soumise à consultation jusqu'au 20/11/2024. **Aucune version finale n'a été trouvée sur la page du CEPD au 18/09/2026** [Incertain]. Sources : https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2024/guidelines-12024-processing-personal-data-based_en et le PDF https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf
- **Un intérêt commercial peut être légitime** : CJUE, 4 octobre 2024, *KNLTB*, C-621/22. https://curia.europa.eu/juris/liste.jsf?num=C-621/22
- **Nos arguments pour la mise en balance** [Probable] :
  - La réception des noms de tiers est **incidente**. Nous ne cherchons pas les tiers, nous ne pouvons pas empêcher le LLM de les citer, et nous ne les exploitons pas.
  - Le masquage NER intervient **avant persistance**. Seuls les domaines sont conservés.
  - Les réponses brutes sont chiffrées et conservées 7 jours seulement.
  - Aucune donnée n'est utilisée pour entraîner un modèle. Aucun profil n'est constitué sur les tiers.
  - Il n'y a pas d'effet sur les tiers : aucune décision, aucune diffusion.
- **Recommandation plus protectrice** : appliquer le NER **en mémoire, avant tout stockage**, y compris pour les réponses brutes. Si l'audit des réponses brutes est indispensable (débogage, contestation d'un client), stocker une version où les noms de tiers sont remplacés par un jeton (pseudonymisation, art. 4(5)), et raccourcir la durée à 72 h si possible. Moins il y a de données brutes, plus la mise en balance est solide.
- **Exactitude (art. 5(1)(d))** : les LLM peuvent produire des informations fausses sur des personnes réelles. Ne jamais afficher ni réutiliser d'informations sur les tiers : c'est aussi une protection contre la diffamation.
- **Le CEPD sur les modèles d'IA** (anonymisation, intérêt légitime) est utile par analogie, même si nous ne développons pas de modèle : avis 28/2024, https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en
- **La CNIL sur l'intérêt légitime pour l'IA** (fiches du 19/06/2025, dont une sur le moissonnage) : https://www.cnil.fr/fr/recommandations-developpement-ia-interet-legitime ; délibération n° 2025-041 du 10/04/2025 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051774274

### 1.3 Information des tiers (art. 14) et exception d'effort disproportionné (art. 14(5)(b))

- **Le texte** [Confirmé] : l'information n'est pas due si sa fourniture « se révèle impossible ou exigerait des efforts disproportionnés ». Dans ce cas, le RT « prend des mesures appropriées […] y compris en rendant les informations publiquement disponibles ». Voir art. 14(5)(b) (https://eur-lex.europa.eu/eli/reg/2016/679/oj) et le considérant 62 (nombre de personnes, ancienneté des données, garanties).
- **La position de la CNIL** [Confirmé] (fiche « IA : Informer les personnes concernées ») : la dérogation suppose une **mise en balance documentée**. D'un côté, l'effort nécessaire (absence de coordonnées, nombre de personnes). De l'autre, l'atteinte à la vie privée. Il faut quand même publier une information générale complète. La CNIL relève aussi que si seules des données pseudonymisées sont collectées, il serait disproportionné de collecter davantage de données identifiantes pour informer les personnes. https://www.cnil.fr/fr/ia-informer-les-personnes-concernees
- **Les lignes directrices transparence du G29 (WP260 rev.01)**, reprises par le CEPD, traitent de l'effort disproportionné : https://ec.europa.eu/newsroom/article29/items/622227
- **Application à notre cas** [Probable] : la dérogation est **défendable**. Nous n'avons aucune coordonnée des tiers. Les retrouver pour les informer supposerait de collecter *plus* de données, ce qui va contre la minimisation. Les données sont masquées puis supprimées vite.
- **Conditions à remplir** :
  - (i) documenter la mise en balance dans le registre ou l'AIPD ;
  - (ii) publier une **notice « personnes citées par les IA »** sur le site, avec toutes les mentions de l'art. 14 : finalité, base légale, intérêt poursuivi, durée de 7 j, droit d'opposition, contact du DPO ;
  - (iii) prévoir un canal d'exercice des droits. En pratique, nous ne pourrons souvent pas identifier la personne après masquage : l'art. 11 s'applique alors (pas besoin de conserver des données supplémentaires pour identifier quelqu'un).

### 1.4 AIPD / DPIA

- **Règle de la CNIL** [Confirmé] : une AIPD est obligatoire si le traitement remplit **au moins 2 des 9 critères** du CEPD. Parmi ces critères : évaluation ou notation, croisement de données, usage innovant, collecte à grande échelle. https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd
- **La liste CNIL des traitements soumis à AIPD** (délibération n° 2018-327, 14 types) [Confirmé] contient deux entrées proches de notre cas :
  - « Traitements établissant des profils de personnes physiques à des fins de **gestion des ressources humaines** ». L'exemple cité est « faciliter le recrutement, notamment grâce à un algorithme de sélection ». Cette entrée est **pertinente pour l'offre B2B ESN**.
  - « Traitements de profilage faisant appel à des données provenant de **sources externes** » (critères : évaluation, croisement, usage innovant). Notre score s'appuie sur des sorties de LLM tiers, donc cette entrée est pertinente.
  - Sources : https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-aipd-requise.pdf et https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037559521
- **Position** [Probable] : trois critères semblent remplis (évaluation ou notation du client, usage innovant des LLM, croisement de données). **Il faut réaliser l'AIPD avant la mise en production.** Pour le B2B ESN, l'AIPD est quasi certainement obligatoire.

### 1.5 B2B : ESN et sociétés de portage

- **Qualifier les rôles** : il faut analyser qui détermine les finalités et les moyens, au cas par cas. Voir CEPD, lignes directrices 07/2020 : https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en
- **Deux scénarios** [Probable] :
  - **A. L'ESN achète le service pour ses consultants**, fixe la finalité (améliorer la visibilité des consultants pour placer des missions) et reçoit des résultats. L'ESN est RT et nous sommes **sous-traitant** pour ce traitement. Il faut un contrat art. 28, et c'est à l'ESN d'informer ses consultants (art. 13/14). Nous restons RT pour nos finalités propres (amélioration du produit, statistiques agrégées). C'est un rôle mixte à documenter.
  - **B. L'ESN paie une licence, mais chaque consultant s'inscrit lui-même et reste seul destinataire de ses résultats.** Nous sommes RT vis-à-vis du consultant (base contrat ou relation précontractuelle), et l'ESN n'est qu'un payeur. **C'est le scénario recommandé.**
- **Le consentement donné à l'employeur ne vaut presque rien** : le CEPD considère qu'il est rarement libre en raison du déséquilibre dans la relation de travail. Lignes directrices 05/2020 sur le consentement : https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en
- **Garde-fous recommandés** :
  - (i) opt-in individuel du consultant, directement chez nous ;
  - (ii) **aucun tableau de bord comparatif** des consultants remonté à l'ESN ;
  - (iii) l'ESN ne voit que des agrégats anonymes ou un simple état d'activation ;
  - (iv) le consultant peut se désinscrire sans en informer l'employeur.
  - Ces garde-fous servent aussi à l'AI Act (§2.3).
- **Portage salarial** : le consultant porté est juridiquement salarié de l'entreprise de portage (Code du travail, art. L1254-1 et s., https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050 ; lien vers le code entier, article non relu dans cette session). Les mêmes réserves sur le consentement s'appliquent [Probable, à confirmer].

### 1.6 Minimisation et sécurité (synthèse opérationnelle)

- Offres d'emploi nettoyées des contacts **avant** envoi aux LLM. Détecter aussi les noms de recruteurs dans le corps du texte, pas seulement les e-mails et téléphones.
- Ne pas envoyer aux LLM plus d'identité client que nécessaire : le prompt recruteur n'a pas besoin du nom du client, seule l'analyse côté serveur en a besoin.
- Chiffrement au repos avec gestion des clés séparée. Purge automatique à J+7, journalisée.
- Registre des traitements (art. 30). Liste des sous-traitants publiée (§3).

---

## 2. AI Act — Règlement (UE) 2024/1689

Texte : https://eur-lex.europa.eu/eli/reg/2024/1689/oj. Texte consolidé lisible utilisé pour les citations : https://artificialintelligenceact.eu/

### 2.1 Qualification

- **Nous sommes « fournisseur »** d'un système d'IA construit sur des modèles d'IA à usage général (GPAI) tiers, mis sur le marché sous notre nom [Probable]. Les obligations propres aux GPAI incombent à OpenAI, Anthropic, Google et Perplexity, pas à nous.
- **Annexe III, point 4 (a)** [Confirmé] : « AI systems intended to be used for the recruitment or selection of natural persons, in particular to place targeted job advertisements, to analyse and filter job applications, and to evaluate candidates ». https://artificialintelligenceact.eu/annex/3/
- **Annexe III, point 4 (b)** [Confirmé] : décisions sur les relations de travail, allocation de tâches fondée sur le comportement ou les traits personnels, surveillance et évaluation de la performance. Même source.
- **Art. 6(3)** [Confirmé] : un système de l'Annexe III n'est pas à haut risque s'il ne présente pas de risque important. Les conditions (a) à (d) sont : tâche procédurale étroite, amélioration d'une activité humaine, détection de schémas, tâche préparatoire. **Exception : un système est « toujours » à haut risque s'il fait du profilage de personnes physiques.** Art. 6(4) : documenter l'évaluation avant la mise sur le marché. https://artificialintelligenceact.eu/article/6/

### 2.2 Notre outil est-il à haut risque ?

**Arguments contre le haut risque (usage B2C, côté candidat)** — la position la plus solide [Probable → fort] :

1. **La destination** (« intended to be used for ») est d'aider le candidat à améliorer sa visibilité, pas de recruter ou sélectionner. L'outil n'est pas utilisé par un recruteur ou un donneur d'ordre.
2. **Le projet de lignes directrices de la Commission sur la classification** (publié le 19/05/2026, consultation jusqu'au 23/06/2026, **non définitif et non contraignant**) classe expressément **hors du point 4(a)** :
   - un « AI system intended to be used for assisting candidates in tailoring their CV to specific open positions ». Les recommandations sont « exclusively shared with the candidate » et l'usage est « initiated and managed by the candidate, outside of the potential employer's control ».
   - un système qui aide les candidats à trouver les meilleures offres, avec le même raisonnement.
   - Ces deux exemples correspondent très exactement à notre produit.
   - Sources : page https://digital-strategy.ec.europa.eu/en/library/draft-commission-guidelines-classification-high-risk-ai-systems ; PDF Annexe III https://ec.europa.eu/newsroom/dae/redirection/document/128561 (section 4(a), « examples […] outside the use case »).
3. **Aucune décision n'est prise sur un tiers.** Les listes générées par les LLM servent seulement de mesure. Elles ne sont ni transmises à un recruteur ni exploitées pour sélectionner quelqu'un.

**Arguments pour le haut risque / points de vigilance** :

1. **L'accès au travail indépendant est couvert.** Le même projet de lignes directrices précise que « freelancers, independent professionals, service providers, and platform workers » entrent dans le champ du point 4, et qu'un outil qui **classe des prestataires indépendants** pour un client est à haut risque sans exception art. 6(3) possible (PDF précité, § « AI system ranking self-employed service providers »). Si notre produit évoluait vers une interface « recruteur » ou vendait des classements de freelances à des donneurs d'ordre, il **basculerait** dans le haut risque.
2. **Nos prompts simulent un recruteur** (« trouve-moi 5 freelances »). Le projet de lignes directrices (§ 254) interprète largement la notion d'« évaluer les candidats » : tout scoring ou classement qui influence sensiblement une sélection. Notre défense tient à la **destination**, pas à la technique. Il faut donc verrouiller la destination dans les CGU, la documentation et l'interface.
3. **B2B ESN / portage — risque réel.** Si l'ESN utilise les scores pour **choisir quel consultant positionner** sur un appel d'offres, cela peut relever du 4(a) (sélection pour une mission) ou du 4(b) (allocation de tâches selon des caractéristiques personnelles, évaluation de la performance, cf. § 267-276 du projet). Le § 278 du projet exclut du haut risque les systèmes qui « only flag potential issues to the worker, not to the employer ». C'est un argument fort pour le **scénario B du §1.5** : les résultats restent réservés au consultant.
4. **Le profilage bloque l'art. 6(3).** Notre score de visibilité est vraisemblablement un profilage au sens RGPD. Si nous tombions dans l'Annexe III, la dérogation de l'art. 6(3) ne serait **pas** disponible. Toute la défense repose donc sur l'argument « hors Annexe III ».

**Position de travail** : l'usage B2C, côté candidat, est **hors haut risque**. Il faut quand même rédiger une **note de classification** interne sur le modèle de l'art. 6(4), même si nous nous estimons hors Annexe III, pour la tracer. L'usage B2B n'est acceptable **que** si les résultats restent réservés au consultant et si l'employeur n'en tire aucun classement.

### 2.3 Transparence — art. 50

- **Art. 50(1)** [Confirmé] : informer les personnes qu'elles interagissent avec une IA, sauf si c'est évident pour une personne raisonnablement informée. Cela s'applique si nous proposons un assistant conversationnel. Un bandeau « assistant IA » suffit. https://artificialintelligenceact.eu/article/50/
- **Art. 50(2)** [Confirmé] : les fournisseurs de systèmes qui génèrent du texte synthétique doivent marquer les sorties dans un format lisible par machine. Exception : fonction d'assistance à l'édition standard ou absence d'altération substantielle de l'entrée.
  - Nos suggestions de réécriture de profil **pourraient** relever de l'obligation de marquage. Elles pourraient aussi relever de l'exception d'édition standard si elles restent de simples reformulations du texte du client [Incertain].
  - La pertinence pratique est limitée : le freelance copie-colle le texte lui-même. **À trancher par le juriste**, et à suivre avec le code de bonnes pratiques de la Commission sur le marquage des contenus.
- **Art. 4 (maîtrise de l'IA)** : applicable depuis le 2/02/2025. L'Omnibus l'a assoupli : il faut « soutenir » la maîtrise de l'IA du personnel, sans garantir un niveau (voir 2.4).

### 2.4 Calendrier (vérifié au 18/09/2026)

| Date | Ce qui s'applique | Source |
|---|---|---|
| 1/08/2024 | Entrée en vigueur du Règl. 2024/1689 | https://eur-lex.europa.eu/eli/reg/2024/1689/oj (art. 113) |
| 2/02/2025 | Chap. I et II : définitions, maîtrise de l'IA (art. 4), pratiques interdites (art. 5) | idem, art. 113 |
| 2/08/2025 | Obligations des modèles GPAI, gouvernance, sanctions | idem |
| **2/08/2026** | Application générale, dont **l'art. 50 (transparence)** | idem. Maintenu par l'Omnibus : https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ |
| 2/12/2026 | Fin du délai de grâce art. 50(2) (marquage) pour les systèmes mis sur le marché avant le 2/08/2026 | https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/ |
| **2/12/2027** | Obligations **haut risque Annexe III** (dont l'emploi, point 4). Initialement prévu au 2/08/2026. | Omnibus, idem |
| 2/08/2028 | Haut risque Annexe I (produits réglementés). Initialement prévu au 2/08/2027. | idem |

**« Digital Omnibus on AI »** [Confirmé sur plusieurs sources ; texte EUR-Lex non lisible par l'outil] :

- C'est le **Règlement (UE) 2026/1744 du 8 juillet 2026**, publié au JO le 24/07/2026 et **entré en vigueur le 27/07/2026**.
- Accord politique le 6 ou 7/05/2026 (les sources divergent d'un jour). Vote du Parlement le 16/06/2026, adoption par le Conseil le 29/06/2026.
- Sources : EUR-Lex https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng ; synthèses https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/ et https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/
- **Selon artificialintelligenceact.eu, l'obligation d'enregistrement (art. 49(2)) des systèmes Annexe III jugés non à haut risque au titre de l'art. 6(3) est maintenue** [Incertain : à vérifier sur le texte officiel].
- **Lignes directrices de classification (art. 6(5))** : seul le projet du 19/05/2026 existe. La version finale n'a pas été trouvée [Incertain].

---

## 3. DPA et rétention des fournisseurs LLM

| Fournisseur | DPA (URL) | Rôle | Entraînement sur les données API | Rétention par défaut | ZDR (zéro rétention) | Transferts hors UE |
|---|---|---|---|---|---|---|
| **OpenAI** | https://openai.com/policies/data-processing-addendum/ (PDF : https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) | Sous-traitant. Entité EEE : OpenAI Ireland Ltd. DPA intégré au Services Agreement. | **Non** par défaut depuis le 1/03/2023 | Journaux anti-abus **30 j**. `/v1/responses` avec `store=true` : 30 j. Assistants et threads : jusqu'à suppression. | Sur approbation commerciale (ZDR / Modified Abuse Monitoring). **Résidence des données Europe** possible (`eu.api.openai.com`), sous conditions. | CCT dans le DPA. **Certification DPF d'OpenAI non vérifiée** (une source secondaire indique qu'elle n'existe pas) [Incertain]. |
| **Anthropic** | https://www.anthropic.com/legal/data-processing-addendum (en vigueur depuis le 24/02/2025) | Sous-traitant. Services UE fournis par Anthropic Ireland Ltd. DPA intégré aux Commercial Terms. | **Non** sans permission expresse | **Contradiction entre sources** [Incertain] : le Privacy Center (article du 1/07/2026) indique une suppression « within 30 days ». La documentation plateforme indique que le contenu des conversations « is not retained by default », sauf pour les « Covered Models » (rétention de 30 j obligatoire). Contenu signalé : jusqu'à 2 ans. | Sur demande commerciale, par organisation. Non disponible pour les « Covered Models », sauf autorisation. | CCT modules 2 et 3, addenda UK et Suisse. Préavis de 15 j pour les nouveaux sous-traitants. DPF : non vérifié [Incertain]. |
| **Google Gemini API** | Processor terms : https://business.safety.google/processorterms/ (référencés par https://ai.google.dev/gemini-api/terms, mis à jour le 28/04/2026) | Sous-traitant (**services payants uniquement**) | Gratuit : **oui**, avec relecture humaine possible (« Do not submit sensitive, confidential, or personal information to the Unpaid Services »). Payant : **non**. | Anti-abus : **55 j** (https://ai.google.dev/gemini-api/docs/usage-policies). Grounding Search : 30 j côté Google. | Non documenté dans les pages lues | Google LLC est réputée certifiée DPF (non vérifié ici). **Obligation de n'utiliser que les Paid Services pour servir des utilisateurs EEE, Suisse ou UK.** |
| **Perplexity (Sonar API)** | Via Trust Center : https://trust.perplexity.ai/ (DPA non lu) | À confirmer | **Non** (« do not train on any of your data ») | « zero day retention of user prompt data » (FAQ : https://docs.perplexity.ai/docs/resources/faq) | Oui par défaut selon la FAQ | **Non vérifié** : CGU API (https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service-search) inaccessibles (403) [Incertain] |

**Points d'attention critiques**

1. **Gemini, Grounding with Google Search** [Confirmé, CGU Gemini] : « You will not […] cache, frame, syndicate, resell, **analyze**, train on, or otherwise learn from Grounded Results ». Il est aussi interdit de suivre les interactions avec un résultat donné. **Notre cœur de produit (analyser si le client apparaît) est incompatible avec cette option.** N'utiliser Gemini **qu'en mode non-grounded**, ou faire valider par le juriste et/ou Google. https://ai.google.dev/gemini-api/terms
2. **Gemini gratuit : interdit** pour nous (clients EEE, et données personnelles envoyées).
3. **Politiques d'usage** :
   - Anthropic classe « resume screening, hiring tools, or other employment determinations » en **cas d'usage à haut risque**, avec validation humaine et information obligatoires (https://www.anthropic.com/legal/aup, en vigueur depuis le 15/09/2025).
   - OpenAI interdit l'« automation of high-stakes decisions in sensitive areas without human review », dont l'emploi (politique du 29/10/2025, https://openai.com/policies/usage-policies/ ; page non lisible (403), contenu confirmé par des sources secondaires).
   - Notre usage (mesure de visibilité côté candidat, sans décision) semble hors champ [Probable]. Il faut le **documenter**, car nos prompts ressemblent à des requêtes de recrutement.
4. **DPF et transferts** : le Tribunal de l'UE a validé le DPF (*Latombe*, T-553/23, 3/09/2025, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:62023TJ0553). Un **pourvoi est pendant (C-703/25 P)**. Prévoir les CCT en base, pas le seul DPF, et une analyse d'impact des transferts (TIA).
5. **Historique de rétention OpenAI** : l'ordonnance de conservation du litige NYT a pris fin pour les nouvelles données le 26/09/2025. Selon OpenAI, les données EEE, Suisse et UK n'y étaient pas soumises. https://openai.com/index/response-to-nyt-data-demands/ [Source primaire non relue en détail]
6. **Notre promesse « 7 jours »** ne couvre que notre stockage. Il faut indiquer dans la politique de confidentialité que les fournisseurs conservent de 0 à 55 jours selon le fournisseur, sauf ZDR.

---

## 4. CGU des plateformes et périmètre de nos conseils

### 4.1 LinkedIn — User Agreement (en vigueur depuis le 3/11/2025) — https://www.linkedin.com/legal/user-agreement

- **Exactitude** [Confirmé] :
  - § 3.1 : « the profile information you provide will be truthful ».
  - § 8.1.2 : fournir des informations d'identité exactes et utiliser son vrai nom.
  - § 3.6 : le contenu généré par IA « might be inaccurate […] Please review and edit such content before sharing ».
  - Le contenu doit respecter les Professional Community Policies, ce qui exclut les informations trompeuses.
- **Interdits** [Confirmé] :
  - § 8.2 : créer une fausse identité ou se faire passer pour quelqu'un d'autre ;
  - scraping ou copie des Services par logiciels, robots, crawlers ou extensions ;
  - § 8.2 : bots ou méthodes automatisées pour accéder aux Services, ajouter des contacts, envoyer des messages, commenter, liker, partager, ou générer de l'engagement inauthentique.

### 4.2 Malt — CGU (version du 16/04/2026) — https://www.malt.fr/legal

- **§ 7.1 « Cadre professionnel »** [Confirmé] : communiquer des « informations sincères, véritables et à jour ».
- **§ 12.1** : l'utilisateur assume seul les conséquences de toute information « incomplète, inexacte, ou trompeuse ».
- **§ 10.2 « Interdiction du scraping »** : toute extraction, collecte ou réutilisation des informations des pages Malt est interdite, « de manière automatisée **ou non** ».
- **§ 8** : l'algorithme de Malt tient compte de la complétude du profil, des critères du projet et de l'activité du freelance. C'est un levier légitime de conseil.

### 4.3 GitHub — Acceptable Use Policies — https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

- **§ 7 « Information Usage Restrictions »** [Confirmé] : interdiction d'utiliser l'information du Service (« scraped, collected through our API, or obtained otherwise ») pour du spam ou pour vendre des données personnelles, « such as to recruiters, headhunters, and job boards ».
- **§ 4** : interdiction des faux comptes, de l'« automated inauthentic activity » et de l'« automated excessive bulk activity ».

### 4.4 Ce que nous pouvons recommander / ce que nous devons interdire

| Nous pouvons recommander (le freelance applique lui-même) | Nous devons interdire, ne pas proposer ni outiller |
|---|---|
| Reformuler titre, résumé et compétences avec des faits **vérifiables** | Inventer des diplômes, clients, certifications, années d'expérience ou chiffres (LinkedIn § 3.1, Malt § 7.1) |
| Compléter les rubriques vides (levier de complétude de Malt, § 8) | Toute publication, connexion, message ou like **automatisé** (LinkedIn § 8.2) |
| Aligner le vocabulaire sur les offres ciblées | Scraper LinkedIn, Malt ou GitHub, y compris « à la main » chez Malt (§ 10.2), pour benchmarker les concurrents |
| Améliorer les README et la description des dépôts GitHub **du client** | Créer des faux comptes ou profils secondaires, faire du « stars farming » (GitHub § 4) |
| Relire la sortie IA avant publication (LinkedIn § 3.6) | Revendre ou partager des données de profils tiers, notamment à des recruteurs (GitHub § 7) |
| Rendre cohérentes les informations entre plateformes | Demander les identifiants des plateformes du client ou agir en son nom |

**Recommandation** : insérer dans nos CGU une **clause de véracité**. Le client garantit l'exactitude de ce qu'il publie, et nos suggestions sont des propositions à vérifier. Afficher un avertissement à chaque suggestion : « à publier seulement si c'est exact ».

---

## 5. Droit de la consommation (pré-vente B2C) et mentions obligatoires

### 5.1 Le freelance est-il un « consommateur » ?

- **Article liminaire** du Code de la consommation [Confirmé] : est consommateur « toute personne physique qui agit à des fins qui n'entrent pas dans le cadre de son activité commerciale, industrielle, artisanale, libérale ou agricole ». https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049464063
  - Un freelance qui achète un outil de visibilité **pour son activité** n'est donc pas consommateur en principe, et le droit de rétractation légal ne s'applique pas [Probable].
- **Extension aux petits professionnels (art. L221-3)** : elle ne vise que les contrats **conclus hors établissement**, pour un objet hors du champ de l'activité principale et avec 5 salariés au plus. **Une vente en ligne est un contrat à distance, pas hors établissement**, donc l'extension ne devrait pas s'appliquer [Probable]. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226882
- **Zone grise** : salariés portés (salariés au sens du Code du travail), salariés en transition vers le freelance, étudiants. **Recommandation** : appliquer le régime consommateur à toute personne physique qui achète sans SIRET. Plus simplement, l'appliquer à tous les acheteurs en B2C.

### 5.2 Droit de rétractation (si régime consommateur)

Section Légifrance L221-18 à L221-28 : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/

- **Délai de 14 jours** ; pour les services, il court **à compter de la conclusion du contrat** (L221-18) [Confirmé].
- **Prolongation de 12 mois** si l'information sur le droit de rétractation n'a pas été donnée (L221-20) [Confirmé].
- **Exécution pendant le délai** (L221-25) : il faut une **demande expresse** du consommateur. S'il se rétracte ensuite, il paie un montant **proportionné** au service déjà fourni [Confirmé].
- **Exception 1°** (L221-28, https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170) : services **pleinement exécutés** avant la fin du délai, avec accord préalable exprès **et** reconnaissance de la perte du droit de rétractation.
  - Cela peut s'appliquer à un **audit ponctuel livré** en quelques jours.
  - Cela **ne s'applique pas** à un abonnement SaaS, qui n'est pas « pleinement exécuté ». Il reste alors rétractable, avec paiement au prorata.
- **Exception 13°** (contenus numériques sans support matériel) : elle vise les *contenus* numériques. Notre service est plutôt un *service* numérique, et la qualification sera à confirmer [Incertain].
- **Pré-vente** : si le service n'est pas encore disponible, le délai de 14 jours court quand même depuis la commande, et aucun commencement d'exécution n'est possible. **Toute rétractation dans les 14 jours donne droit à un remboursement intégral.** Annoncer une date de mise à disposition. À défaut, le professionnel doit exécuter sans retard injustifié et au plus tard 30 jours après le contrat (art. L216-1 du Code de la consommation, https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565) [Probable : article non relu dans cette session, lien vers le code entier].
- **Parcours de commande** : case à cocher distincte « je demande l'exécution immédiate et reconnais perdre mon droit de rétractation une fois le service pleinement exécuté », puis confirmation sur support durable.

### 5.3 Mentions légales (LCEN) et informations commerciales

- **LCEN, art. 1-1** (dans sa version issue de la loi SREN n° 2024-449 du 21/05/2024 ; l'ancien art. 6-III a été restructuré) [Confirmé] :
  - personne morale : dénomination, siège, téléphone, capital, RCS ;
  - directeur de la publication ;
  - hébergeur (nom, adresse, téléphone).
  - Source : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164
- **LCEN, art. 19 (commerce électronique)** : identité, adresse, e-mail, téléphone, RCS, numéro de TVA, prix clairs (même source).
- **Médiation de la consommation** (si B2C) : obligation d'adhérer à un médiateur et de l'indiquer (Code de la consommation, L612-1 et s.) [Probable : non relu dans cette session].
- **Lien vers la plateforme européenne ODR** : **à supprimer**. La plateforme a été fermée le 20/07/2025 (Règl. (UE) 2024/3228, https://eur-lex.europa.eu/eli/reg/2024/3228/oj/eng).
- **CGV** :
  - B2C : informations précontractuelles (L111-1, L221-5), conditions de rétractation et formulaire type, garantie de conformité des contenus et services numériques.
  - B2B : conditions de paiement, pénalités de retard et indemnité forfaitaire de recouvrement (C. com. L441-1 et s.) [Probable : non relu dans cette session].

---

## 6. Actions concrètes proposées au produit (priorisées)

1. **P0** — Faire tourner le NER **avant toute persistance**, y compris pour les réponses brutes. Si des données brutes doivent être gardées : pseudonymisation par jeton et durée ≤ 7 j (idéalement 72 h).
2. **P0** — Ne jamais utiliser Gemini gratuit. Ne pas utiliser « Grounding with Google Search » (l'analyse des résultats est interdite).
3. **P0** — Signer ou accepter les DPA des 4 fournisseurs et les archiver. Demander la ZDR à OpenAI et Anthropic. Obtenir et lire le DPA Perplexity.
4. **P0** — B2B : opt-in individuel du consultant. Résultats réservés au consultant. Aucun classement remonté à l'employeur.
5. **P1** — AIPD, registre, note de mise en balance de l'intérêt légitime (LIA), note de classification AI Act (hors Annexe III, sur le modèle de l'art. 6(4)).
6. **P1** — Notice publique « personnes citées par les IA » (art. 14(5)(b)) et politique de confidentialité listant les sous-traitants et leurs durées de conservation.
7. **P1** — CGU : clause de véracité, liste des usages interdits (automatisation, scraping), destination « usage candidat uniquement ».
8. **P1** — CGV B2C : parcours de renonciation expresse et remboursement intégral en pré-vente. Mentions LCEN. Médiateur. Suppression du lien ODR.
9. **P2** — Mention « contenu généré par IA » sur les suggestions (art. 50). Politique interne de maîtrise de l'IA (art. 4).

---

## 7. Points à faire valider par un juriste

1. **Intérêt légitime pour les tiers** : la mise en balance est-elle suffisante avec un stockage brut chiffré de 7 j ? Ou faut-il imposer le NER avant tout stockage ? Quelle durée est défendable ?
2. **Art. 14(5)(b)** : un avis public suffit-il pour des tiers dont nous ne connaissons que le nom, cité par un LLM ? L'art. 11 s'articule-t-il avec les demandes d'accès et d'opposition après masquage ?
3. **AIPD** : confirmer qu'elle est obligatoire (critères CEPD et liste CNIL, entrées « RH » et « profilage à partir de sources externes »). Faut-il consulter la CNIL au préalable (art. 36) si le risque résiduel reste élevé ?
4. **Rôles RGPD en B2B** : lequel des scénarios A (sous-traitant de l'ESN) ou B (RT direct du consultant) retenir ? Contenu de l'accord art. 28 ou art. 26 (responsables conjoints ?) ; quelle base légale côté ESN et portage ; valeur de l'opt-in du salarié porté.
5. **AI Act — qualification hors Annexe III 4(a)** : la position peut-elle s'appuyer sur un **projet** de lignes directrices non définitif ? Faut-il vérifier la version finale si elle est publiée ? Quel est le risque de requalification en 4(a) ou 4(b) pour l'usage B2B ESN ?
6. **AI Act — art. 49(2) et art. 6(4)** : faut-il enregistrer ou documenter même si nous estimons ne pas être dans l'Annexe III ? Confirmer sur le texte officiel du Règl. (UE) 2026/1744 que l'obligation d'enregistrement est maintenue et à quelle date.
7. **AI Act — art. 50(2)** : nos suggestions de réécriture sont-elles soumises au marquage machine ou couvertes par l'exception « édition standard » ?
8. **Fournisseurs** : conflit entre sources sur la rétention par défaut d'Anthropic (30 j ou non-rétention) ; statut DPF d'OpenAI, d'Anthropic et de Perplexity ; contenu réel du DPA et des CGU API de Perplexity ; compatibilité de notre analyse avec les CGU Gemini (grounding) et avec les politiques d'usage emploi d'OpenAI et d'Anthropic.
9. **Transferts** : TIA pour les transferts vers les États-Unis. Conséquences d'une éventuelle invalidation du DPF (pourvoi C-703/25 P).
10. **Droit conso** : qualification (service numérique ou contenu numérique) ; régime de la pré-vente (date de livraison, remboursement) ; application du régime consommateur aux salariés portés ; obligations de médiation.
11. **CGU plateformes** : le fait de *conseiller* une optimisation de profil peut-il engager notre responsabilité (complicité, pratique commerciale trompeuse envers les recruteurs) si le client publie des informations inexactes ? Rédaction de la clause de véracité et de la limitation de responsabilité.
12. **Risques annexes** : diffamation ou dénigrement si nous montrions au client des tiers « concurrents » (actuellement exclu par design) ; propriété des sorties LLM et CGU des fournisseurs sur la réutilisation des outputs.

---

### Annexe — Sources consultées dans cette session

- RGPD : https://eur-lex.europa.eu/eli/reg/2016/679/oj · art. 14 (texte lu via https://gdpr-info.eu/art-14-gdpr/)
- CEPD : LD 1/2024 https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2024/guidelines-12024-processing-personal-data-based_en · LD 07/2020 https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en · LD 05/2020 https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en · Avis 28/2024 https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en
- CNIL : AIPD https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd · liste https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-aipd-requise.pdf · IA et information https://www.cnil.fr/fr/ia-informer-les-personnes-concernees · IA et intérêt légitime https://www.cnil.fr/fr/recommandations-developpement-ia-interet-legitime
- AI Act : https://eur-lex.europa.eu/eli/reg/2024/1689/oj · Omnibus https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng · projet de LD de classification https://digital-strategy.ec.europa.eu/en/library/draft-commission-guidelines-classification-high-risk-ai-systems
- Fournisseurs : OpenAI https://developers.openai.com/api/docs/guides/your-data · Anthropic https://platform.claude.com/docs/en/manage-claude/api-and-data-retention et https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data · Google https://ai.google.dev/gemini-api/terms · Perplexity https://docs.perplexity.ai/docs/resources/faq
- Plateformes : LinkedIn https://www.linkedin.com/legal/user-agreement · Malt https://www.malt.fr/legal · GitHub https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- Droit FR : Code conso section rétractation https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/ · LCEN https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164
