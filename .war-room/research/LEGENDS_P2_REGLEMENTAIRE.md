# LEGENDS P2 : cadre réglementaire pour Proofseen

Recherche du 2026-10-24. Périmètre : apport d'affaires, portage salarial, signature électronique, facturation électronique 2026, obligations fiscales des plateformes (DAC7, vigilance), séquestre, comptabilité.

Conventions de lecture :
- Chaque affirmation porte sa source (URL et ce qu'elle dit).
- **NON CONFIRMÉ** : point que je n'ai pas pu vérifier sur une source officielle pendant cette session. À faire valider par un avocat ou un expert-comptable avant d'en faire une règle produit.
- « Interprétation » : raisonnement de ma part à partir des textes, pas une règle écrite.
- Rien ici n'est un avis juridique. Le founder traite le juridique à la fin (CLAUDE.md) : ce document sert à concevoir le produit, pas à le bloquer.

Constat technique utile pour la suite : le paquet `packages/payments/src/stripe.ts` utilise le modèle Stripe « charges et virements séparés » (`/v1/transfers` avec `transfer_group` = identifiant du contrat, comptes destinataires en Accounts v2, capacité `stripe_balance.stripe_transfers`). Le paiement du client arrive donc sur le solde Stripe de la plateforme, puis la part du freelance lui est virée. Cela compte pour les sujets 6 et 7.

---

## 0. Corrections importantes par rapport à la commande

| Hypothèse de la commande | Ce que disent les sources |
|---|---|
| Seuil DAS2 de 1 200 EUR | **Relevé à 2 400 EUR par an et par bénéficiaire** pour les sommes versées depuis 2024 (déclarées en 2025). BOFiP ACTU-2024-00154 du 12/02/2025. |
| Sanction e-invoicing de 15 EUR par facture | **50 EUR par facture** non émise électroniquement (plafond 15 000 EUR/an), **500 EUR par transmission** d'e-reporting manquante, depuis la loi de finances 2026 (loi n° 2026-103 du 19/02/2026, art. 123). |
| « PDP » | Renommées **plateformes agréées (PA)**. Première liste de 101 PA publiée en janvier 2026, environ 137 selon des sources de juin à juillet 2026. |
| Yousign | La marque devient **Youtrust** (bannière « Yousign becomes Youtrust » sur la page tarifs API). Les URL d'API restent en `yousign.app`. |
| Obligation de réception au 1er septembre 2026 | Elle est **déjà en vigueur** à la date de ce rapport : Proofseen doit pouvoir recevoir ses factures fournisseurs françaises via une PA. |

---

## 1. Apporteur d'affaires

### 1.1 Règles

**Nature juridique : trois qualifications voisines.**
- **Agent commercial** (Code de commerce, art. L134-1, en vigueur depuis le 01/01/2023, ordonnance 2021-1189) : mandataire indépendant chargé **de façon permanente** de négocier, et éventuellement de conclure, des contrats au nom et pour le compte d'autres professionnels. Il « s'immatricule, sur sa déclaration, au registre spécial des agents commerciaux ». Source : https://www.legifrance.gouv.fr/codes/id/LEGIARTI000006220397/2026-08-05
- En fin de contrat, l'agent a droit à une **indemnité compensatrice d'ordre public** (art. L134-12), sauf faute grave (L134-13), et doit la réclamer dans l'année. Sources : fiche de la cour d'appel https://www.cours-appel.justice.fr/sites/default/files/2024-01/FICHE%20n%C2%B014%20-%20Agent%20commercial%202023MOD.pdf ; Cass. com. 4/12/2024 n° 23-19820 rapporté par https://www.actu-juridique.fr/breves/droit-commercial/agent-commercial-circonstances-de-rupture-du-contrat/
- **Apporteur d'affaires** : aucun statut légal propre. Il met en relation, ne négocie pas et n'engage pas la société ; sa mission se termine à la mise en relation ; pas d'indemnité de fin de contrat. Le juge n'est pas lié par le nom donné au contrat et peut le requalifier en agent commercial. Sources (secondaires) : https://www.creerentreprise.fr/apporteur-affaires-agent-commercial-difference/ et https://www.leblogdudirigeant.com/apporteur-daffaire-et-fiscalite/
- **Courtage** : le courtier rapproche des parties sans représenter l'une d'elles ; certains courtages sont réglementés (assurance, crédit). L'apport de missions de prestation intellectuelle ne relève d'aucun courtage réglementé à ma connaissance. **NON CONFIRMÉ** (aucune source officielle consultée sur ce point).

**Risque de requalification en salariat.** Une personne immatriculée (RCS, RNE, registre des agents commerciaux, URSSAF) est présumée non salariée, mais la présomption tombe si elle travaille dans un « lien de subordination juridique permanente » ; l'intention d'éluder les obligations d'employeur caractérise le travail dissimulé. Code du travail L8221-6 : https://code.travail.gouv.fr/code-du-travail/l8221-6

**Statut fiscal et social de l'apporteur.**
- Un apporteur immatriculé (micro-entrepreneur ou société) facture avec son SIRET. Source secondaire : https://www.socic.fr/ressources-comptabilite/articles/remunerer-apporteurs-affaires
- Un particulier non immatriculé qui touche une commission occasionnelle : imposable, en principe en BNC (art. 92 CGI, catégorie résiduelle), déclaré en « BNC non professionnels ». Les sources trouvées sont secondaires ; impots.gouv propose un rescrit pour trancher BIC ou BNC. **NON CONFIRMÉ sur source officielle pour le cas précis de l'apporteur occasionnel.** Sources : https://www.leblogdudirigeant.com/apporteur-daffaire-et-fiscalite/ ; page rescrit impots.gouv citée dans les résultats.
- Cotisations sociales : selon des sources secondaires, l'URSSAF n'assujettit pas une intervention **occasionnelle et modique** ; la fréquence, le montant et l'autonomie font basculer vers une activité professionnelle (donc obligation de s'immatriculer). **NON CONFIRMÉ sur urssaf.fr** (aucune page officielle trouvée). Source : https://www.socic.fr/ressources-comptabilite/articles/remunerer-apporteurs-affaires

