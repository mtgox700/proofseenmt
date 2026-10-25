-- Retour arrière de 20261024100000_money_debts. NE PAS le placer dans migrations/ (Prisma l'appliquerait) : il se joue à
-- la main, dans une transaction, après avoir redéployé la version précédente de l'application.
--
-- Avant :
--   1. pg_dump de "Payment", "Contract" et "Invoice" (quelques lignes) ;
--   2. SELECT count(*) FROM "Invoice" WHERE "paidOn" IS NOT NULL;  doit valoir 0. Une facture émise après l'encaissement
--      a une échéance antérieure à son émission, que l'ancienne contrainte refuse, et une facture est immuable : s'il en
--      existe, ne pas revenir en arrière (garder la colonne et la contrainte), corriger en avant ;
--   3. les colonnes "chargeId" et "paidAt" des paiements sont perdues : les noter si besoin (SELECT id, "chargeId",
--      "paidAt" FROM "Payment" WHERE "chargeId" IS NOT NULL OR "paidAt" IS NOT NULL).
-- Après : DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261024100000_money_debts'; (ou
--   prisma migrate resolve --rolled-back 20261024100000_money_debts).

BEGIN;

-- K3 : taux et payeur de la commission.
DROP TRIGGER "Contract_commission_frozen" ON "Contract";
DROP FUNCTION proofseen_contract_commission_frozen();
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_commission_chk";
ALTER TABLE "Contract" DROP COLUMN "commissionBp";
ALTER TABLE "Contract" DROP COLUMN "feePayer";
DROP TYPE "FeePayer";

-- K5 : factures acquittées (contrainte d'origine, init).
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_due_chk";
ALTER TABLE "Invoice" DROP COLUMN "paidOn";
ALTER TABLE "Invoice" DROP COLUMN "settlesNumber";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_due_chk" CHECK ("dueOn" >= ("issuedAt" AT TIME ZONE 'UTC')::date);

-- K2 : charge et date d'encaissement. Le déclencheur d'origine (init) est rétabli ; le déclencheur lui-même ne change pas.
DROP INDEX "Payment_chargeId_key";
ALTER TABLE "Payment" DROP COLUMN "chargeId";
ALTER TABLE "Payment" DROP COLUMN "paidAt";
-- Un paiement reste attaché à son contrat, dans sa devise, pour son montant ; seuls son statut et ses remboursements évoluent.
CREATE OR REPLACE FUNCTION proofseen_payment_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."contractId" <> OLD."contractId" OR NEW."currency" <> OLD."currency" OR NEW."amountCents" <> OLD."amountCents"
     OR NEW."commissionCents" <> OLD."commissionCents" OR NEW."stripeIntentId" <> OLD."stripeIntentId" THEN
    RAISE EXCEPTION 'un paiement enregistré ne change ni de contrat ni de montant';
  END IF;
  IF NEW."refundedCents" < OLD."refundedCents" THEN
    RAISE EXCEPTION 'un remboursement ne s''annule pas';
  END IF;
  IF OLD."transferId" IS NOT NULL AND NEW."transferId" IS DISTINCT FROM OLD."transferId" THEN
    RAISE EXCEPTION 'un versement ne se réécrit pas';
  END IF;
  -- Parcours fermé. Un versement ou un remboursement est d'abord réservé (releasing, refunding) avant tout appel au
  -- prestataire, puis confirmé, ou rendu à « bloqué » si l'appel a échoué. Un versement n'est jamais rejoué.
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('held', 'canceled'))
    OR (OLD."status" = 'held' AND NEW."status" IN ('releasing', 'refunding', 'refunded'))
    OR (OLD."status" = 'releasing' AND NEW."status" IN ('released', 'held'))
    OR (OLD."status" = 'refunding' AND NEW."status" IN ('refunded', 'held'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  -- On ne verse que pour un contrat terminé, et jamais sous un litige ouvert ou perdu.
  IF NEW."status" IN ('releasing', 'released') AND OLD."status" NOT IN ('releasing', 'released') THEN
    IF NOT EXISTS (SELECT 1 FROM "Contract" WHERE "id" = NEW."contractId" AND "status" = 'completed') THEN
      RAISE EXCEPTION 'versement refusé : la prestation n''est pas validée';
    END IF;
    IF NEW."disputeOpenedAt" IS NOT NULL AND NEW."disputeWon" IS NOT TRUE THEN
      RAISE EXCEPTION 'versement refusé : litige en cours ou perdu';
    END IF;
    IF NEW."refundedCents" > 0 THEN
      RAISE EXCEPTION 'versement refusé : paiement déjà remboursé en partie';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

COMMIT;
