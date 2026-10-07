-- AlterTable
ALTER TABLE "BillingIdentity" ADD COLUMN     "invoicingMandateAt" TIMESTAMPTZ(3);


-- Un contrat en régie ne passe pas par le paiement unique du forfait : il se paie mois par mois, sur relevé validé.
-- Sans cette garde, l'entreprise pourrait payer et faire verser tout le plafond de jours sans aucun relevé.
CREATE OR REPLACE FUNCTION proofseen_payment_contract_active() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD;
BEGIN
  SELECT "status", "billing" INTO c FROM "Contract" WHERE "id" = NEW."contractId";
  IF c."status" IS NULL OR c."status" NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'paiement refusé : le contrat n''est pas signé';
  END IF;
  IF c."billing" <> 'fixed' THEN
    RAISE EXCEPTION 'paiement refusé : un contrat en régie se paie par relevé mensuel';
  END IF;
  RETURN NEW;
END $fn$;

-- Relecture C10. Le règlement de l'effacement d'un compte (ON DELETE SET NULL sur le décideur) est une mise à jour du
-- relevé : elle doit passer, même sur un relevé validé, quand elle ne touche que le décideur.
CREATE OR REPLACE FUNCTION proofseen_timesheet_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD;
DECLARE approved_half_days INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."decidedByUserId" IS NULL AND OLD."decidedByUserId" IS NOT NULL
       AND NEW."contractId" = OLD."contractId" AND NEW."month" = OLD."month" AND NEW."halfDays" = OLD."halfDays"
       AND NEW."note" IS NOT DISTINCT FROM OLD."note" AND NEW."status" = OLD."status"
       AND NEW."decidedAt" IS NOT DISTINCT FROM OLD."decidedAt" AND NEW."submittedAt" = OLD."submittedAt" THEN
      RETURN NEW;
    END IF;
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

-- Le mode de facturation ne change plus une fois le devis envoyé, ni jamais sur un contrat : sinon une écriture
-- directe ferait passer une régie active en forfait et paierait tout le plafond.
CREATE FUNCTION proofseen_contract_billing_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."billing" IS DISTINCT FROM OLD."billing" THEN
    RAISE EXCEPTION 'le mode de facturation d''un contrat ne change pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_billing_frozen" BEFORE UPDATE OF "billing" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_billing_frozen();

CREATE FUNCTION proofseen_quote_billing_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."billing" IS DISTINCT FROM OLD."billing" AND OLD."status" <> 'draft' THEN
    RAISE EXCEPTION 'un devis envoyé ne change pas de mode de facturation';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Quote_billing_frozen" BEFORE UPDATE OF "billing" ON "Quote"
  FOR EACH ROW EXECUTE FUNCTION proofseen_quote_billing_frozen();
