-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperatorActionKind" ADD VALUE 'organisation_hidden';
ALTER TYPE "OperatorActionKind" ADD VALUE 'organisation_restored';

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "suspendedAt" TIMESTAMPTZ(3),
ADD COLUMN     "suspensionReason" TEXT;

-- CreateTable
CREATE TABLE "ErasureTombstone" (
    "emailHash" TEXT NOT NULL,
    "suspendedAt" TIMESTAMPTZ(3) NOT NULL,
    "suspensionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErasureTombstone_pkey" PRIMARY KEY ("emailHash")
);

-- CreateIndex
CREATE INDEX "ErasureTombstone_createdAt_idx" ON "ErasureTombstone"("createdAt");



-- ═══ Revue de sécurité vague 3 ════════════════════════════════════════════════════════════════════════════════════

-- M5 : une entreprise entière masquée porte toujours son motif, et le motif n'existe pas sans la décision.
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_suspension_chk"
  CHECK (("suspendedAt" IS NULL) = ("suspensionReason" IS NULL) AND ("suspensionReason" IS NULL OR char_length(btrim("suspensionReason")) BETWEEN 3 AND 1000));

-- L11 : la trace d'un compte suspendu puis effacé n'est qu'une empreinte (HMAC-SHA256 en base64url, 43 caractères),
-- jamais une adresse, avec le motif et la date de la suspension.
ALTER TABLE "ErasureTombstone" ADD CONSTRAINT "ErasureTombstone_hash_chk" CHECK ("emailHash" ~ '^[A-Za-z0-9_-]{43}$');
ALTER TABLE "ErasureTombstone" ADD CONSTRAINT "ErasureTombstone_reason_chk"
  CHECK (char_length(btrim("suspensionReason")) BETWEEN 3 AND 1000);

-- L15 : « en attente » vers « fermé » n'est permis qu'à la relecture des premiers contacts par un opérateur, qui le
-- déclare dans sa transaction (`set_config('proofseen.operator_review', 'on', true)`, l'équivalent de SET LOCAL). Les
-- autres transitions ne changent pas. Ce garde-fou attrape une erreur de l'application, pas un rôle de base compromis :
-- toute session peut poser ce réglage (voir la note de la revue pour les droits du rôle applicatif).
CREATE OR REPLACE FUNCTION proofseen_conversation_decision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('accepted', 'declined'))
    OR (OLD."status" = 'pending' AND NEW."status" = 'closed' AND coalesce(current_setting('proofseen.operator_review', true), '') = 'on')
    OR (OLD."status" = 'accepted' AND NEW."status" = 'closed')
  ) THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  IF OLD."decidedAt" IS NOT NULL AND NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt" THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  RETURN NEW;
END $fn$;
