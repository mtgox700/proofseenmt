-- CreateEnum
CREATE TYPE "ContractBilling" AS ENUM ('fixed', 'monthly');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('submitted', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "billing" "ContractBilling" NOT NULL DEFAULT 'fixed';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "billing" "ContractBilling" NOT NULL DEFAULT 'fixed';

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "halfDays" INTEGER NOT NULL,
    "note" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),
    "decidedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Timesheet_status_submittedAt_idx" ON "Timesheet"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_contractId_month_key" ON "Timesheet"("contractId", "month");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ═══ Régie ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Le contrat reprend aussi le mode de facturation du devis : un forfait ne devient pas une régie en route.
CREATE OR REPLACE FUNCTION proofseen_contract_parties() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."organisationId" IS NULL OR NEW."profileId" IS NULL THEN
    RAISE EXCEPTION 'un contrat se crée avec ses deux parties';
  END IF;
  -- Né d'un devis : ce devis est accepté, entre ces deux parties, et le contrat en reprend exactement les conditions.
  IF NEW."quoteId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Quote" q JOIN "Conversation" c ON c."id" = q."conversationId"
    WHERE q."id" = NEW."quoteId" AND q."status" = 'accepted'
      AND c."organisationId" = NEW."organisationId" AND c."profileId" = NEW."profileId"
      AND q."dailyRateCents" = NEW."dailyRateCents" AND q."days" = NEW."days" AND q."currency" = NEW."currency"
      AND q."billing" = NEW."billing"
  ) THEN
    RAISE EXCEPTION 'contrat incohérent avec son devis';
  END IF;
  RETURN NEW;
END $fn$;

-- Un mois au format « AAAA-MM », de 1 à 46 demi-journées (23 jours ouvrés au plus dans un mois).
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_month_chk" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_half_days_chk" CHECK ("halfDays" BETWEEN 1 AND 46);
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_note_chk" CHECK ("note" IS NULL OR char_length("note") <= 2000);
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_decision_chk" CHECK (("status" = 'submitted') = ("decidedAt" IS NULL));

-- Les règles d'un relevé, tenues par la base quel que soit le chemin d'écriture :
--  · seulement pour un contrat en régie, actif pour déclarer, actif ou terminé pour valider ;
--  · dans la période du contrat ;
--  · un relevé validé ne change plus ; un relevé refusé peut être corrigé et redéposé ;
--  · le total validé ne dépasse jamais le plafond de jours du contrat.
CREATE FUNCTION proofseen_timesheet_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD;
DECLARE approved_half_days INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'approved' THEN
      RAISE EXCEPTION 'un relevé validé ne change plus';
    END IF;
    IF NEW."contractId" <> OLD."contractId" OR NEW."month" <> OLD."month" THEN
      RAISE EXCEPTION 'un relevé ne change ni de contrat ni de mois';
    END IF;
    IF NEW."status" <> OLD."status" AND NOT (
         (OLD."status" = 'submitted' AND NEW."status" IN ('approved', 'rejected'))
      OR (OLD."status" = 'rejected' AND NEW."status" = 'submitted')
    ) THEN
      RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
    END IF;
  ELSIF NEW."status" <> 'submitted' THEN
    RAISE EXCEPTION 'un relevé naît déposé';
  END IF;

  -- Verrou sur le contrat : deux validations simultanées passent l'une après l'autre, le plafond tient.
  SELECT "billing", "status", "days", "startsOn", "endsOn" INTO c FROM "Contract" WHERE "id" = NEW."contractId" FOR UPDATE;
  IF c."billing" IS DISTINCT FROM 'monthly' THEN
    RAISE EXCEPTION 'relevé refusé : le contrat n''est pas en régie';
  END IF;
  IF NEW."status" = 'submitted' AND c."status" <> 'active' THEN
    RAISE EXCEPTION 'relevé refusé : le contrat n''est pas actif';
  END IF;
  IF NEW."status" = 'approved' AND c."status" NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'validation refusée : le contrat n''est ni actif ni terminé';
  END IF;
  IF NEW."month" < to_char(c."startsOn", 'YYYY-MM') OR (c."endsOn" IS NOT NULL AND NEW."month" > to_char(c."endsOn", 'YYYY-MM')) THEN
    RAISE EXCEPTION 'relevé refusé : mois hors de la période du contrat';
  END IF;
  IF NEW."status" = 'approved' THEN
    SELECT COALESCE(SUM("halfDays"), 0) INTO approved_half_days FROM "Timesheet"
      WHERE "contractId" = NEW."contractId" AND "status" = 'approved' AND "id" <> NEW."id";
    IF approved_half_days + NEW."halfDays" > c."days" * 2 THEN
      RAISE EXCEPTION 'validation refusée : le plafond de jours du contrat serait dépassé';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Timesheet_guard" BEFORE INSERT OR UPDATE ON "Timesheet"
  FOR EACH ROW EXECUTE FUNCTION proofseen_timesheet_guard();