**Déclaration DAS2 par le payeur (art. 240 CGI).**
- Toute personne qui verse, dans le cadre de sa profession, des commissions, courtages, ristournes, honoraires à des tiers doit les déclarer chaque année. Source : BOFiP BOI-BIC-DECLA-30-70-20 (résumé via https://bofip.impots.gouv.fr/node/362096).
- **Seuil : 2 400 EUR par an et par bénéficiaire** (doublé, contre 1 200 EUR auparavant), pour les rémunérations versées en 2024 et déclarées en 2025, et après. Source : https://bofip.impots.gouv.fr/bofip/14327-PGP.html/ACTU-2024-00154 et https://blog.avocats.deloitte.fr/relevement-des-seuils-de-declaration-das-2-et-de-declaration-des-droits-dauteurs/
- Sanction du défaut : amende de 50 % des sommes non déclarées (CGI art. 1736, I-1), rapportée par la recherche BOFiP. **NON CONFIRMÉ sur le texte consolidé.**
- Date limite de dépôt et éventuelles dispenses (par exemple pour des prestataires facturant avec TVA) : **NON CONFIRMÉ**.

**TVA sur la commission.**
- Apporteur assujetti : TVA à 20 % sur sa commission facturée à Proofseen ; Proofseen la déduit.
- Apporteur en franchise en base : pas de TVA, mention de franchise sur la facture. Seuils services 2026 : 37 500 EUR (base) et 41 250 EUR (majoré), la loi de finances 2026 n'ayant pas retenu le seuil unique de 25 000 EUR selon des sources secondaires. Sources : https://bpifrance-creation.fr/entrepreneur/actualites/plf-2026-franchise-base-tva-annoncee-a-37-500-eu et https://www.lecoindesentrepreneurs.fr/franchise-en-base-de-tva-nouvelles-regles-2026/ . **NON CONFIRMÉ sur impots.gouv** (site en maintenance lors de la recherche). Le changement de référence de la mention de franchise (art. 293 B CGI vers un article du CIBS en 2027) est **NON CONFIRMÉ** (source unique : https://abby.fr/guide/facturation-electronique/mentions-obligatoires-facture-electronique).
- Particulier occasionnel non immatriculé : pas de facture avec TVA en pratique ; Proofseen émet alors une note ou un relevé de commission. Interprétation, **NON CONFIRMÉ**.

**Transparence envers le client.**
- Code de la consommation L111-7 : l'opérateur de plateforme doit une information loyale, claire et transparente sur ses conditions, ses critères de classement et l'existence d'une relation contractuelle, d'un lien capitalistique ou d'une **rémunération qui influence le classement**. Le texte vise le **consommateur**. Décret 2017-1434 (articles D111-6 et suivants). Sources : https://cms.law/fr/fra/a-la-une/plates-formes-numeriques-la-start-up-nation-ne-se-fera-pas-au-detriment-des-consommateurs ; https://www.actu-juridique.fr/ntic-medias-presse/les-principales-dispositions-du-decret-n-2017-1434-du-29-septembre-2017-relatif-aux-obligations-dinformation-des-operateurs-de-plates-formes-numeriques/
- Règlement (UE) 2019/1150 (P2B) : protège les entreprises utilisatrices qui offrent des biens ou services **aux consommateurs** ; il ne s'applique pas aux relations B2C et son application à une plateforme purement B2B n'est pas tranchée par les sources. Source : https://cms.law/en/fra/publication/reglement-platform-to-business-et-operateurs-de-plateformes-en-ligne
- Interprétation : Proofseen est B2B (entreprises clientes, freelances professionnels). Aucune obligation légale **spécifique** de révéler au client la commission de l'apporteur n'a été trouvée (**NON CONFIRMÉ**). Mais la bonne foi contractuelle et surtout le risque de corruption privée (ci-dessous) rendent la transparence fortement recommandée.

**Anti-corruption.**
- Corruption privée : article 445-1 du Code pénal pour celui qui offre l'avantage (corruption active), article 445-2 pour le salarié ou dirigeant qui le sollicite ou l'accepte (corruption passive), en échange d'un acte de sa fonction. Peines rapportées : 5 ans et 500 000 EUR (montant à vérifier). Sources secondaires : https://www.cohengresser.com/pdfs/publications/Dossier_Sp%C3%A9cial_JSS_-_Pr%C3%A9sentation_des_diff%C3%A9rents_d%C3%A9lits_de_corruption_et_infractions_connexes.pdf ; https://www.cabinetaci.com/la-qualite-de-corrompue-infractions-jurisprudence-et-sanction . **NON CONFIRMÉ sur Légifrance** pour la numérotation et les peines.
- Sapin II, art. 17 : programme anticorruption obligatoire pour les sociétés d'au moins 500 salariés et plus de 100 M EUR de chiffre d'affaires, avec évaluation des intermédiaires et des tiers. Proofseen n'est pas assujettie aujourd'hui, mais ses **grands clients** le sont et évalueront Proofseen comme intermédiaire. Sources : https://www.leto.legal/guides/article-17-sapin-2-programme-anticorruption ; https://www.lexisnexis.com/fr-fr/glossaire/article-17-loi-sapin-2 . Le critère des 500 salariés n'est confirmé que par une source : **NON CONFIRMÉ** sur le texte.
- Cas critique : un **salarié de l'entreprise cliente** qui apporte la mission de son propre employeur et touche une commission. Le schéma ressemble trait pour trait à une rétrocommission : risque pénal pour lui (445-2) et pour celui qui paie (445-1), en plus d'un manquement à son obligation de loyauté envers son employeur. Interprétation.

### 1.2 Ce que la plateforme doit faire
1. Signer un **contrat d'apport d'affaires** écrit avant toute commission (clauses ci-dessous).
2. Payer l'apporteur **sur facture** (ou relevé si particulier), et cumuler les montants versés par bénéficiaire et par année civile pour la **DAS2** au-delà de 2 400 EUR.
3. Collecter l'identité fiscale de l'apporteur : nom, adresse, SIREN ou numéro fiscal, régime TVA, IBAN.
4. Exiger une **déclaration d'absence de conflit d'intérêts** : l'apporteur n'est ni salarié, ni dirigeant, ni mandataire de l'entreprise cliente, ou il produit l'accord écrit de cet employeur.
5. Informer le client, au moins dans les CGU et sur le devis, qu'une mission peut avoir été apportée par un tiers rémunéré par Proofseen.

### 1.3 Ce que la plateforme ne doit pas faire
- Ne pas donner à l'apporteur un pouvoir permanent de négocier ou de conclure au nom de Proofseen ou du freelance (sinon : agent commercial et indemnité de fin de contrat).
- Ne pas encadrer l'apporteur comme un salarié (objectifs imposés, horaires, reporting obligatoire, exclusivité totale) : risque L8221-6.
- Ne jamais payer de commission à un salarié ou dirigeant du client sans accord écrit de l'employeur. Recommandation : l'interdire par défaut.
- Ne pas faire payer la commission de l'apporteur par le freelance à son insu, ni la cacher dans le TJM affiché.

### 1.4 Clauses du contrat d'apport d'affaires (recommandées, pratique contractuelle)
Sources pratiques : https://www.legalstart.fr/fiches-pratiques/contrats-commerciaux/contrat-apporteur-affaires/ et https://www.creerentreprise.fr/statut-regime-apporteur-affaires-contrat/

| Clause | Recommandation pour Proofseen |
|---|---|
| Objet | Simple mise en relation entre Proofseen et une entreprise ayant un besoin de mission. Pas de négociation, pas de mandat. |
| Territoire et exclusivité | Pas d'exclusivité (renforce la qualification d'apporteur). |
| Identification de l'apport | Apport « horodaté » : l'apporteur déclare l'entreprise et le contact dans l'outil ; premier déclarant gagne ; entreprise déjà cliente ou déjà en discussion exclue. |
| Fait générateur | **Encaissement effectif** par Proofseen de sa commission sur la mission (pas la simple signature). |
| Assiette | Au choix du founder : un pourcentage de la commission Proofseen HT (le plus simple et le moins risqué), ou un pourcentage du montant HT de la mission. |
| Durée et missions renouvelées | Commission sur la mission initiale et ses renouvellements pendant N mois (par exemple 12) après la première facture, puis fin. À trancher par le founder. |
| Non-contournement | L'apporteur ne détourne pas la relation hors plateforme ; durée limitée, raisonnable. |
| Confidentialité | Sur les données du client et du freelance. |
| RGPD | L'apporteur déclare disposer d'une base légale pour transmettre les coordonnées du contact (intérêt légitime B2B), informe le contact ; Proofseen informe la personne au premier contact (RGPD art. 14). Interprétation à valider. |
| Conflit d'intérêts et anti-corruption | Déclaration sur l'honneur, interdiction de toute rétrocession à un salarié du client, droit d'audit, résiliation immédiate. |
| Statut | Apporteur indépendant, responsable de ses déclarations fiscales et sociales. |
| Facturation | L'apporteur facture Proofseen ; mentions et TVA selon son régime. |

