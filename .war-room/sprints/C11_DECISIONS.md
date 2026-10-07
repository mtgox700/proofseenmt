# C11 — Décisions de la War Room (2026-10-07)

Prises par délégation explicite du founder (« vous êtes autonomes, prenez les meilleures décisions »). Le brainstorm
s'est tenu entre Victoria (marché, veille) et Maxwell (produit, technique), à partir de deux veilles faites le même jour.
Aucune page de Malt n'a été lue en contournant Cloudflare : les chiffres de Malt viennent de sources publiques tierces
et restent marqués « à vérifier ».

## 1. Plateforme agréée pour la facture électronique

**Sources** : liste DGFiP des plateformes immatriculées (PDF du 23/09/2026, 149 entrées), liste des plateformes en
attente des tests d'interopérabilité (PDF du 16/09/2026), FAQ DGFiP « J'approfondis » (07/09/2026), BOI-TVA-DECLA-30-20-10,
et la documentation publique de chaque candidate.

**Victoria** : Super PDP est la seule à documenter de bout en bout l'émission par un tiers sous mandat de facturation :
mandat géré par API, scénario de test en bac à sable, 0,01 € HT par facture jusqu'à 10 000 par mois. B2Brouter a une API
multi-comptes pensée pour les plateformes, mais son autofacturation Peppol fait émettre l'acheteur, ce qui n'est pas
notre cas. Iopole est solide mais vendue sur devis, à partir de 5 000 documents par mois. Libeo n'est pas dans la liste.

**Maxwell** : nous produisons déjà la CII (EN 16931), un format qu'accepte Super PDP. Le risque, c'est la taille de
l'équipe. On le couvre en n'écrivant qu'un adaptateur derrière une interface, comme pour Stripe, et en gardant B2Brouter
comme remplaçant.

**Décision** :
- **Super PDP en premier choix, B2Brouter en remplaçant.**
- Branchement en bac à sable seulement, avec la mise en production (GO DEPLOY), puisque la réforme ne nous oblige qu'à
  recevoir au 2026-09-01 et qu'aucune facture réelle n'est encore émise.
- À faire confirmer par Super PDP avant le branchement :
  - la PA qui transmet : la FAQ DGFiP dit « par principe » celle du freelance (le mandant) ;
  - les 2 € HT de KYC/KYB : sont-ils dus pour chaque freelance ?
  - la vérification du mandat par leur support : peut-elle se faire par API, à l'échelle ?
  - qui transmet l'e-reporting des factures émises sous mandat ;
  - leur SLA.

**Correction faite le jour même** : la facture de mission portait le code 389 (autofacturation). Dans la liste UNTDID
1001, le code 389 désigne une facture établie **par l'acheteur**. Or Proofseen n'est pas l'acheteur : c'est un tiers qui
émet au nom et pour le compte du freelance (art. 289 I-2 du CGI). Les deux factures portent désormais le code **380**,
et le mandat figure en note (« Facture émise par un tiers : Proofseen au nom et pour le compte de … »). Le rendu HTML
n'a jamais porté la mention « Autofacturation » et reste inchangé. Le code est à revalider sur le bac à sable Super PDP.

## 2. Tarification B2B (« Vivier+ »)

**Repères relevés** :

| Acteur | Côté client | Côté freelance | Abonnement |
|---|---|---|---|
| Malt | Starter 5 %, Advanced 9 %, Enterprise sur devis | 10 % HT, puis 5 % après 6 mois avec le même client | — |
| Turnover-IT / Free-Work | Sur devis | Gratuit | Oui, prix non publiés |
| BoondManager (outil d'ESN) | — | — | 59 / 79 / 99 € par manager et par mois, + 4 € par consultant |
| Collective | — | 2,9 % | 95 / 135 € par siège |

**Victoria** : un grand compte refuse de payer deux fois pour des freelances qu'il a déjà trouvés, payés et validés.
Malt le sait, d'où les 5 % après six mois. Un abonnement par siège se vend aux achats, pas à un manager pressé.

**Maxwell** : un abonnement exige Stripe Billing, reporté à la fin du projet. Des frais côté client exigent une troisième
facture (Proofseen → entreprise), ce qui est faisable mais n'a de sens qu'avec de vrais paiements. La baisse de commission
sur un freelance déjà payé par la même entreprise, au contraire, tient en une règle de calcul. Elle sert aussi contre le
contournement : la deuxième mission coûte moins cher sur Proofseen qu'en dehors, puisqu'on y garde le séquestre, la
facture et les relevés.

**Décision** :
1. **Entreprise standard** : rien ne change. 0 % côté client, 10 % de commission côté freelance (décision du 2026-10-07).
2. **Fidélité, pour tous** : dès qu'un freelance a reçu au moins un versement d'une entreprise, ses missions suivantes
   avec cette entreprise sont commissionnées à **5 %** (`PROOFSEEN_REPEAT_COMMISSION_BP`, 500 par défaut). Le taux est figé
   au contrat et affiché avant signature. On est au niveau de Malt, sans attendre six mois.
3. **Vivier+ (grands comptes et ESN)** : validation à deux niveaux, centres de coûts, vivier privé, API de lecture et
   export comptable. **Gratuit pendant la bêta**, pour apprendre l'usage réel. Ensuite, **frais client de 3 %** sur les
   contrats, sans abonnement par siège, activés en même temps que les paiements réels (GO PAIEMENT LIVE). 3 %, c'est
   sous le Starter de Malt (5 %), parce qu'on ne vend ni matching ni sourcing assisté.
4. Aucun prix n'est affiché publiquement avant les premières données réelles. Une grille au jugé ne ferait qu'ancrer un
   chiffre inventé.

**Point juridique pour le founder**, à traiter en fin de projet, sans blocage : le 2026-09-20, le board avait décidé
« commission facturée à l'entreprise », à cause du risque de placement privé (L5321-3) lié au portage. Le portage est
suspendu, et une commission payée par le freelance est la norme du marché (Malt), mais le juriste doit le confirmer.
Les frais client de 3 % de Vivier+ rapprochent de toute façon le modèle de la décision du 20 septembre.

## Suite

- **Lot B** : clés d'API par entreprise (hachées, révocables) + lecture de `/api/v1/contracts` et `/api/v1/invoices` + export comptable CSV.
- **Lot C** : commission de fidélité à 5 %, figée au contrat.
