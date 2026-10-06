# R1 — Recherche de nom de marque

**Pour :** Lena Sørensen (lead marque), War Room
**Date des vérifications :** 2026-09-18 (passe RDAP finale lancée à 10:42 UTC)
**Périmètre :** longlist de 30 noms, disponibilité des domaines .com/.io/.fr/.ai, pré-recherche de marques et collisions pour 12 finalistes, top 5.

> **AVERTISSEMENT : ce document n'est PAS un avis juridique.** Il s'agit d'une recherche préliminaire d'antériorités (marques, domaines, pseudos) faite avec des outils automatiques. Un domaine non enregistré aujourd'hui peut l'être demain. Une absence de résultat dans TMview ne garantit pas qu'une marque est disponible. Avant tout dépôt ou achat, il faut une recherche d'antériorités complète (similarités phonétiques et visuelles, classes 9/35/42, et aussi 41) par un conseil en propriété industrielle.

---

## 0. Synthèse

- **Les .com courts sont presque tous pris.** Sur environ 120 noms testés en .com (4 vagues), seuls 14 étaient non enregistrés, tous des composés ou néologismes de 7 à 11 lettres. Les pistes déjà évoquées (**Shortlisted, Citable, Sourced**) sont prises sur les 4 extensions **et** entrent en collision avec des marques ou des produits existants du même secteur. Elles sont écartées.
- **Retenu** est la seule piste initiale encore exploitable : **.io, .fr et .ai libres**, mais le .com est pris (enregistré en 2019) et il existe des marques voisines (RETENO, RETEN).
- **Top 5 recommandé :** **1. Proofseen** · **2. Visimètre** · **3. Citabilis** · **4. Citoscope** · **5. Retenu** (en marque FR ou nom de fonctionnalité). Les quatre premiers ont **les 4 domaines non enregistrés** et le pseudo GitHub libre.

---

## 1. Méthode