### 1.5 Implications produit
- **Données** : `introducer` (identité, type particulier/entreprise, SIREN ou numéro fiscal, régime TVA, IBAN, contrat signé avec version et hash), `introduction` (entreprise apportée, contact, date de déclaration, statut : en attente, accepté, rejeté pour antériorité), `introducer_commission` (mission, assiette, taux, montant, date d'encaissement Proofseen, date de paiement, facture de l'apporteur).
- **Contrôles automatiques** : alerte si le domaine e-mail de l'apporteur égale le domaine du client ; blocage du paiement tant que la déclaration de conflit d'intérêts n'est pas signée ; compteur DAS2 annuel par bénéficiaire avec alerte à 2 400 EUR ; alerte « fréquence » (au-delà de N commissions par an pour un particulier, l'inviter à s'immatriculer).
- **Documents** : contrat d'apport (signature électronique simple suffit, voir sujet 3), relevé mensuel de commissions, export DAS2 annuel.
- **Flux d'argent** : la commission de l'apporteur sort de la commission Proofseen, après encaissement, par virement séparé. Elle ne passe jamais par le contrat client-freelance.

---

## 2. Portage salarial pour les freelances sans SIRET

### 2.1 Règles (Code du travail L1254-1 à L1254-31)
- **Conditions du salarié porté** (L1254-2, I) : il justifie d'une expertise, d'une qualification et d'une autonomie qui lui permettent de rechercher ses clients et de convenir des conditions et du prix. Source : https://code.travail.gouv.fr/code-du-travail/l1254-2
- **Rémunération minimale** (L1254-2, II) : fixée par accord de branche étendu ; à défaut, **75 % du plafond mensuel de la sécurité sociale** pour un temps plein. L'entreprise de portage n'est pas tenue de fournir du travail (III). Même source.
- **Convention collective** (IDCC 3219, 22 mars 2017) : 70 % (junior, moins de 3 ans), 75 % (senior), 85 % (forfait jours), minimum incluant salaire de base, congés payés et prime d'apport d'affaires. Sources secondaires : https://travail-industrie.com/outils/conventions-collectives/portage-salarial-remuneration-frais-droits-idcc-3219 et https://www.join-jump.com/guide/convention-collective . **Point NON CONFIRMÉ** : une source indique que la base est le plafond **2017** (3 269 EUR/mois), une autre applique le plafond **courant** ; l'extension d'un avenant de 2018 a été annulée par le Conseil d'État et l'avenant n° 12 du 20/12/2022 a un statut à vérifier. À contrôler sur la CCN consolidée (Légifrance).
- **PASS 2026** : **48 060 EUR** (PMSS 4 005 EUR, plafond journalier 220 EUR), arrêté du 22/12/2025 publié au JO du 23/12/2025. Sources : https://www.legisocial.fr/reperes-sociaux/plafond-securite-sociale-2026.html ; https://bpifrance-creation.fr/entrepreneur/actualites/plafonds-securite-sociale-2026 . Ordres de grandeur 2026 sur PMSS courant : 70 % = 2 803 EUR, 75 % = 3 004 EUR, 85 % = 3 404 EUR brut mensuel (calcul de travail-industrie.com).
- **Indemnité d'apport d'affaires** (L1254-9) : fixée par accord de branche ; à défaut 5 % de la rémunération due. https://code.travail.gouv.fr/code-du-travail/l1254-9
- **Recours par le client** (L1254-3) : seulement pour une tâche occasionnelle hors activité normale et permanente, ou une prestation ponctuelle nécessitant une expertise dont il ne dispose pas. https://code.travail.gouv.fr/code-du-travail/l1254-3
- **Interdits et durée** (L1254-4) : pas pour remplacer un salarié gréviste, pas pour certains travaux dangereux ; **durée de la prestation limitée à 36 mois**. https://code.travail.gouv.fr/code-du-travail/l1254-4
- **Services à la personne exclus** (L1254-5). https://code.travail.gouv.fr/code-du-travail/l1254-5
- **CDD** : écrit avec la mention « contrat de travail en portage salarial à durée déterminée » (L1254-14). https://code.travail.gouv.fr/code-du-travail/l1254-14
- **Contrat commercial de prestation de portage** (L1254-22) : conclu entre l'entreprise de portage et le client **au plus tard 2 jours ouvrables après le début** de la prestation, copie au porté dans le même délai. https://code.travail.gouv.fr/code-du-travail/l1254-22
- **Mentions de ce contrat** (L1254-23) : identité du porté ; ses compétences, qualifications et domaines d'expertise ; description de la prestation et modalités ; date de fin ou durée minimale ; prix convenu ; responsabilité du client sur les conditions de travail (santé, sécurité, durée) ; équipements de protection le cas échéant ; **identité du garant financier** ; **identité de l'assureur et numéro de police RC**. https://code.travail.gouv.fr/code-du-travail/l1254-23
- **Activité exclusive** (L1254-24) : « L'entreprise de portage salarial exerce à titre exclusif l'activité de portage salarial », et seule elle peut conclure des contrats de travail en portage. https://code.travail.gouv.fr/code-du-travail/l1254-24
- **Compte d'activité** (L1254-25) : tenu pour chaque porté, information **mensuelle** : sommes versées par le client, détail des frais de gestion, frais professionnels, prélèvements sociaux et fiscaux, rémunération nette, indemnité d'apport d'affaires. https://code.travail.gouv.fr/code-du-travail/l1254-25
- **Garantie financière** (L1254-26, L1254-27) : obligatoire en permanence, couvre salaires, indemnités et cotisations en cas de défaillance ; caution d'un organisme de garantie, assureur ou banque ; calculée en pourcentage de la masse salariale avec un minimum annuel ; l'activité ne peut commencer qu'après son obtention ; attestation URSSAF remise au client sur demande. https://code.travail.gouv.fr/code-du-travail/l1254-26 et https://code.travail.gouv.fr/code-du-travail/l1254-27 . Taux historiques de 8 % à 10 % de la masse salariale (10 % depuis 2018) d'après un ancien guide service-public ; montant minimal actuel **NON CONFIRMÉ**.
- **Déclaration préalable** à l'inspection du travail du siège, en deux exemplaires par LRAR, datée et signée par le représentant légal ; contenu listé à R1254-3. https://code.travail.gouv.fr/code-du-travail/r1254-4 et https://code.travail.gouv.fr/code-du-travail/r1254-3
- **Médecine du travail** à la charge de l'entreprise de portage (L1254-28).
- **Frais de gestion** : 5 à 10 % du chiffre d'affaires selon des sources secondaires, parfois forfait mensuel. https://travail-industrie.com/outils/conventions-collectives/portage-salarial-remuneration-frais-droits-idcc-3219 ; forum Free-Work https://www.free-work.com/fr/tech-it/forum/t/portage-salariale-1 . Réserve financière de 10 % en CDI selon les mêmes sources.

