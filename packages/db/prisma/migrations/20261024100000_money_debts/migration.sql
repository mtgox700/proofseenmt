-- Dettes du flux d'argent (L0, constats K2, K3 et K5 de .war-room/tresor/L0_FLUX_ARGENT.md).
--   K2 : un virement est rattaché à la charge du paiement qui le finance (source_transaction) ; on garde donc la charge.
--   K3 : le taux de commission est une condition du contrat, écrite à sa création puis figée, comme repeatClient.
--   K5 : une facture émise après l'encaissement est acquittée, son échéance est le jour du paiement.

CREATE TYPE "FeePayer" AS ENUM ('freelance', 'company');

-- ═══ K2 : la charge du paiement ════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Payment" ADD COLUMN "chargeId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "Payment_chargeId_key" ON "Payment"("chargeId");

-- Aucun rétro-remplissage de la charge ni de la date d'encaissement : seul Stripe les connaît, et une date devinée
-- (« dernière mise à jour ») finirait sur une facture légale immuable. Les paiements bloqués avant cette migration les
-- reçoivent de Stripe au premier versement (lecture seule de l'intention, vérifiée, voir payment-source.ts) ou d'un
-- événement tardif ; d'ici là, leurs factures gardent l'échéance habituelle plutôt qu'un acquittement inventé.

-- La fonction d'origine (init), plus deux règles : une charge posée, et la date d'encaissement (qui date des factures
-- immuables), ne se réécrivent ni ne s'effacent. Nul vers valeur, une seule fois.
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
  IF OLD."chargeId" IS NOT NULL AND NEW."chargeId" IS DISTINCT FROM OLD."chargeId" THEN
    RAISE EXCEPTION 'la charge d''un paiement ne se réécrit pas';
  END IF;
  IF OLD."paidAt" IS NOT NULL AND NEW."paidAt" IS DISTINCT FROM OLD."paidAt" THEN
    RAISE EXCEPTION 'la date d''encaissement d''un paiement ne se réécrit pas';
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

-- ═══ K3 : le taux et le payeur de la commission sont une condition du contrat ══════════════════════════════════════

ALTER TABLE "Contract" ADD COLUMN "commissionBp" INTEGER;
ALTER TABLE "Contract" ADD COLUMN "feePayer" "FeePayer" NOT NULL DEFAULT 'freelance';

-- Rétro-remplissage : chaque contrat existant reçoit le taux qui lui aurait été appliqué à son paiement.
--   Le taux de la règle d'avant : 1000 pb (10 %, décision de la War Room du 2026-10-07), ou, si le freelance avait déjà
--   été payé par l'entreprise (repeatClient), le taux de fidélité de 500 pb (5 %), plus bas que 1000.
--   HYPOTHÈSE à vérifier avant d'appliquer en production : ce sont les valeurs de PROOFSEEN_COMMISSION_BP et
--   PROOFSEEN_REPEAT_COMMISSION_BP de l'environnement. Si elles diffèrent, corriger 1000 et 500 ci-dessous.
--   Mais quand un paiement a déjà été ouvert (le plus récent, hors annulé ou échoué), c'est lui qui fait foi : le taux
--   réellement prélevé. On retient d'abord le taux de la règle, puis 1000, puis 500, pourvu que leur commission arrondie
--   soit celle du paiement (on retrouve ainsi un taux rond malgré l'arrondi au centime) ; à défaut, le taux relu de
--   la commission (arrondi au point de base).
WITH applied AS (
  SELECT c."id", c."totalCents",
         CASE WHEN c."repeatClient" THEN 500 ELSE 1000 END AS rule_bp,
         p."commissionCents" AS paid_commission
  FROM "Contract" c
  LEFT JOIN LATERAL (
    SELECT "commissionCents" FROM "Payment"
    WHERE "contractId" = c."id" AND "status" NOT IN ('canceled', 'failed')
    ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
  ) p ON true
)
UPDATE "Contract" c SET "commissionBp" = CASE
  WHEN a.paid_commission IS NULL THEN a.rule_bp
  WHEN ROUND(a."totalCents"::bigint * a.rule_bp / 10000.0) = a.paid_commission THEN a.rule_bp
  WHEN ROUND(a."totalCents"::bigint * 1000 / 10000.0) = a.paid_commission THEN 1000
  WHEN ROUND(a."totalCents"::bigint * 500 / 10000.0) = a.paid_commission THEN 500
  ELSE COALESCE(GREATEST(1, LEAST(5000, ROUND(a.paid_commission::numeric * 10000 / NULLIF(a."totalCents", 0)))), a.rule_bp)
END
FROM applied a WHERE c."id" = a."id";

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_commission_chk" CHECK ("commissionBp" IS NULL OR "commissionBp" BETWEEN 1 AND 5000);

-- Le taux et le payeur sont des faits de la création du contrat : ils ne changent plus, pour qu'aucune partie ne
-- découvre après sa signature une commission différente de celle affichée. Une seule exception, comme pour la charge d'un
-- paiement : un contrat né sans taux (créé par une version de l'application qui ne l'écrivait pas, ou sans taux
-- configuré) peut en recevoir un, une fois, nul vers valeur ; ensuite il ne change plus.
CREATE FUNCTION proofseen_contract_commission_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."commissionBp" IS NOT NULL AND NEW."commissionBp" IS DISTINCT FROM OLD."commissionBp" THEN
    RAISE EXCEPTION 'taux de commission figé à la création du contrat';
  END IF;
  IF NEW."feePayer" IS DISTINCT FROM OLD."feePayer" THEN
    RAISE EXCEPTION 'payeur de la commission figé à la création du contrat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_commission_frozen" BEFORE UPDATE OF "commissionBp", "feePayer" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_commission_frozen();

-- ═══ K5 : une facture émise après l'encaissement est acquittée ═════════════════════════════════════════════════════

ALTER TABLE "Invoice" ADD COLUMN "paidOn" DATE;
ALTER TABLE "Invoice" ADD COLUMN "settlesNumber" TEXT;

-- Les factures déjà émises sont immuables et gardent leur échéance : paidOn et settlesNumber restent nuls pour elles.
-- Une facture acquittée (émise à la libération des fonds, L441-9 I) a pour échéance le jour du règlement, qui ne peut pas
-- suivre son émission ; une autre garde l'échéance d'au moins le jour d'émission. Les jours se comptent à l'heure de Paris,
-- comme l'année du numéro de la facture (les anciennes factures, échéance à trente jours, satisfont aussi cette règle).
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_due_chk";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_due_chk" CHECK (
  ("paidOn" IS NULL AND "dueOn" >= ("issuedAt" AT TIME ZONE 'Europe/Paris')::date)
  OR ("paidOn" IS NOT NULL AND "dueOn" = "paidOn" AND "paidOn" <= ("issuedAt" AT TIME ZONE 'Europe/Paris')::date)
);
