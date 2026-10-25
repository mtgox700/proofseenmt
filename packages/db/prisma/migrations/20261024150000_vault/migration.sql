-- Le coffre (L1.3, L1.5, L1-011) : les documents d'une affaire, leurs versions immuables et le journal d'accès ; l'objet de la
-- prestation, ses livrables et la durée de validité du devis ; le moment où un devis est accepté.
-- Rien n'est rétro-rempli : les devis et contrats d'avant restent sans objet ni livrables, et sans date d'acceptation du
-- devis. Ces faits n'ont jamais été recueillis ; les deviner serait inventer (un contrat accepté en deux clics n'a pas d'objet).

CREATE TYPE "DocumentType" AS ENUM ('service_agreement', 'quote', 'acceptance_report', 'nda', 'amendment');
CREATE TYPE "DocumentAction" AS ENUM ('created', 'version_created', 'downloaded');

-- ═══ Objet, livrables, validité, acceptation ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "Quote" ADD COLUMN "scope" TEXT;
ALTER TABLE "Quote" ADD COLUMN "deliverables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Quote" ADD COLUMN "validUntil" DATE;
ALTER TABLE "Quote" ADD COLUMN "acceptedAt" TIMESTAMPTZ(3);
ALTER TABLE "Contract" ADD COLUMN "scope" TEXT;
ALTER TABLE "Contract" ADD COLUMN "deliverables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_scope_chk" CHECK (("scope" IS NULL OR char_length("scope") BETWEEN 1 AND 6000) AND cardinality("deliverables") <= 30);
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_scope_chk" CHECK (("scope" IS NULL OR char_length("scope") BETWEEN 1 AND 6000) AND cardinality("deliverables") <= 30);