### 2.2 Ekigai ou Proofseen peuvent-elles faire du portage ?
**Non, en l'état.** L1254-24 impose l'**exclusivité** de l'activité de portage et réserve les contrats de portage aux seules entreprises de portage. Une société qui exploite une marketplace (ou toute autre activité) ne remplit pas cette condition. Il faudrait en plus la garantie financière (L1254-27), la déclaration préalable (R1254-3, R1254-4), l'application de la CCN IDCC 3219, la paie et la médecine du travail. La seule voie « interne » serait une **filiale dédiée exclusivement au portage**, avec ces conditions remplies. Interprétation directe des textes cités.

### 2.3 Comment font Malt et Free-Work
- **Malt** : le freelance choisit ou invite sa société de portage depuis ses réglages ; la société de portage s'inscrit comme telle avec son SIRET, son adresse et ses contacts ; les fonds sont versés sur le compte bancaire de la société de portage, qui paie le salaire. Malt sépare « portage commercial » et « portage salarial ». Malt ne se présente pas comme société de portage. Sources : https://help.malt.com/hc/fr/articles/33568385975058-Comment-fonctionne-le-portage-salarial-sur-Malt et https://help.malt.com/hc/fr/articles/29515330048786-Inscription-en-tant-que-soci%C3%A9t%C3%A9-de-portage-SCOP-SCIC-Couveuse-d-entreprise (contenu lu via les extraits du moteur, pages inaccessibles en lecture directe : à relire à la main). Liste des partenaires et tarifs : **NON CONFIRMÉ**.
- **Free-Work** : aucune offre de portage propre trouvée ; le forum indique qu'il n'existe pas de classement officiel des sociétés de portage. **NON CONFIRMÉ** au-delà.

### 2.4 Ce que la plateforme doit faire
- Proposer un statut « freelance porté » où **le cocontractant juridique et le bénéficiaire du paiement est la société de portage**, pas le freelance.
- Collecter auprès de la société de portage : SIREN, attestation de garantie financière (nom du garant), attestation d'assurance RC (assureur, numéro de police), attestation de vigilance URSSAF, preuve de la déclaration préalable si possible.
- Fournir à la société de portage, dès l'acceptation de la mission, les éléments du contrat commercial (L1254-23) pour qu'elle le signe avec le client dans les 2 jours ouvrables.

### 2.5 Ce que la plateforme ne doit pas faire
- Ne pas signer de contrat de travail de portage, ne pas émettre de bulletin de paie, ne pas tenir le compte d'activité : ce sont des actes de l'entreprise de portage.
- Ne pas laisser une mission en portage dépasser 36 mois, ni l'ouvrir aux services à la personne.
- Ne pas vendre le portage comme « sans risque » ou « garanti » (règle maison : aucune promesse de résultat).

### 2.6 Documents (qui les produit)
| Document | Émetteur | Rôle de Proofseen |
|---|---|---|
| Convention d'adhésion (terme de pratique, non légal : **NON CONFIRMÉ** comme obligation) | Société de portage | Lien vers le partenaire |
| Contrat de travail CDD ou CDI en portage | Société de portage | Aucun, sauf transmission des données de mission |
| Contrat commercial de prestation de portage (L1254-22, L1254-23) | Société de portage et client | Pré-remplissage à partir du contrat de mission Proofseen |
| Compte d'activité mensuel (L1254-25) | Société de portage | Aucun |
| Bulletins de salaire | Société de portage | Aucun |
| Facture au client | Société de portage (ou Proofseen par mandat de facturation) | Voir sujet 4 |

### 2.7 Implications produit
- Champ `legal_form` du freelance : `company`, `micro`, `umbrella` (portage). Si `umbrella` : `umbrella_company_id` obligatoire, compte Stripe destinataire **au nom de la société de portage**.
- Contrôles : date de début de prestation et compteur de 36 mois par couple porté-client ; garde-fou TJM minimum pour atteindre la rémunération minimale de branche (calcul indicatif, affiché comme tel) ; catégorie de mission exclue (services à la personne).
- Partenariat : choisir 1 à 3 sociétés de portage (vérifier garantie financière et attestation de vigilance), contrat de partenariat écrit, sans rémunération cachée pour Proofseen.

---

## 3. Signature électronique

