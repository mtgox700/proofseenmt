-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'planned', 'done', 'wontfix');

-- CreateEnum
CREATE TYPE "OperatorActionKind" AS ENUM ('profile_hidden', 'profile_restored', 'mission_hidden', 'mission_restored', 'company_page_hidden', 'company_page_restored', 'contact_cleared', 'contact_closed', 'vigilance_verified', 'vigilance_rejected', 'proof_revoked', 'registry_rechecked', 'user_suspended', 'user_restored', 'user_exported', 'feedback_triaged');

-- CreateEnum
CREATE TYPE "OperatorTargetType" AS ENUM ('profile', 'mission', 'organisation', 'conversation', 'vigilance', 'owned_url', 'user', 'feedback');

-- CreateEnum
CREATE TYPE "ContactReviewOutcome" AS ENUM ('ok', 'closed');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'account_notice';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMPTZ(3),
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "moderatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "FreelanceProfile" ADD COLUMN     "moderatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "VigilanceAttestation" ADD COLUMN     "rejectedAt" TIMESTAMPTZ(3),
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "JobPost" ADD COLUMN     "moderatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
ADD COLUMN     "triageNote" TEXT,
ADD COLUMN     "triagedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "OperatorAction" (
    "id" UUID NOT NULL,
    "operatorUserId" UUID NOT NULL,
    "action" "OperatorActionKind" NOT NULL,
    "targetType" "OperatorTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReview" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "flaggedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),
    "outcome" "ContactReviewOutcome",

    CONSTRAINT "ContactReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorAction_createdAt_id_idx" ON "OperatorAction"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "OperatorAction_targetType_targetId_createdAt_idx" ON "OperatorAction"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorAction_operatorUserId_createdAt_idx" ON "OperatorAction"("operatorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorAction_action_createdAt_idx" ON "OperatorAction"("action", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContactReview_conversationId_key" ON "ContactReview"("conversationId");

-- CreateIndex
CREATE INDEX "ContactReview_pending_idx" ON "ContactReview"("flaggedAt", "id") WHERE ("reviewedAt" IS NULL);

-- AddForeignKey
ALTER TABLE "ContactReview" ADD CONSTRAINT "ContactReview_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ═══ Back-office opérateur (C19) ═══════════════════════════════════════════════════════════════════════════════════

-- Un masquage, une suspension, un refus portent toujours leur motif, et le motif n'existe pas sans la décision : la
-- personne concernée lit toujours pourquoi.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_moderation_chk"
  CHECK (("moderatedAt" IS NULL) = ("moderationReason" IS NULL) AND ("moderationReason" IS NULL OR char_length(btrim("moderationReason")) BETWEEN 3 AND 1000));
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_moderation_chk"
  CHECK (("moderatedAt" IS NULL) = ("moderationReason" IS NULL) AND ("moderationReason" IS NULL OR char_length(btrim("moderationReason")) BETWEEN 3 AND 1000));
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_moderation_chk"
  CHECK (("moderatedAt" IS NULL) = ("moderationReason" IS NULL) AND ("moderationReason" IS NULL OR char_length(btrim("moderationReason")) BETWEEN 3 AND 1000));
ALTER TABLE "User" ADD CONSTRAINT "User_suspension_chk"
  CHECK (("suspendedAt" IS NULL) = ("suspensionReason" IS NULL) AND ("suspensionReason" IS NULL OR char_length(btrim("suspensionReason")) BETWEEN 3 AND 1000));
-- Une attestation est vérifiée ou refusée, jamais les deux.
ALTER TABLE "VigilanceAttestation" ADD CONSTRAINT "VigilanceAttestation_rejection_chk"
  CHECK (("rejectedAt" IS NULL) = ("rejectionReason" IS NULL) AND NOT ("rejectedAt" IS NOT NULL AND "verifiedAt" IS NOT NULL)
         AND ("rejectionReason" IS NULL OR char_length(btrim("rejectionReason")) BETWEEN 3 AND 1000));
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_triage_chk"
  CHECK ("triageNote" IS NULL OR char_length("triageNote") <= 2000);
-- Un fil relu a une issue, un fil en attente n'en a pas.
ALTER TABLE "ContactReview" ADD CONSTRAINT "ContactReview_outcome_chk" CHECK (("reviewedAt" IS NULL) = ("outcome" IS NULL));

-- Journal : le motif est obligatoire pour toute décision qui touche une personne ou ses contenus ; le contexte est un
-- objet JSON, jamais un texte libre.
ALTER TABLE "OperatorAction" ADD CONSTRAINT "OperatorAction_reason_chk"
  CHECK (("reason" IS NULL OR char_length(btrim("reason")) BETWEEN 3 AND 1000)
         AND ("action" IN ('contact_cleared', 'vigilance_verified', 'registry_rechecked', 'feedback_triaged') OR "reason" IS NOT NULL));
ALTER TABLE "OperatorAction" ADD CONSTRAINT "OperatorAction_metadata_chk" CHECK (jsonb_typeof("metadata") = 'object');

-- Ajout seul : aucune modification, jamais ; aucune suppression avant cinq ans (la purge de conservation, seule, les
-- retire ensuite). Effacer un compte n'y touche pas : la table n'a aucune clé étrangère.
CREATE FUNCTION proofseen_operator_action_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."createdAt" < now() - interval '5 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'OperatorAction est en ajout seul';
END $fn$;
CREATE TRIGGER "OperatorAction_append_only" BEFORE UPDATE OR DELETE ON "OperatorAction"
  FOR EACH ROW EXECUTE FUNCTION proofseen_operator_action_append_only();
CREATE TRIGGER "OperatorAction_no_truncate" BEFORE TRUNCATE ON "OperatorAction"
  FOR EACH STATEMENT EXECUTE FUNCTION proofseen_forbid_mutation();

-- Un opérateur peut fermer un premier contact signalé avant que le freelance n'ait répondu : en attente vers fermé, en
-- plus des transitions existantes. Aucune autre décision ne change ; l'application ne pose « fermé » sur un fil en
-- attente que depuis la file de relecture des opérateurs.
CREATE OR REPLACE FUNCTION proofseen_conversation_decision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('accepted', 'declined', 'closed'))
    OR (OLD."status" = 'accepted' AND NEW."status" = 'closed')
  ) THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  IF OLD."decidedAt" IS NOT NULL AND NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt" THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  RETURN NEW;
END $fn$;
