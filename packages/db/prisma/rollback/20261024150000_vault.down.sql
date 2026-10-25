-- Retour arrière de 20261024150000_vault. NE PAS le placer dans migrations/ (Prisma l'appliquerait) : il se joue à la main,
-- dans une transaction, après avoir redéployé la version précédente de l'application.
--
-- Avant :
--   1. pg_dump de "Document", "DocumentVersion", "DocumentAccess", "Quote" et "Contract" ;
--   2. SELECT count(*) FROM "DocumentVersion"; doit valoir 0, sinon les versions (et leurs fichiers sur le volume des
--      dépôts, rangés sous "storageKey") sont perdues avec la table : ne pas revenir en arrière tant qu'un document de
--      contrat existe (durée légale de conservation), corriger en avant. Les fichiers du volume sont alors à copier à part
--      (SELECT "storageKey", "sha256" FROM "DocumentVersion"), car le balayage des fichiers orphelins les effacerait.
-- Après : DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261024150000_vault'; (ou
--   prisma migrate resolve --rolled-back 20261024150000_vault).

BEGIN;

DROP TABLE "DocumentAccess";
DROP TABLE "DocumentVersion";
DROP TABLE "Document";
DROP FUNCTION proofseen_document_access_guard();
DROP FUNCTION proofseen_document_version_guard();
DROP FUNCTION proofseen_document_keep();
DROP FUNCTION proofseen_document_guard();
DROP TYPE "DocumentAction";
DROP TYPE "DocumentType";

DROP TRIGGER "Contract_scope_frozen" ON "Contract";
DROP FUNCTION proofseen_contract_scope_frozen();
DROP TRIGGER "Quote_accepted_at" ON "Quote";
DROP FUNCTION proofseen_quote_accepted_at();
DROP TRIGGER "Quote_terms_frozen" ON "Quote";
DROP FUNCTION proofseen_quote_terms_frozen();
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_scope_chk";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_scope_chk";
ALTER TABLE "Contract" DROP COLUMN "deliverables";
ALTER TABLE "Contract" DROP COLUMN "scope";
ALTER TABLE "Quote" DROP COLUMN "acceptedAt";
ALTER TABLE "Quote" DROP COLUMN "validUntil";
ALTER TABLE "Quote" DROP COLUMN "deliverables";
ALTER TABLE "Quote" DROP COLUMN "scope";

COMMIT;