| Vérification | Méthode / URL | Lecture du résultat |
|---|---|---|
| .com | RDAP Verisign : `curl -s -o /dev/null -w "%{http_code}" https://rdap.verisign.com/com/v1/domain/NOM.com` | 200 = enregistré (« pris ») ; 404 = non enregistré (« libre* ») |
| .io | RDAP Identity Digital : `https://rdap.identitydigital.services/rdap/domain/NOM.io`. Le .io n'est pas listé dans le bootstrap IANA `https://data.iana.org/rdap/dns.json` : l'endpoint a été **validé empiriquement** (github.io → 200, zzqxqvbnm123.io → 404). `rdap.nic.io` ne répond pas (code 000). | idem |
| .fr | RDAP AFNIC : `https://rdap.nic.fr/domain/NOM.fr` (endpoint listé dans dns.json IANA) | idem |
| .ai | RDAP Identity Digital : `https://rdap.identitydigital.services/rdap/domain/NOM.ai` (endpoint listé dans dns.json IANA pour .ai) | idem |
| Contre-vérification | Calibrage sur témoins connus (google.* = 200, zzqxqvbnm123.* = 404) ; échantillon de réponses 200 ouvertes pour lire `ldhName` et les dates (ex. evidly.io, pickd.fr, citeproof.com, signalo.ai : ce sont de vrais enregistrements) ; pour les 15 domaines « libres » clés : `nslookup -type=NS NOM 8.8.8.8` → **NXDOMAIN** partout (cohérent, mais l'absence de NS n'est **pas** une preuve de disponibilité) | — |
| Marques | **API TMview** (EUIPO/TMDN, couvre EUIPO « EM », INPI « FR », USPTO « US », OMPI « WO » et d'autres offices) : `POST https://www.tmdn.org/tmview/api/search/results` avec `criteria:"C"` (contient) puis `criteria:"F"` (recherche floue/phonétique). Filtre : marques **actives** (non Ended/Expired) en classes **9, 35 ou 42**. | Liste des titulaires et numéros ci-dessous |
| INPI direct | `https://data.inpi.fr/search?...&type=brands` → **HTTP 403** (bloqué pour l'outil). **NON VÉRIFIÉ directement** ; couvert indirectement via l'office FR dans TMview. | — |
| USPTO direct | `https://tmsearch.uspto.gov` → application JavaScript, pas interrogeable en curl. Couvert via l'office US dans TMview. | — |
| Collisions SEO | Recherche web (outil WebSearch) sur `"NOM"` entre guillemets | Qui domine la première page |
| GitHub | `https://github.com/NOM` + `https://api.github.com/users/NOM` | 404 = libre |
| X | `https://x.com/NOM` (calibré : compte inexistant → 404, @anthropicai → 200) | **Indicatif** |
| LinkedIn company | `https://www.linkedin.com/company/NOM` (calibré : inexistant → 404, /anthropicresearch → 200) | **Indicatif** : LinkedIn filtre les robots, un 404 peut être un faux négatif. À confirmer à la main. |

**Limites des domaines :** « libre* » veut dire « non enregistré dans le registre au moment du test ». La RDAP n'indique **ni les prix premium du registre, ni les noms réservés**. Il faut vérifier chez un registrar avant de conclure. Le .fr exige un titulaire établi dans l'UE (règles AFNIC). Le .ai a un coût d'enregistrement élevé (vente pluriannuelle).

---

## 2. Longlist de 30 noms et résultats bruts des domaines

Codes : **200 = pris**, **404 = libre\*** (non enregistré à la date, voir les limites ci-dessus).

| # | Nom | Type | Sens / évocation | .com | .io | .fr | .ai |
|---|---|---|---|---|---|---|---|
| 1 | Shortlisted | mot réel EN (piste) | « présélectionné » | 200 pris | 200 pris | 200 pris | 200 pris |
| 2 | Citable | mot réel FR/EN (piste) | « qui peut être cité » | 200 pris | 200 pris | 200 pris | 200 pris |
| 3 | Sourced | mot réel EN (piste) | « sourcé » (jargon recrutement) | 200 pris | 200 pris | 200 pris | 200 pris |
| 4 | Retenu | mot réel FR (piste) | « retenu pour la mission » | 200 pris | **404 libre\*** | **404 libre\*** | **404 libre\*** |
| 5 | Cited | mot réel EN | « cité » | 200 | 200 | 200 | 200 |
| 6 | Quotable | mot réel EN | « citable » | 200 | 200 | 200 | 200 |
| 7 | Findable | mot réel EN | « trouvable » | 200 | 200 | 200 | 200 |
| 8 | Surfaced | mot réel EN | « remonté à la surface » | 200 | 200 | **404** | 200 |
| 9 | Signet | mot réel FR/EN | sceau, marque-page | 200 | 200 | 200 | 200 |
| 10 | Lisible | mot réel FR | « lisible (par les IA) » | 200 | 200 | 200 | **404** |
| 11 | Legible | mot réel EN | « lisible » | 200 | 200 | 200 | 200 |
| 12 | Probant | mot réel FR | « qui fait preuve » | 200 | 200 | 200 | 200 |
| 13 | Vouched | mot réel EN | « recommandé, garanti par » | 200 | 200 | **404** | 200 |
| 14 | Mentio | néologisme (latin) | « mention » | 200 | 200 | 200 | 200 |
| 15 | Seenly | néologisme | « être vu » | 200 | 200 | 200 | 200 |
| 16 | Evidly | néologisme | evidence + -ly | 200 | 200 | **404** | 200 |
| 17 | Retenio | néologisme | retenu + -io | 200 | **404** | **404** | 200 |
| 18 | Citefolio | composé | cite + portfolio | 200 | **404** | **404** | **404** |
| 19 | Retenix | néologisme | retenu + -ix | 200 | **404** | **404** | **404** |
| 20 | Citeline | composé | cite + line | 200 | **404** | 200 | 200 |
| 21 | Citomètre (citometre) | composé FR | citation + mètre = mesurer la citation | **404** | **404** | **404** | **404** |
| 22 | Citometer | composé EN | idem, graphie EN | **404** | **404** | **404** | **404** |
| 23 | Citoscope | composé | observer les citations | **404** | **404** | **404** | **404** |
| 24 | Citoscore | composé | score de citation | **404** | **404** | **404** | **404** |
| 25 | Citabli | néologisme | « citable », raccourci | **404** | **404** | **404** | **404** |
| 26 | Citabilis | mot latin | latin pour « citable » | **404** | **404** | **404** | **404** |
| 27 | Proofseen | composé EN | preuve + vu = « vu, avec preuve » | **404** | **404** | **404** | **404** |
| 28 | Citehaus | composé | « maison de la citation » | **404** | **404** | **404** | **404** |
| 29 | Prouvable | mot FR | « qui peut être prouvé » | **404** | **404** | **404** | **404** |
| 30 | Visimètre (visimetre) | composé FR | visibilité + mètre = mesurer la visibilité | **404** | **404** | **404** | **404** |

Annexe A (noms testés puis sortis de la longlist faute de domaines) : tous les résultats bruts y figurent.

---

## 3. Les 12 finalistes : analyse détaillée

**Sélection :** tous les noms avec au moins .com, .io ou .ai libre. Citomètre et Citometer sont traités **comme une seule marque** (deux graphies). Sortis de la sélection malgré un domaine libre :
- **Retenix** : évoque la potion magique d'Astérix ou un médicament, hors ton.
- **Citeline** : marque établie de Norstella (citeline.com, enregistré en 1998, « clinical solutions driven by AI »), collision forte.

Les marques TMview listées sont actives, en classes 9, 35 ou 42, recherche floue (F). Les numéros de dépôt sont entre parenthèses.

| # | Nom | .com / .io / .fr / .ai | Marques proches (TMview, actives, cl. 9/35/42) | Collision SEO (recherche web « NOM ») | GitHub | X (indic.) | LinkedIn (indic.) |
|---|---|---|---|---|---|---|---|
| 1 | **Proofseen** | libre / libre / libre / libre | **0 résultat** (C et F) | Aucun acteur. Seule occurrence : un nom de variable dans un dépôt GitHub (« ontologic ») | libre (404) | libre (404) | libre (404) |
| 2 | **Visimètre** | libre ×4 | Seulement des marques **expirées** : VISIMETER (DE, cl. 9/35/42), VISIOMETRE (FR, Valeo, cl. 9) | Aucun acteur. Les résultats renvoient à « viscosimètre » (instrument de mesure) | libre | libre | libre |
| 3 | **Citoscope** | libre ×4 | **Cityscope** (FR, cl. 35/42, COMMERCITE, n° 5222687) ; CITYSCOPE (AU, cl. 9/35/42, RP Data) ; CITISCOPE (KR, cl. 9, Samsung C&T) ; STELARIA CityScope (EM, cl. 9/42) | Pas d'acteur tech. Caméra ancienne « Le Citoscope » (1905-1910) ; proximité sonore avec *cytoscope*/*cystoscope* (médical) | libre | libre | libre |
| 4 | **Citabilis** | libre ×4 | CITABILIA (AR, cl. 35, déposée) ; rien en UE/FR/US | Aucun acteur. Entrées de dictionnaire latin (étymologie de « citable ») | libre | libre | libre |
| 5 | **Citomètre / Citometer** | libre ×4 pour chacune des deux graphies | Aucune marque identique. Voisins : famille **CITO** (dont *Cito – Instituut voor Toetsontwikkeling*, BX, cl. 9/16/41/42, n° 1446005 : institut néerlandais de **tests et de mesure**) ; « C6 FLOW CYTOMETER » (US, cl. 9) ; Cutometer (EM, cl. 9) | « citometer » est une **faute courante pour *flow cytometer*** (biologie), et le nom d'un instrument de terrassement de 1880. En catalan, *citòmetre* = cytomètre | libre | libre | libre |
| 6 | **Citabli** | libre ×4 | **CITABLE AI** (US, cl. 42, déposée, n° 98183722) ; **CITABLE** (BX, cl. 35, n° 1550512) ; Citali (ES, cl. 9) | Aucun acteur « Citabli », mais le terme « citable » est du jargon GEO/LLM déjà saturé (nombreux articles sur les *LLM citations*) | libre | libre | libre |
| 7 | **Citoscore** | libre ×4 | CITYSCORE (US, cl. 35, City of Boston) | **Collision forte** : aux Pays-Bas, « citoscore » désigne le score scolaire Cito. En anglais, se prononce presque comme **CiteScore** (indicateur de citation des revues d'Elsevier) | libre | **pris (200)** | libre |
| 8 | **Citehaus** | libre ×4 | Rien de proche en 9/35/42 (LITEHAUS CN cl. 9/35 ; CITYHAUS/CITIHAUS en cl. 36, immobilier) | Aucun acteur | libre | libre | libre |
| 9 | **Prouvable** | libre ×4 | **Risque élevé** : **PROVABLE** (EM n° 019144901 et WO n° 1798166, Aleo Systems, cl. 9/42) ; Provable (EM n° 018073944, Provable Things, cl. 9/42) ; PROVABLE (WO n° 1923363, Provable Inc., cl. 9/35/42) ; PROVABLE (US, cl. 35/42, M. Harris & Co.) | Aucun acteur « Prouvable » | libre | libre | libre |
| 10 | **Retenu** | **pris** (enregistré 2019-09-17, derrière Cloudflare) / libre / libre / libre | RETENU identique (US n° 98307447, WO n° 1779412) mais en **cl. 1** (Aquatrols, chimie) ; voisins : **RETENO** (US, cl. 9/35/42, n° 97463949) ; **RETEN** (FR, cl. 35/41/42, n° 3723511) ; RETENUM (MX, cl. 35/42) | Mot courant en français (« retenu », « retenue sur salaire »), donc difficile à posséder en SEO. Aucun acteur tech dominant | **pris** | **pris** | libre |
| 11 | **Citefolio** | **pris** / libre / libre / libre | **SITEFOLIO** (US, cl. 42, deux enregistrements, n° 78312937 et 78312998) : se prononce **à l'identique** en anglais | Aucun acteur ; voisins Interfolio, WizFolio | libre | libre | libre |
| 12 | **Retenio** | **pris** / libre / libre / **pris** | **RETENO** (US, cl. 9/35/42) ; **Retendo** (EM n° 018882533, cl. 9/35/41/42) ; **REVENIO** (EM, cl. 9/35/42) ; RETENTO (US, cl. 42) | **Collision forte** : Reteno (reteno.com, SaaS de messagerie IA pour la rétention) ; « Retenio » est déjà utilisé par un projet d'apprentissage IA (RecallAI) | libre | **pris** | libre |

### Pistes initiales écartées (pour mémoire)

| Nom | Domaines | Marques et collisions |
|---|---|---|
| Shortlisted | 4/4 pris (shortlisted.com enregistré en 2011) | SHORTLISTED (GB, cl. 35, Fablr Ltd, déposée) ; MY DIGITAL SHORTLISTER (FR, cl. 35/42) ; plateformes de recrutement IA **shortlisted.se** et **shortlistd.io**. Même secteur, collision directe. |
| Citable | 4/4 pris (citable.com enregistré en 2002) | **CITABLE AI** (US, cl. 42) ; CITABLE (BX, cl. 35) ; GitHub, X et LinkedIn pris |
| Sourced | 4/4 pris (sourced.com enregistré en 1995) | **SOURCED** (EM n° 018087203 et WO, cl. 9/42, Sourced Group) ; SOURCED BY (US, cl. 42) ; environ 30 000 résultats flous |

---

## 4. Score et classement des 12

Chaque critère est noté de 0 à 5. Poids : **Domaines 25 %**, **Risque marque 25 %** (5 = aucun antécédent), **Collision SEO 15 %** (5 = terrain vierge), **Sens et positionnement 20 %** (confiance, rigueur, mesure, preuve), **Prononciation FR/EN 15 %**. Score sur 100 = somme pondérée × 20.

| Rang | Nom | Domaines | Marque | SEO | Sens | Prononciation | **Score /100** | Commentaire |
|---|---|---|---|---|---|---|---|---|
| 1 | **Proofseen** | 5 | 5 | 5 | 4 | 3 | **90** | Terrain vierge sur tous les critères. « Preuve » + « vu » résume la promesse. Un peu anglicisé pour le marché FR. |
| 2 | **Visimètre** | 5 | 4 | 4 | 5 | 3 | **86** | Dit exactement « on mesure votre visibilité ». Très clair en FR. La variante EN *visimeter.com* est **prise**. |
| 3 | **Citabilis** | 5 | 4 | 4 | 3 | 3 | **78** | Latin, sérieux, académique. Moins parlant pour un freelance. 4 syllabes. |
| 4 | **Citoscope** | 5 | 3 | 4 | 4 | 3 | **77** | Évoque bien l'observation. Voisins Cityscope (FR, cl. 35/42) et famille CITO à surveiller. |
| 5 | Citomètre / Citometer | 5 | 3 | 3 | 4 | 3 | 74 | Très bon sens de « mesure ». En anglais, confusion quasi phonétique avec *cytometer*. |
| 5 | Citehaus | 5 | 4 | 5 | 2 | 2 | 74 | Libre partout, mais le sens est faible et le mélange allemand/anglais s'éloigne de « rigueur et mesure ». |
| 5 | Prouvable | 5 | **1** | 4 | 5 | 4 | 74 | Sens idéal, mais **conflit probable avec PROVABLE** (plusieurs titulaires en cl. 9/42 en UE, dans le système international et aux US). Déconseillé. |
| 8 | Citabli | 5 | 2 | 4 | 4 | 3 | 72 | Trop proche de CITABLE AI (US, cl. 42) et de CITABLE (BX, cl. 35). |
| 9 | Citoscore | 5 | 3 | **1** | 4 | 4 | 71 | Collision SEO avec les scores Cito (NL) et CiteScore (Elsevier). |
| 10 | Retenu | 3 | 3 | 2 | 5 | 3 | 65 | Meilleur sens en français, mais .com, GitHub et X pris, et marques voisines RETENO/RETEN. |
| 11 | Citefolio | 3 | 2 | 4 | 4 | 3 | 62 | Homophone de SITEFOLIO (US, cl. 42) en anglais. |
| 12 | Retenio | 2 | 1 | 1 | 4 | 4 | 46 | Reteno, Retendo et Revenio occupent déjà le terrain. |

---

## 5. Top 5 recommandé

**1. Proofseen (90).** Le seul nom qui coche tout : les 4 domaines non enregistrés, **aucune marque identique ou floue dans TMview**, aucun acteur en ligne, GitHub, X et LinkedIn libres (X et LinkedIn à confirmer). Le nom contient la promesse « **vu, et prouvé** », ce qui colle à *confiance, mesure, preuve* et reste loin de l'imaginaire « hack ». Il est naturel pour la phase EN. Pour les freelances tech FR, habitués aux anglicismes, il passe bien, même si un public non tech prononcera « prouf-sine ». Risque résiduel : c'est un mot composé, donc sa distinctivité est à confirmer par un conseil.

**2. Visimètre (86).** Le meilleur nom pour lancer en **France d'abord** : il se comprend sans explication (« le visimètre de votre profil ») et incarne la **mesure**. Les 4 domaines sont libres. Les seules antériorités (VISIMETER, VISIOMETRE) sont **expirées**. Deux réserves : (a) *visimeter.com* est pris, donc l'expansion EN devra garder la graphie « Visimetre » ou prendre un .io/.ai ; (b) l'accent (visimètre.fr en IDN) est à gérer. Réserver aussi le nom sans accent.

**3. Citabilis (78).** Le choix le plus sûr juridiquement et en SEO après Proofseen (seule CITABILIA, en Argentine). Il a une gravité « institutionnelle » utile face aux sociétés de portage et aux ESN. Il est moins chaleureux et moins immédiat pour un freelance. Bon candidat pour un nom d'entreprise ou d'indicateur (« score Citabilis »).

**4. Citoscope (77).** Il dit « observer ce que les IA citent », avec une couleur scientifique qui soutient la *rigueur*. Les 4 domaines et tous les pseudos sont libres. Le risque marque est modéré : **Cityscope** (FR, cl. 35/42) et CITISCOPE (KR, cl. 9) sont visuellement proches. Ils relèvent de secteurs différents, mais c'est le point à faire trancher par un conseil. Le préfixe « cito » renvoie aussi à l'institut néerlandais de tests Cito.

**5. Retenu (65), comme marque FR ou nom de fonctionnalité, pas comme marque globale.** C'est le mot que le freelance veut entendre (« vous êtes retenu ») : sens et émotion maximaux. Les domaines **retenu.io, retenu.fr et retenu.ai sont libres**. Mais le .com est pris, GitHub et X sont pris, et **RETENO** (US, cl. 9/35/42) et **RETEN** (FR, cl. 35/41/42) sont proches. Usage conseillé : signature ou nom de rapport (« Rapport Retenu », « Êtes-vous retenu ? ») sous une marque ombrelle (Proofseen ou Visimètre). Il faut réserver retenu.fr par défense.

**Écarté malgré son score :** *Prouvable*. Sens parfait, mais la famille **PROVABLE** (Aleo Systems, Provable Inc., Provable Things) est active en cl. 9/42 en UE, dans le système international et aux US. Le risque d'opposition est trop élevé.

**Actions suggérées (hors avis juridique) :**
1. Vérifier le prix réel chez un registrar (premium ou non) pour proofseen.{com,io,ai,fr} et visimetre.{com,io,ai,fr}, puis réserver le couple retenu (après validation par Lena).
2. Faire faire par un conseil en PI une recherche d'antériorités complète (similarités phonétiques, cl. 9/35/42/41, UE + FR + US) sur le trio Proofseen / Visimètre / Citabilis (plus Citoscope en réserve).
3. Vérifier à la main les pages LinkedIn company et X.
4. Tester la prononciation auprès de 5 freelances FR et 5 anglophones (dicter le nom, leur demander de l'écrire).

---

## 6. Limites

- **Pas un avis juridique.** Recherche préliminaire sur TMview (qui agrège de nombreux offices mais pas tous et pas en temps réel). La recherche floue TMview ne couvre pas toutes les similarités phonétiques et conceptuelles qu'un examinateur retiendrait. Les recherches ont porté sur le nom exact, sans les variantes orthographiques (sauf citometre/citometer).
- **INPI (data.inpi.fr) : NON VÉRIFIÉ directement** (HTTP 403). **USPTO tmsearch : NON VÉRIFIÉ directement** (application JavaScript). Les offices FR et US sont couverts **indirectement** via TMview.
- **EUIPO eSearch :** page joignable (200) mais pas interrogée directement. L'office EM est couvert via TMview.
- **Domaines :** l'état RDAP est un instantané du 2026-09-18. Les tarifs premium, les noms réservés et l'éligibilité (.fr) n'ont **pas** été vérifiés. Les « libres » n'ont pas été testés chez un registrar.
- **Réseaux sociaux :** les codes HTTP de X et LinkedIn sont des **indicateurs** (calibrés sur un témoin), pas des preuves. Instagram et Malt n'ont pas été vérifiés.
- **SEO :** une seule recherche web par nom, via un moteur US. Pas de mesure de volume de recherche ni de test sur Google.fr.
- **Prononciation et sens :** notes subjectives, à valider par un test utilisateur.

---

## Annexe A : noms testés et sortis de la longlist (résultats RDAP bruts)

**Vague 1 (4 extensions : .com/.io/.fr/.ai) :** reperio 200/200/200/200 · attesto 200/200/200/200 · evidens 200/200/200/200 · mesura 200/200/200/200 · releve 200/200/200/200 · sourcely 200/200/200/200 · citeproof 200/200/404/200 · proofed 200/200/404/200 · visibl 200/200/200/200 · pickd 200/200/200/200 · signalo 200/200/200/200 · recallo 200/200/404/200 · citely 200/200/200/200.

**Vague 2 (.com uniquement) :** citabli 404 · retenuhq 404 · tous les autres **200** : retenable, citewise, sourceable, probanto, citatum, citara, veracite, citevo, retaino, signavo, provenio, attestra, trustcite, apparu, visibilis, citelane, citemark, evidio, probatio, provena, surfacio, seenby, pickedby, namedby, citedby, mesurio, visimeter, reperable, trouvable, trouvio, findabl, shortlistd, retenue, preuvio, proova, sigilo, citanza, citeon, citable-ai, getcitable, citablehq, shortlisty, evidentia, lisibly, legibl, citabl, signalcv, proofcv.

**Vagues 3 et 4 (.com/.io/.ai) :** visiscore 200/200/200 · seenbyai 200/200/200 · llmcited 200/200/404 · surfacely 200/200/200 · qitable 200/404/404 · citabel 200/404/404 · mentiono 200/404/404 · visiscope 200/404/404 · attestly 200/200/200 · verifolio 200/200/200 · retenum 200/200/404 · listedby 200/200/404 · recallable 200/404/200 · nomino 200/200/200 · citance 200/404/200 · citeria 200/404/200 · sourcio 200/200/200 · shortlistr 200/200/200 · shortlistai 200/200/404 · retenuto 200/404/404 · **citemetre 404/404/404** · citemeter 200/404/404 · **retenometre 404/404/404** · proofscope 200/404/404 · citably 200/200/200 · citedcv 200/404/404 · askcited 200/404/404 · citepoint 200/404/200 · citabile 200/404/404 · **sourcemetre 404/404/404** · citeo 200/200/200 (Citeo = acteur français majeur du recyclage, à éviter de toute façon) · citemark 200/404/200 · citewise 200/200/200.

## Annexe B : exemples de lecture RDAP (preuve que les 200 sont de vrais enregistrements)

- `evidly.io` : enregistré le 2024-09-30, statut « redemption period » (expiration 2026-09-30, **il pourrait se libérer**, à surveiller si besoin)
- `pickd.fr` : enregistré le 2026-04-13, actif
- `citeproof.com` : enregistré le 2025-02-20
- `signalo.ai` : enregistré le 2026-02-24
- `citanza.com` : enregistré le 2026-04-16 ; `preuvio.com` : 2026-01-14 ; `mesurio.com` : 2018-03-20
- `retenu.com` : 2019-09-17 ; `citable.com` : 2002-04-18 ; `shortlisted.com` : 2011-10-27 (expire le 2026-10-27) ; `sourced.com` : 1995-09-06 ; `citeline.com` : 1998-01-30 (Citeline, IA clinique)
