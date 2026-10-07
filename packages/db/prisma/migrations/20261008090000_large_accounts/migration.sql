-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "approvalLevels" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "costCenter" TEXT;

-- CreateTable
CREATE TABLE "ContractApproval" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "userId" UUID,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractApproval_contractId_idx" ON "ContractApproval"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractApproval_contractId_userId_key" ON "ContractApproval"("contractId", "userId");

-- AddForeignKey
ALTER TABLE "ContractApproval" ADD CONSTRAINT "ContractApproval_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractApproval" ADD CONSTRAINT "ContractApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ═══ Grands comptes ═══════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_approval_levels_chk" CHECK ("approvalLevels" BETWEEN 1 AND 2);
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_cost_center_chk" CHECK ("costCenter" IS NULL OR char_length("costCenter") BETWEEN 1 AND 60);

-- Une validation vient d'un administrateur de l'entreprise du contrat, jamais du freelance du contrat.
CREATE FUNCTION proofseen_contract_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."userId" IS NULL THEN
    RAISE EXCEPTION 'une validation a un auteur';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Contract" c JOIN "Membership" m ON m."organisationId" = c."organisationId"
    WHERE c."id" = NEW."contractId" AND m."userId" = NEW."userId" AND m."role" IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'validation refusée : l''auteur n''administre pas l''entreprise du contrat';
  END IF;
  IF EXISTS (SELECT 1 FROM "Contract" c JOIN "FreelanceProfile" p ON p."id" = c."profileId" WHERE c."id" = NEW."contractId" AND p."userId" = NEW."userId") THEN
    RAISE EXCEPTION 'validation refusée : le freelance ne valide pas sa propre prestation';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "ContractApproval_guard" BEFORE INSERT ON "ContractApproval"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_approval_guard();

-- Deux niveaux exigés : la prestation n'est validée (et le versement déclenché) qu'avec deux validations distinctes.
CREATE FUNCTION proofseen_contract_two_level() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE levels INTEGER;
BEGIN
  IF NEW."status" = 'completed' AND OLD."status" <> 'completed' THEN
    SELECT o."approvalLevels" INTO levels FROM "Organisation" o WHERE o."id" = NEW."organisationId";
    IF COALESCE(levels, 1) >= 2 AND (SELECT count(DISTINCT "userId") FROM "ContractApproval" WHERE "contractId" = NEW."id" AND "userId" IS NOT NULL) < levels THEN
      RAISE EXCEPTION 'validation refusée : deux validations distinctes sont exigées par l''entreprise';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_two_level" BEFORE UPDATE OF "status" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_two_level();
