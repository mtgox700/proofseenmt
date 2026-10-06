# C3 — Points à faire relire par le juriste

> Liste exigée par la Definition of Done de C3. **Rien ici ne bloque le développement** (décision du founder) : le
> code fonctionne, ces points se relisent avant les paiements réels (« GO PAIEMENT LIVE »).

## 1. Statut de Proofseen dans le paiement

- Le modèle : l'entreprise paie Proofseen, les fonds restent sur le compte de la plateforme chez Stripe jusqu'à la
  validation de la prestation, puis sont virés au freelance (Stripe Connect, « charges et virements séparés »).
- À confirmer : que ce schéma relève bien de l'**exemption d'agrément d'établissement de paiement** dont bénéficie une
  plateforme qui s'appuie sur un prestataire agréé (Stripe), et non d'une activité de paiement propre (code monétaire et
  financier, art. L.521-3 et suivants ; directive DSP2).
- À confirmer : le vocabulaire public. On écrit « paiement sécurisé » et « fonds bloqués jusqu'à validation », jamais
  « séquestre » au sens juridique tant que ce point n'est pas tranché.

## 2. Mandat de facturation

- Proofseen émet la facture de la mission **au nom et pour le compte du freelance** (art. 289-I-2 du CGI), dans une
  série de numéros propre à chaque freelance.
- À rédiger : la clause de mandat dans les CGU freelance (acceptation expresse, contestation sous un délai, le
  freelance reste responsable de ses mentions et de sa TVA).
- À confirmer : la mention exacte imprimée sur la facture (aujourd'hui : « Facture émise par Proofseen au nom et pour le
  compte de … »).

## 3. Mentions des factures

- Implémentées : numéro, dates d'émission et d'échéance (30 jours), identités, adresses, SIRET, numéros de TVA,
  désignation, quantité, prix unitaire, totaux, TVA ou « TVA non applicable, art. 293 B du CGI », pénalités de retard
  (trois fois le taux légal), indemnité forfaitaire de 40 €, absence d'escompte.
- À confirmer : le taux de pénalités retenu, le délai de paiement par défaut, la mention de la date de la prestation
  (aujourd'hui dans la désignation).
- **Facturation électronique** : la réforme impose la réception des factures électroniques à toutes les entreprises
  dès septembre 2026, et leur émission par les PME et micro-entreprises à partir de septembre 2027. Le rendu HTML actuel
  ne suffira pas : prévoir le passage par une plateforme agréée et un format structuré (Factur-X, UBL ou CII).

## 4. Commission

- Le taux est une **décision du founder** (variable `PROOFSEEN_COMMISSION_BP`) ; tant qu'il n'est pas fixé, aucun
  paiement ne s'ouvre.
- À confirmer : la commission est facturée au freelance avec TVA à 20 % et déduite du versement ; la présenter
  clairement avant signature (exigence d'information des plateformes, art. L.111-7 du code de la consommation et
  règlement P2B 2019/1150).

## 5. CGU, CGV et litiges

- À rédiger : CGU freelance, CGU entreprise, conditions de la mise en relation, politique de remboursement, procédure
  de litige (que se passe-t-il si l'entreprise ne valide jamais la prestation : délai de validation automatique ?).
- À confirmer : la clause de non-contournement (contact hors plateforme). La veille indique 12 mois et 10 000 € chez
  Malt, **non vérifié** (pages bloquées).

## 6. Conformité des parties

- Vigilance URSSAF (attestation de moins de 6 mois au-delà de 5 000 € HT), SIRET actif, KYC Stripe : prévus en C6.