-- L'objet, les livrables et la validité d'un devis se rédigent au brouillon et ne bougent plus une fois le devis envoyé,
-- comme ses montants : l'entreprise accepte ce qu'elle a vu.
CREATE FUNCTION proofseen_quote_terms_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."status" <> 'draft' AND (NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."deliverables" IS DISTINCT FROM OLD."deliverables"
     OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil") THEN
    RAISE EXCEPTION 'un devis envoyé ne change ni d''objet, ni de livrables, ni de validité : un nouveau devis le remplace';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Quote_terms_frozen" BEFORE UPDATE OF "scope", "deliverables", "validUntil" ON "Quote"
  FOR EACH ROW EXECUTE FUNCTION proofseen_quote_terms_frozen();

-- Le moment d'acceptation n'existe qu'avec le passage de « envoyé » à « accepté », une seule fois, et jamais à la création.
CREATE FUNCTION proofseen_quote_accepted_at() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."acceptedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'un devis ne naît pas accepté';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt" AND (OLD."acceptedAt" IS NOT NULL OR NOT (OLD."status" = 'sent' AND NEW."status" = 'accepted')) THEN
    RAISE EXCEPTION 'le moment d''acceptation d''un devis se pose une fois, avec son acceptation';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Quote_accepted_at" BEFORE INSERT OR UPDATE ON "Quote"
  FOR EACH ROW EXECUTE FUNCTION proofseen_quote_accepted_at();

-- Recopiés du devis à la création du contrat, puis figés comme ses autres conditions : aucune modification, y compris de
-- nul vers une valeur (un contrat né sans objet n'en reçoit pas après coup).
CREATE FUNCTION proofseen_contract_scope_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."deliverables" IS DISTINCT FROM OLD."deliverables" THEN
    RAISE EXCEPTION 'l''objet et les livrables d''un contrat ne changent pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_scope_frozen" BEFORE UPDATE OF "scope", "deliverables" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_scope_frozen();

-- ═══ Le coffre ═════════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "contractId" UUID,
    "quoteId" UUID,
    "conversationId" UUID,
    "organisationId" UUID,
    "profileId" UUID,
    "type" "DocumentType" NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "templateId" TEXT NOT NULL,
    "lang" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "contentDigest" CHAR(64) NOT NULL,
    "storageKey" UUID NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAccess" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER,
    "action" "DocumentAction" NOT NULL,
    "userId" UUID,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_contractId_type_slot_key" ON "Document"("contractId", "type", "slot");
CREATE UNIQUE INDEX "Document_quoteId_type_slot_key" ON "Document"("quoteId", "type", "slot");
CREATE UNIQUE INDEX "Document_conversationId_type_slot_key" ON "Document"("conversationId", "type", "slot");
CREATE UNIQUE INDEX "Document_organisationId_type_slot_key" ON "Document"("organisationId", "type", "slot");
CREATE UNIQUE INDEX "Document_profileId_type_slot_key" ON "Document"("profileId", "type", "slot");
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");
CREATE UNIQUE INDEX "DocumentVersion_documentId_number_key" ON "DocumentVersion"("documentId", "number");
CREATE INDEX "DocumentAccess_documentId_at_idx" ON "DocumentAccess"("documentId", "at");

ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_text_chk" CHECK ("slot" >= 1 AND "lang" IN ('fr', 'en') AND char_length("templateId") BETWEEN 1 AND 80);
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_chk" CHECK (
  "number" >= 1 AND "size" BETWEEN 1 AND 20971520 AND "sha256" ~ '^[0-9a-f]{64}$' AND "contentDigest" ~ '^[0-9a-f]{64}$' AND "contentType" = 'application/pdf'
  AND char_length("reason") BETWEEN 1 AND 300 AND char_length("templateVersion") BETWEEN 1 AND 40 AND char_length("engine") BETWEEN 1 AND 80);

-- Un document tient à une seule affaire, à sa création. Ce n'est pas une contrainte CHECK : la suppression d'un compte met
-- l'attache d'un devis, d'une conversation, d'une entreprise ou d'un profil à nul, ce qu'une CHECK ferait échouer.
-- Ensuite, une attache ne peut que disparaître, jamais changer ; la sorte, le rang, le gabarit et la langue ne changent pas.
CREATE FUNCTION proofseen_document_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF num_nonnulls(NEW."contractId", NEW."quoteId", NEW."conversationId", NEW."organisationId", NEW."profileId") <> 1 THEN
      RAISE EXCEPTION 'un document tient à une seule affaire';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."type" <> OLD."type" OR NEW."slot" <> OLD."slot" OR NEW."templateId" <> OLD."templateId" OR NEW."lang" <> OLD."lang" OR NEW."createdAt" <> OLD."createdAt"
     OR (NEW."contractId" IS DISTINCT FROM OLD."contractId")
     OR (NEW."quoteId" IS DISTINCT FROM OLD."quoteId" AND NEW."quoteId" IS NOT NULL)
     OR (NEW."conversationId" IS DISTINCT FROM OLD."conversationId" AND NEW."conversationId" IS NOT NULL)
     OR (NEW."organisationId" IS DISTINCT FROM OLD."organisationId" AND NEW."organisationId" IS NOT NULL)
     OR (NEW."profileId" IS DISTINCT FROM OLD."profileId" AND NEW."profileId" IS NOT NULL) THEN
    RAISE EXCEPTION 'un document ne change ni de sorte, ni de gabarit, ni d''affaire';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Document_guard" BEFORE INSERT OR UPDATE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION proofseen_document_guard();

-- Un document d'un contrat est conservé avec lui : il ne se supprime pas (durée légale). Les autres partent avec leur affaire.
CREATE FUNCTION proofseen_document_keep() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."contractId" IS NOT NULL THEN
    RAISE EXCEPTION 'le document d''un contrat est conservé avec lui';
  END IF;
  RETURN OLD;
END $fn$;
CREATE TRIGGER "Document_keep" BEFORE DELETE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION proofseen_document_keep();

-- Une version est immuable, comme une facture. Seule la référence à son auteur peut disparaître (suppression de son
-- compte). Elle se numérote à la suite, sans trou. Elle ne se supprime qu'avec un document qui n'est pas celui d'un
-- contrat : quand son document n'existe plus (suppression en cascade), ou n'est attaché à aucun contrat.
CREATE FUNCTION proofseen_document_version_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."number" <> COALESCE((SELECT max("number") FROM "DocumentVersion" WHERE "documentId" = NEW."documentId"), 0) + 1 THEN
      RAISE EXCEPTION 'les versions d''un document se suivent sans trou';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Document" WHERE "id" = OLD."documentId" AND "contractId" IS NOT NULL) THEN
      RAISE EXCEPTION 'une version du coffre d''un contrat est immuable et conservée';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW."documentId", NEW."number", NEW."sha256", NEW."contentDigest", NEW."storageKey", NEW."size", NEW."contentType", NEW."templateVersion", NEW."engine", NEW."variables", NEW."reason", NEW."createdAt")
     IS DISTINCT FROM (OLD."documentId", OLD."number", OLD."sha256", OLD."contentDigest", OLD."storageKey", OLD."size", OLD."contentType", OLD."templateVersion", OLD."engine", OLD."variables", OLD."reason", OLD."createdAt")
     OR (NEW."authorId" IS DISTINCT FROM OLD."authorId" AND NEW."authorId" IS NOT NULL) THEN
    RAISE EXCEPTION 'une version du coffre est immuable';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "DocumentVersion_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DocumentVersion"
  FOR EACH ROW EXECUTE FUNCTION proofseen_document_version_guard();

-- Le journal d'accès est en ajout seul. Seule la référence à la personne peut disparaître avec son compte ; une ligne ne
-- se supprime qu'avec son document (cascade), jamais seule.
CREATE FUNCTION proofseen_document_access_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Document" WHERE "id" = OLD."documentId") THEN
      RAISE EXCEPTION 'le journal d''accès d''un document est en ajout seul';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW."documentId", NEW."versionNumber", NEW."action", NEW."at") IS DISTINCT FROM (OLD."documentId", OLD."versionNumber", OLD."action", OLD."at")
     OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL) THEN
    RAISE EXCEPTION 'le journal d''accès d''un document est en ajout seul';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "DocumentAccess_guard" BEFORE UPDATE OR DELETE ON "DocumentAccess"
  FOR EACH ROW EXECUTE FUNCTION proofseen_document_access_guard();