### 3.1 Règles
- **eIDAS** (règlement (UE) 910/2014) : trois niveaux. Simple : ne peut être rejetée au seul motif qu'elle est électronique (art. 25.1), sans présomption. **Avancée** (art. 26) : liée au signataire de manière univoque, permet de l'identifier, créée avec des moyens sous son contrôle exclusif, détecte toute modification ultérieure. **Qualifiée** : avancée + dispositif qualifié + certificat qualifié d'un prestataire qualifié ; effet équivalent à la signature manuscrite (art. 25.2). Sources : https://www.legiscope.com/blog/signature-electronique-eidas.html ; https://certyneo.com/en/guide/eidas . Texte primaire : https://eur-lex.europa.eu/eli/reg/2014/910/oj (non relu dans cette session).
- **eIDAS 2** (règlement (UE) 2024/1183) : modifie le 910/2014, crée le portefeuille européen d'identité numérique ; en vigueur depuis le 20/05/2024 (publication au JO UE : 30/04/2024 selon la majorité des sources). Source : https://certyneo.com/en/guide/eidas . L'ANSSI indique que ses référentiels actuels restent applicables en attendant les actes d'exécution d'eIDAS 2 : https://cyber.gouv.fr/reglementation/reglementation-identite-confiance-numerique/securite-echanges-voie-electronique/reglement-eidas/referentiels-dexigences/
- **Code civil 1366** : l'écrit électronique a la même force probante que le papier si l'auteur est dûment identifié et l'intégrité garantie. **1367** : la fiabilité du procédé est **présumée** seulement pour la signature **qualifiée** (décret 2017-1416). Pour les autres niveaux, c'est à celui qui s'en prévaut de prouver la fiabilité (d'où le fichier de preuve). Sources : https://www.centre-inffo.fr/site-droit-formation/actualites-droit/signature-electronique ; https://affairesjuridiques.aphp.fr/textes/decret-n-2017-1416-du-28-septembre-2017-relatif-a-la-signature-electronique/
- **Contrat de travail** : peut être établi, signé et conservé électroniquement, chaque partie devant y avoir accès sur support durable. Une signature manuscrite **scannée** n'est pas une signature électronique au sens de 1367, mais a été admise si l'auteur est identifiable et habilité (Cass. soc. 14/12/2022, n° 21-19.841). Le CDD sans écrit signé par les deux parties est requalifié en CDI. Sources : https://www.legisocial.fr/actualites-sociales/5650-cour-cassation-valide-signature-manuscrite-numerisee-cdd.html ; https://cms.law/en/fra/legal-updates/cdd-peut-on-utiliser-une-signature-numerisee ; https://open.lefebvre-dalloz.fr/actualites/droit-social/apposer-contrat-travail-signature-numerisee-gerant-vaut-absence-signature_f58ff512a-3cfc-44d5-a83a-829bf72f19e6
- **Horodatage qualifié** : effets juridiques de l'article 41 eIDAS (présomption d'exactitude de la date et d'intégrité). Critères ANSSI : https://cyber.gouv.fr/sites/default/files/2022-09/eidas_horodatage-qualifie_v1.1_anssi.pdf ; liste nationale de confiance : https://cyber.gouv.fr/les-services-de-confiance

### 3.2 Niveau adapté par document (interprétation)
| Document | Niveau recommandé | Raison |
|---|---|---|
| Contrat de prestation B2B client-freelance | Simple avec fichier de preuve solide, avancée en option | Entre commerçants, la preuve est libre (Code de commerce L110-3, **non relu dans cette session**) ; aucune forme imposée. |
| NDA | Simple | Pas de forme imposée. |
| Contrat d'apport d'affaires | Simple | Idem. |
| Mandat de facturation (sujet 4) | Simple | Accord préalable exigé, pas de forme particulière trouvée. |
| Contrat de travail de portage (CDD) | Avancée au minimum, conseillée | Écrit obligatoire, enjeu de requalification ; signé par la société de portage, pas par Proofseen. |
| Contrat commercial de portage | Simple ou avancée | Produit par la société de portage. |

