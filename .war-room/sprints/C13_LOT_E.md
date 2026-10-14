# C13 — lot E : missions vérifiées

Branche `sprint/c13-missions`. Avant ce lot, aucun code de production ne créait de ligne `VerifiedMission`. Une mission
passée devient maintenant un fait public, daté et vérifié, par deux voies seulement ; jamais par simple déclaration.

## Ce qui est construit

- **Confirmation par le client** (`packages/db/src/mission-confirmations.ts`) : le freelance déclare la mission depuis
  `/[lang]/app/preuves` (section « Missions vérifiées » : rôle, nom du client, type, SIRET ou e-mail d'un contact,
  période au mois, résumé sans coordonnées).
  - SIRET reconnu **et actif au répertoire** : la demande va à l'entreprise ; ses propriétaires et administrateurs
    (notification `mission_confirmation`) confirment ou refusent sur `/[lang]/app/confirmations` (entrée de menu
    entreprise « Confirmations »).
  - Sinon : e-mail au contact avec un lien signé `/[lang]/confirmer-mission/<id>?t=<jeton>`, usage unique, 30 jours.
    Jeton = HMAC-SHA256 de l'id de la demande ; la base ne garde que son SHA-256. Page publique `noindex`, sans
    référent, qui ne montre que le nom affiché (ou la référence) du freelance, le rôle, la période et le résumé.
    Ouvrir le lien ne décide rien (un antivirus qui suit les liens ne confirme pas).
  - Case « autoriser l'affichage du nom de notre entreprise », décochée par défaut ; sans elle, seul le type est publié.
    Côté entreprise inscrite, le nom publié est celui de l'entreprise sur Proofseen, jamais le texte du freelance.
  - Refus d'auto-confirmation : même SIREN que le freelance, entreprise dont il est membre (aussi vérifié au moment de
    la décision), sa propre adresse (sous-adresses `+…` et points Gmail compris), l'adresse d'un collègue.
  - Plafonds : 5 demandes en attente par freelance, 10 demandes par jour (`throttled`), 3 demandes par boîte de
    contact sur 30 jours tous freelances confondus, décisions limitées par compte et, pour le lien, par adresse IP.
  - Sur le profil, une confirmation par lien se lit « confirmée par un contact chez le client » ; par l'entreprise
    inscrite, « confirmée par le client ».
- **Payée sur Proofseen** (`verified-missions.ts`, `recordPaidMission`) : au versement des fonds
  (`payments.releaseOne`, paiement réglé sans litige ni remboursement), une mission `paid_on_platform` naît, une seule
  fois par contrat (clé unique). Rôle = titre de la mission publiée, sinon titre du profil ; client anonyme ; aucun
  résumé inventé. Les paiements sont fermés : testé en PGlite.
- **Migration** `20261014143000_mission_confirmations` : table `MissionConfirmationRequest`, colonnes de provenance sur
  `VerifiedMission` (`confirmationId`, `contractId` uniques, `clientName`, `confirmedByOrganisationId`,
  `confirmedByDomain`), valeurs `client_confirmation` / `paid_on_platform` (aussi dans `EVIDENCE_KINDS` de
  `@proofseen/profiles`), `NotificationKind.mission_confirmation`, CHECK (une seule cible, jeton obligatoire pour un
  e-mail, adresse en minuscules, nom autorisé seulement si confirmée…). Générée par `prisma migrate diff`.
- **E-mails** (`packages/notify`) : `renderConfirmationRequest` (contact sans compte, FR/EN) et le type
  `mission_confirmation` (entreprise : demande reçue ; freelance : confirmée ou refusée). L'e-mail au contact part de
  la tâche planifiée `/api/cron/notifications` (`confirmationMails` dans le rapport) : la demande elle-même sert de
  file (bail, 5 essais), le jeton est recalculé, jamais lu en base.
- **Profil public** : « Confirmée par le client le … », « Payée sur Proofseen, vérifiée le … » ; nom du client
  seulement s'il l'a autorisé.
- **RGPD** : export (demandes faites, décidées, adressées à l'adresse du compte ; jamais l'empreinte du jeton),
  effacement (cascade du profil, demandes adressées à l'adresse effacée), conservation : demandes décidées ou échues
  purgées 90 jours après ; la mission confirmée reste.

## Variables d'environnement

Aucune nouvelle. Le lien signé dérive sa clé de `PROOFSEEN_ACCESS_SECRET` (étiquette
`proofseen:mission-confirmation:v1`) : sans lui, aucune demande ne peut être faite. Envoi : `RESEND_API_KEY` et
`NOTIFY_FROM` (existants) ; adresse des liens : `PROOFSEEN_PUBLIC_URL`. Changer le secret invalide les liens en cours
(les demandes expirent, rien n'est publié).

## Ce qui reste

- Écran non vérifié dans un navigateur (pas de base ni de Clerk dans le worktree) ; `next build` non lancé.
- Contrats en régie : la mission payée naît au versement du paiement unique ; les versements mensuels sur relevé ne
  sont pas branchés.
- Litige ou remboursement **après** le versement : la mission payée reste ; à trancher (retrait manuel par opérateur).
- Un freelance peut encore se faire confirmer par une seconde boîte à lui : le domaine qui a confirmé est gardé
  (`confirmedByDomain`, non publié) pour contrôle, et le profil dit « un contact chez le client » ; refuser les
  messageries grand public reste une décision produit. Pas encore de lien « ce n'est pas pour moi » dans l'e-mail.
- Relecture sécurité faite (aucune critique ni haute ; trois moyennes corrigées : nom publié, plafond par
  destinataire, libellé de la confirmation par contact).
- Le jeton voyage dans l'adresse (comme les liens d'espace client avant leur passage en cookie) : usage unique et
  30 jours ; le passer en cookie via le middleware reste possible.
