-- ═══ Grands comptes : durcissement après relecture ═══════════════════════════════════════════════════════════════

-- Deux niveaux exigés, mais jamais plus de validations que l'entreprise n'a d'administrateurs : un administrateur parti
-- ne bloque pas à vie le versement d'une prestation. Et seule compte la validation d'une personne encore administratrice.
CREATE OR REPLACE FUNCTION proofseen_contract_two_level() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  levels INTEGER;
  admins INTEGER;
  approved INTEGER;
BEGIN
  IF NEW."status" = 'completed' AND OLD."status" <> 'completed' THEN
    SELECT o."approvalLevels" INTO levels FROM "Organisation" o WHERE o."id" = NEW."organisationId";
    IF COALESCE(levels, 1) >= 2 THEN
      SELECT count(*) INTO admins FROM "Membership" m WHERE m."organisationId" = NEW."organisationId" AND m."role" IN ('owner', 'admin');
      SELECT count(DISTINCT a."userId") INTO approved FROM "ContractApproval" a
        JOIN "Membership" m ON m."userId" = a."userId" AND m."organisationId" = NEW."organisationId" AND m."role" IN ('owner', 'admin')
        WHERE a."contractId" = NEW."id";
      IF approved < GREATEST(1, LEAST(levels, admins)) THEN
        RAISE EXCEPTION 'validation refusée : deux validations distinctes sont exigées par l''entreprise';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

-- Une validation est un fait daté : ni supprimée, ni réattribuée. Seul l'effacement du compte de son auteur la modifie,
-- en mettant l'auteur à NULL.
CREATE FUNCTION proofseen_contract_approval_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une validation ne se supprime pas';
  END IF;
  IF NEW."userId" IS NOT NULL OR NEW."contractId" <> OLD."contractId" OR NEW."approvedAt" <> OLD."approvedAt" THEN
    RAISE EXCEPTION 'une validation ne se modifie pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "ContractApproval_frozen" BEFORE UPDATE OR DELETE ON "ContractApproval"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_approval_frozen();

-- Une clé d'API ne survit pas aux droits de la personne qui l'a créée : effacement du compte (auteur mis à NULL),
-- départ de l'entreprise ou perte du rôle d'administrateur la révoquent.
CREATE OR REPLACE FUNCTION proofseen_api_key_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."hash" <> OLD."hash" OR NEW."organisationId" <> OLD."organisationId" OR NEW."prefix" <> OLD."prefix" THEN
    RAISE EXCEPTION 'clé d''API figée : empreinte, préfixe et entreprise ne changent pas';
  END IF;
  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'clé d''API révoquée pour toujours';
  END IF;
  IF OLD."createdByUserId" IS NOT NULL AND NEW."createdByUserId" IS NULL AND NEW."revokedAt" IS NULL THEN
    NEW."revokedAt" := now();
  END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION proofseen_membership_revokes_keys() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."role" IN ('owner', 'admin') AND (TG_OP = 'DELETE' OR NEW."role" NOT IN ('owner', 'admin')) THEN
    UPDATE "ApiKey" SET "revokedAt" = now()
      WHERE "organisationId" = OLD."organisationId" AND "createdByUserId" = OLD."userId" AND "revokedAt" IS NULL;
  END IF;
  RETURN NULL;
END $fn$;
CREATE TRIGGER "Membership_revokes_keys" AFTER UPDATE OF "role" OR DELETE ON "Membership"
  FOR EACH ROW EXECUTE FUNCTION proofseen_membership_revokes_keys();

-- Le centre de coûts est figé dès que la facture de mission existe : un export d'une période close ne change plus.
CREATE FUNCTION proofseen_contract_cost_center_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."costCenter" IS DISTINCT FROM OLD."costCenter"
     AND EXISTS (SELECT 1 FROM "Invoice" i WHERE i."contractId" = NEW."id" AND i."kind" = 'mission') THEN
    RAISE EXCEPTION 'centre de coûts figé : la facture de mission est émise';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_cost_center_frozen" BEFORE UPDATE OF "costCenter" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_cost_center_frozen();