### 3.3 Fichier de preuve à constituer (signature simple maison)
Données à stocker par signature : empreinte **SHA-256** du PDF exact présenté ; version du document ; identité déclarée et compte authentifié ; e-mail et **OTP** envoyé (horodatage d'envoi, de saisie, nombre d'essais) ; adresse IP et user-agent ; horodatage serveur ; **jeton d'horodatage RFC 3161** d'un prestataire qualifié sur l'empreinte du document signé et du journal ; journal d'audit chaîné (chaque événement contient l'empreinte du précédent) ; PDF final scellé avec la page de preuve ; conservation sur support durable et remise d'une copie à chaque partie. Interprétation fondée sur 1366 (identification et intégrité) ; aucun référentiel officiel du « dossier de preuve » pour la signature simple n'a été consulté : **NON CONFIRMÉ** comme liste exhaustive.

### 3.4 Construire ou acheter
- **Construisible en interne** : signature simple avec OTP e-mail ou SMS, empreinte, journal d'audit, page de preuve, archivage.
- **À acheter** : jeton d'horodatage qualifié (prestataire inscrit sur la liste de confiance), signature avancée fondée sur un certificat après vérification d'identité, signature qualifiée, cachet électronique qualifié (utile aussi pour les factures : service-public cite le cachet qualifié pour garantir origine et intégrité, https://entreprendre.service-public.gouv.fr/actualites/A15683).

### 3.5 Fournisseurs (prix publics seulement)
| Fournisseur | API et bac à sable | Prix publics trouvés |
|---|---|---|
| **Yousign, devenu Youtrust** | API v3 ; sandbox `https://api-sandbox.yousign.app/v3`, production `https://api.yousign.app/v3` ; essai gratuit 40 jours ; signatures sandbox sans valeur juridique, filigranées ; limites 30 requêtes/min et 200/h ; tests E2E automatisés déconseillés (mocker). https://developers.youtrust.com/docs/environments-new | Plus : à partir de 104 EUR HT/mois (1 248 EUR/an), Pro : à partir de 129 EUR HT/mois (1 548 EUR/an), 500 signatures simples/an incluses, 2,00 EUR par signature au-delà ; simple, avancée et qualifiée sur les deux ; cachet électronique sur Pro. https://youtrust.com/pricing-api |
| **Docusign** | Compte développeur gratuit, environnement démo sans expiration, enveloppes sans valeur légale ; production via plan payant et processus « go-live ». https://ecom.docusign.com/plans-and-pricing/developer | Prix API officiels **NON CONFIRMÉ** (seule une source concurrente donne 75 à 720 USD/mois). |
| **Universign** | API ; prestataire de confiance qualifié eIDAS ; horodatage qualifié par API (cas client). | Packs de 25 à 100 transactions de 119 à 389 EUR HT selon un comparatif ancien : **NON CONFIRMÉ**. https://tool-advisor.fr/signature-electronique/comparatif/universign/ |
| **Lex Persona** | Abonnement Lex Enterprise avec clé API ; se déclare qualifié pour l'horodatage (ETSI EN 319 421) et les certificats ; décision ANSSI d'avril 2025 qualifiant son service de certificats « SUNNYSTAMP NATURAL PERSONS CA ». https://cyber.gouv.fr/sites/default/files/decisions-qualifications/2025_693_np.pdf | **NON CONFIRMÉ**. |

### 3.6 Implications produit
- Tables : `signature_request`, `signature_event` (journal chaîné), `signature_evidence` (hash, OTP, IP, UA, jeton TSA, PDF scellé).
- Choix recommandé : signature simple maison + jeton d'horodatage qualifié acheté pour les contrats B2B, NDA, apport, mandat de facturation ; API Youtrust (avancée) en option pour les clients grands comptes qui l'exigent.
- Ne pas présenter la signature simple maison comme « qualifiée » ou « eIDAS qualifiée ».

---

## 4. Facturation électronique 2026

### 4.1 Règles
- **Textes** : ordonnance 2021-1190 du 15/09/2021 ; décret 2022-1299 du 07/10/2022 ; loi de finances 2023 art. 62 ; **loi de finances 2024 (loi 2023-1322) art. 91** ; décret 2024-266 du 25/03/2024 ; loi de finances 2026 (loi 2026-103 du 19/02/2026) art. 123 pour les sanctions ; CGI art. 289 bis, 290, 290 A. Sources : https://entreprendre.service-public.gouv.fr/actualites/A15683 ; https://entreprendre.service-public.gouv.fr/actualites/A18802 ; https://demarche.numerique.gouv.fr/commencer/immatpdp
- **Calendrier** : réception obligatoire pour toutes les entreprises au **1er septembre 2026** ; émission et e-reporting au 1er septembre 2026 pour grandes entreprises et ETI, **1er septembre 2027** pour PME et micro-entreprises. Champ : opérations entre assujettis établis en France, livraisons et prestations situées en France non exonérées, acomptes inclus. Source : https://entreprendre.service-public.gouv.fr/actualites/A15683
- **Plateformes agréées (ex-PDP)** : toutes les factures transitent par une plateforme agréée par l'État, directement ou via une « solution compatible » ; chaque entreprise désigne sa plateforme. Même source. Première liste de 101 PA publiée le 22/01/2026 (https://bpifrance-creation.fr/entrepreneur/actualites/facturation-electronique-liste-plateformes-agreees), 137 selon des sources de juin à juillet 2026 (https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/liste-des-pdp). Liste officielle : impots.gouv.fr (rubrique « Facturation électronique et plateformes agréées ») et jeu de données sur data.gouv.fr. Certaines immatriculations sont « sous réserve » de tests d'interopérabilité.
- **PPF** : n'est plus une plateforme gratuite d'échange depuis la décision d'octobre 2024 ; il garde l'**annuaire** central et le rôle de **concentrateur** des données vers l'administration. Source secondaire : https://www.fiducial.fr/facturation-electronique/glossaire/portail-public-de-facturation
- **Formats** : Factur-X, UBL, CII (sources secondaires concordantes, par exemple https://www.tiime.fr/blog/autofacturation-et-facturation-electronique). Service-public ne précise pas les formats.
- **E-reporting** : données de transaction pour le B2C (agrégées par jour et par taux, sans donnée nominative) et le B2B international ; données de **paiement** pour les prestations de services dont la TVA est exigible à l'encaissement (sauf option sur les débits). Sources secondaires : https://www.mooncard.co/fr/blog/e-reporting-donnees-frequence-canal ; https://cms.law/en/media/local/cms-fl/files/other/e-reporting-des-donnees-des-transations-pour-les-entreprises . Fréquences exactes : **NON CONFIRMÉ** sur source officielle.
- **Nouvelles mentions obligatoires** (service-public) : SIREN du client ; adresse de livraison si différente ; nature des opérations (biens, services, ou les deux) ; « Option pour le paiement de la taxe d'après les débits » le cas échéant. Applicables au 01/09/2026 (GE, ETI) et au 01/09/2027 (PME, micro). Sources : https://entreprendre.service-public.gouv.fr/vosdroits/F31808 et A15683. L'« adresse électronique de facturation » comme mention est **NON CONFIRMÉ**.
- **Sanctions** (LF 2026) : 50 EUR par facture non émise électroniquement (plafond 15 000 EUR/an) ; défaut de PA : mise en demeure de 3 mois puis 500 EUR, puis 1 000 EUR par trimestre ; 500 EUR par transmission d'e-reporting manquante (plafond 15 000 EUR/an) ; pas de sanction pour une première infraction réparée spontanément ou dans les 30 jours. Source : https://entreprendre.service-public.gouv.fr/actualites/A18802 . Le « gel des sanctions en 2026 » évoqué par un blog est **NON CONFIRMÉ**.
- **Conservation** : 6 ans pour les factures électroniques. Source : A15683.
- **Autofacturation et mandat de facturation** (CGI art. 289, I-2) : la facture peut être émise par le client ou par un tiers mandaté, au nom et pour le compte du fournisseur, sous réserve d'un **accord préalable** et de l'**acceptation de chaque facture** par le fournisseur (acceptation tacite possible si le mandat prévoit un délai de contestation). Le fournisseur reste responsable de ses obligations. La facture émise sous mandat transite par une PA. Sources : https://www.tiime.fr/blog/autofacturation-et-facturation-electronique (éditeur) ; BOFiP BOI-TVA-DECLA-30-20-10 (version 2013 citée dans les résultats). Codes de « cadre de facturation » pour l'autofacturation : **NON CONFIRMÉ**.

### 4.2 Devenir plateforme agréée : conditions
Démarche officielle https://demarche.numerique.gouv.fr/commencer/immatpdp : immatriculation de **3 ans renouvelable** (décret 2022-1299), documentation RGPD complète, **attestation ISO/IEC 27001 en cours de validité** (CGI ann. II art. 242 nonies B, I, 5°), description de l'authentification, description technique des flux d'émission, réception et transmission des données, protocole sécurisé, attestation de régularité fiscale de moins de 3 mois, comptes rendus de tests d'interopérabilité, et, pour l'hébergeur, une preuve de qualification **SecNumCloud** (pièce marquée « optionnelle » sur la démarche). Interprétation : hors de portée de Proofseen à court terme (ISO 27001 à elle seule est un projet de plusieurs mois). Proofseen doit être **« solution compatible »** connectée à une PA.

### 4.3 Ce que la plateforme doit faire
1. **Dès maintenant** : désigner une PA pour **recevoir** les factures adressées à la société qui exploite Proofseen (obligation en vigueur depuis le 01/09/2026).
2. Avant le 01/09/2027 (si la société est une PME) : **émettre** ses factures de commission en format structuré via cette PA, avec les 4 nouvelles mentions, et faire l'e-reporting (paiements des prestations de services encaissées, clients étrangers).
3. Si Proofseen émet les factures **des freelances** : mandat de facturation signé par chaque freelance, acceptation de chaque facture (explicite ou tacite avec délai), émission via une PA, conservation de la preuve d'acceptation. Les freelances micro-entrepreneurs ont l'obligation d'émission au 01/09/2027.
4. Garder la production CII actuelle comme format pivot, l'envoyer à la PA par son API, et lire l'annuaire (via la PA) pour router la facture vers la PA du client.

### 4.4 Ce que la plateforme ne doit pas faire
- Ne pas envoyer directement par e-mail une facture B2B domestique comme « facture électronique » une fois l'obligation applicable à l'émetteur : elle doit passer par une PA.
- Ne pas émettre de facture au nom d'un freelance sans mandat préalable ni sans circuit d'acceptation.
- Ne pas se dire « plateforme agréée » ni utiliser le logo officiel.

### 4.5 Implications produit
- Données à stocker sur chaque partie : SIREN (client et fournisseur), numéro de TVA, adresse, identifiant d'annuaire ou de routage, PA désignée ; sur chaque facture : catégorie d'opération (`PS` pour Proofseen), option TVA sur les débits (oui ou non), statut de cycle de vie renvoyé par la PA (déposée, reçue, acceptée, refusée, encaissée).
- Table `billing_mandate` : freelance, version, date de signature, délai de contestation, révocation.
- Flux d'acceptation : chaque facture sous mandat est soumise au freelance, acceptée tacitement à J+N si aucune contestation (N fixé dans le mandat).
- Sélection d'une PA : vérifier sa présence sur la liste officielle (impots.gouv, data.gouv), son immatriculation définitive, son API (envoi CII, statut, annuaire, e-reporting). Pennylane se déclare PA immatriculée définitivement depuis décembre 2025 (déclaration de l'éditeur, à confirmer sur la liste). Autres noms : **NON CONFIRMÉ**.

---

## 5. Obligations fiscales des plateformes

### 5.1 DAC7 (directive (UE) 2021/514, CGI art. 1649 ter A à 1649 ter E)
- **Textes** : décret 2022-1661 du 26/12/2022 (ann. III CGI, art. 344 G duodecies et suivants), arrêté du même jour, BOFiP BOI-INT-AEA-30 du 11/01/2023. Source : https://blog.avocats.deloitte.fr/dac7-les-obligations-declaratives-des-operateurs-de-plateformes-precisees-par-decret-et-arrete-et-commentees-au-bofip/
- **Champ** : les « services personnels » (toute prestation de services, dont celles des freelances) sont des activités déclarables. Même source.
- **Vendeurs exclus** : entités publiques, sociétés cotées et liées, hôtels et assimilés, et pour la **vente de biens seulement**, les vendeurs à moins de 30 ventes et au plus 2 000 EUR. **Aucun seuil de minimis pour les services** : chaque freelance actif est déclarable. Sources : Deloitte ci-dessus ; https://cm.twobirds.com/en/insights/2021/belgium/belgium-dac7-reporting-obligations-for-digital-platform-operators
- **Données à collecter** : personne physique : nom, prénom, **date de naissance**, adresse principale, **NIF**, numéro de TVA le cas échéant. Entité : raison sociale, adresse du siège, numéro d'immatriculation, NIF, TVA, **établissements stables** dans l'UE. Plus : **IBAN** du compte de versement et nom du titulaire s'il diffère du vendeur ; pays de résidence. Source : Deloitte.
- **À déclarer** : par vendeur et **par trimestre**, la contrepartie versée **nette** des frais, commissions et taxes retenus, le nombre d'opérations, les frais et commissions séparément. Source : Deloitte.
- **Échéances** : déclaration avant le **31 janvier** de l'année suivante ; même date pour **informer chaque vendeur** des données déclarées. Pour l'activité 2026 : le 31/01/2027. Source : Deloitte.
- **Diligences** : vérifier la fiabilité des données, déterminer la résidence, tenir un registre des diligences ; possibilité de fermer le compte d'un vendeur qui ne répond pas après relances. Source : Deloitte.
- **Sanctions** : amende jusqu'à 50 000 EUR selon Deloitte ; montant exact et unité (par déclaration ou par manquement) **NON CONFIRMÉ**. Durée de conservation des registres : **NON CONFIRMÉ**.
- **Article 242 bis CGI** : l'obligation d'informer le vendeur, à chaque transaction, de ses obligations fiscales et sociales demeure ; elle est réputée satisfaite par des liens hypertextes systématiques et lisibles vers les sites des administrations ; la déclaration annuelle des montants relève désormais de DAC7 depuis 2024. Sources : https://bofip.impots.gouv.fr/bofip/11791-PGP.html ; https://kpmg.com/av/fr/avocats/eclairages/2023/02/preparation-des-operateurs-de-plateforme-a-dac-7.html

### 5.2 Obligation de vigilance (Code du travail L8222-1, R8222-1, D8222-5)
- Seuil : contrat d'au moins **5 000 EUR HT** (R8222-1). https://code.travail.gouv.fr/code-du-travail/r8222-1
- Le donneur d'ordre obtient du cocontractant, **à la conclusion puis tous les six mois** jusqu'à la fin : l'**attestation de vigilance** URSSAF de moins de 6 mois, dont il **vérifie l'authenticité** auprès de l'organisme, et une preuve d'immatriculation (Kbis, extrait RNE, ou document professionnel portant le numéro). https://code.travail.gouv.fr/code-du-travail/d8222-5
- Sanction : solidarité financière du donneur d'ordre pour les dettes sociales du cocontractant en cas de travail dissimulé (L8222-2). Source secondaire : https://cms.law/fr/fra/a-la-une/sous-traitance-l-attestation-de-vigilance-de-l-urssaf-est-indispensable
- Vérification : par le **code de sécurité** de l'attestation sur urssaf.fr (formulaire web). Aucune API publique pour les entreprises privées trouvée : **NON CONFIRMÉ**.
- Qui est obligé : le **donneur d'ordre**, donc l'entreprise cliente quand elle contracte directement avec le freelance. Proofseen est obligée pour les contrats où elle est elle-même cocontractante (apporteurs, partenaires). Interprétation.

### 5.3 Ce que la plateforme doit faire
- Collecter les données DAC7 **à l'inscription** du freelance, bloquer les virements au-delà d'un délai si elles manquent (après relances).
- Produire le fichier DAC7 annuel et le relevé envoyé à chaque freelance avant le 31 janvier.
- Afficher à chaque transaction le lien vers impots.gouv et urssaf.fr (242 bis).
- Offrir au client un **coffre de vigilance** : collecte de l'attestation à la signature si le contrat atteint 5 000 EUR HT (cumul des avenants), relance automatique à J+150, blocage ou alerte à J+180, stockage du code de sécurité et de la date de vérification.

### 5.4 Ce que la plateforme ne doit pas faire
- Ne pas déclarer la vérification URSSAF comme faite si elle n'a pas été faite sur urssaf.fr.
- Ne pas utiliser les données DAC7 (date de naissance, NIF) à d'autres fins (RGPD, minimisation, art. 1649 ter D renvoie à la loi Informatique et libertés).

### 5.5 Implications produit
- Table `tax_profile` : type (personne physique ou entité), nom, date de naissance, adresse, NIF, TVA, SIREN, pays de résidence, établissements stables, IBAN de versement, titulaire, statut de diligence, historique des relances.
- Agrégat trimestriel par freelance : montant versé net de la commission Proofseen, nombre de missions payées, commissions retenues.
- Table `vigilance_document` : contrat, type (attestation URSSAF, Kbis), date d'émission, date de vérification, code de sécurité, auteur de la vérification, échéance.

---

## 6. Séquestre : Proofseen peut-elle détenir les fonds ?
- L'encaissement pour compte de tiers est analysé par l'ACPR comme des **services de paiement** (acquisition d'opérations de paiement et exécution de virements sur un compte de paiement, CMF L314-1, II) qui exigent un agrément ou une exemption. Source : https://acpr.banque-france.fr/system/files/import/acpr/medias/documents/sb-21-1.pdf (résumé par le moteur) et https://www.revue-banque.fr/binrepository/0000000000000000000_RB00890_MG108086548.pdf
- L'exclusion « agent commercial » de la DSP2 (directive 2015/2366, art. 3, b) ne vaut que si l'agent agit pour le compte **du seul payeur ou du seul bénéficiaire** : une marketplace qui agit pour les deux n'en bénéficie pas. Interprétation stricte de l'ACPR confirmée par la DSP2. Sources : mêmes revues.
- **Avec Stripe Connect** : l'entité régulée est Stripe Technology Europe Ltd (établissement de monnaie électronique agréé par la Banque centrale d'Irlande, passeporté en France) ; la plateforme ne reçoit ni ne contrôle les fonds, elle ne fait que donner des instructions préalables (virements vers les comptes connectés) autorisées par chaque compte connecté ; le modèle « charges et virements séparés » est couvert. En France, la plateforme doit utiliser des « account tokens » pour ne pas être vue comme intermédiaire (IOBSP) et ne pas être rémunérée pour l'ouverture des comptes. Source : https://stripe.com/guides/frequently-asked-questions-about-stripe-connect-and-psd2 . Les projets DSP3 et RSP devraient resserrer ces exemptions selon Stripe.
- **Ce que Proofseen ne doit pas faire** : encaisser sur son propre compte bancaire l'argent du client pour le reverser au freelance ; présenter son service comme un « séquestre » au sens juridique ou garantir une « restitution » qu'elle ne maîtrise pas ; décider seule, sans règle contractuelle préalable, de bloquer ou de libérer les fonds. Interprétation : le terme « EscrowPayment » du code peut rester interne, mais le libellé client devrait être « paiement sécurisé par Stripe, versé au freelance à la validation » avec des règles de libération écrites dans les CGU.

---

## 7. Comptabilité de la plateforme

### 7.1 Règles
- **Chiffre d'affaires d'un intermédiaire** : le règlement ANC 2022-06 (PCG applicable aux exercices ouverts depuis le 01/01/2025) recodifie les articles sur les produits (521-1 à 521-3) et précise le fait générateur d'une intermédiation. Source : https://formation.lefebvre-dalloz.fr/actualite/le-reglement-anc-2022-06-analyse-par-pascal-renou-expert-comptable-et-commissaire-aux-comptes . Le critère précis « agent ou principal » (CA = commission seule) : **NON CONFIRMÉ** sur le texte ; c'est la pratique usuelle d'un mandataire.
- **Compte 467** : tiers qui ne sont ni clients ni fournisseurs ; les sommes perçues pour le compte d'autrui ne sont pas du chiffre d'affaires et y sont logées. Sources : https://www.lscompta.fr/blog/compte-467/ ; https://www.pennylane.com/fr/fiches-pratiques/plan-comptable/compte-467-autres-comptes-debiteurs-ou-creditieurs . Les intitulés des sous-comptes divergent selon les sources : à fixer avec l'expert-comptable.
- **FEC** (LPF L47 A, A47 A-1) : 18 champs dans l'ordre : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise ; fichier à plat avec ligne d'en-tête, ou XML conforme au XSD publié. Source : BOFiP https://bofip.impots.gouv.fr/bofip/9028-PGP.html
- Détails techniques (source secondaire, **à vérifier sur A47 A-1**) : séparateur tabulation ou barre verticale ; encodage ASCII, ISO 8859-15 ou UTF-8 ; nom `SIRENFECAAAAMMJJ` (date de clôture) ; dates `AAAAMMJJ` ; décimales à la virgule ; numérotation continue des écritures. https://hayot-expertise.fr/blog/fec-fichier-des-ecritures-comptables
- **Sanction** (CGI art. 1729 D) : 5 000 EUR, ou 10 % des droits rappelés si plus élevé ; appliquée une seule fois par contrôle (mise à jour BOFiP du 21/01/2026) ; QPC jugée non sérieuse (CE 30/01/2026, n° 506887). Sources : https://hayot-expertise.fr/blog/fec-non-conforme-rejet-comptabilite-2026 ; https://formation.lefebvre-dalloz.fr/actualite/examen-de-comptabilite-amende-en-cas-de-defaut-de-remise-du-fec
- **Conservation** : 6 ans (LPF L102 B) pour le fiscal, selon la même source ; 10 ans pour les pièces comptables (Code de commerce L123-22) : **non relu dans cette session**.
- Le FEC n'est dû que par les entreprises au réel tenant une comptabilité informatisée (micro-entreprises exclues sauf option). Source : Hayot ci-dessus.

### 7.2 Schéma d'écritures proposé (modèle « charges et virements séparés », à valider par l'expert-comptable)
Exemple : mission de 1 000 EUR HT facturée par le freelance au client, commission Proofseen de 10 % HT facturée au client, TVA 20 % sur les deux.

| Étape | Débit | Crédit |
|---|---|---|
| Facture de commission Proofseen au client | 411 Client 120 | 706 Prestations de services 100 ; 44571 TVA collectée 20 |
| Encaissement Stripe du total client (mission TTC 1 200 + commission TTC 120) | 512x Stripe (compte de trésorerie dédié) 1 320 | 411 Client 120 ; 467x Fonds reçus pour le compte des freelances 1 200 |
| Virement Stripe au freelance | 467x 1 200 | 512x Stripe 1 200 |
| Frais Stripe | 627 Services bancaires 1,5 (exemple) ; 44566 TVA déductible si facturée | 512x Stripe |
| Commission de l'apporteur | 6222 Commissions et courtages sur ventes (proposition) ; 44566 si TVA | 401 Apporteur |
| Remboursement client avant versement | 467x | 512x Stripe |

Le compte 512x « Stripe » représente le solde chez Stripe (fonds détenus par Stripe sous son agrément) : Proofseen l'enregistre parce que les charges sont créées sur son compte Stripe. Interprétation.

### 7.3 Implications produit
- Grand livre interne en **partie double** alimenté par les webhooks Stripe (`charge.succeeded`, `transfer.created`, `charge.refunded`, `payout.paid`), avec pièce justificative liée (facture, virement) et date de validation.
- Export FEC annuel conforme (18 champs, nom normé, encodage), testé par l'outil Test Compta Demat de la DGFiP (existence de l'outil **NON CONFIRMÉ** dans cette session).
- Rapprochement automatique : solde 467x = somme des montants dus aux freelances non encore virés ; alerte si négatif.
- TVA : commission à 20 % pour un client français ; client UE assujetti : autoliquidation (règle générale des prestations B2B, art. 259 CGI, **non relu dans cette session**).

---

## 8. Synthèse des décisions qui reviennent au founder
1. Assiette et durée de la commission d'apporteur ; interdiction ou non des apporteurs salariés du client (recommandation : interdiction par défaut).
2. Choix d'une PA (réception déjà obligatoire) et décision d'émettre ou non les factures des freelances sous mandat.
3. Choix de 1 à 3 sociétés de portage partenaires (pas de portage en interne).
4. Signature : maison (simple + horodatage qualifié acheté) ou API Youtrust, budget.
5. Validation par un expert-comptable du schéma 467 / 706 et par un avocat des contrats (apport, mandat de facturation, CGU).
