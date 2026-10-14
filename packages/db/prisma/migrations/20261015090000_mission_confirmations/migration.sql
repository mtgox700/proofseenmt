-- CreateEnum
CREATE TYPE "MissionConfirmationStatus" AS ENUM ('pending', 'confirmed', 'refused');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceKind" ADD VALUE 'client_confirmation';
ALTER TYPE "EvidenceKind" ADD VALUE 'paid_on_platform';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'mission_confirmation';

-- AlterTable
ALTER TABLE "VerifiedMission" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "confirmationId" UUID,
ADD COLUMN     "confirmedByDomain" TEXT,
ADD COLUMN     "confirmedByOrganisationId" UUID,
ADD COLUMN     "contractId" UUID;

-- CreateTable
CREATE TABLE "MissionConfirmationRequest" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientSiret" CHAR(14),
    "clientKind" "ClientKind" NOT NULL,
    "organisationId" UUID,
    "contactEmail" TEXT,
    "startedOn" DATE NOT NULL,
    "endedOn" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "lang" CHAR(2) NOT NULL DEFAULT 'fr',
    "tokenHash" TEXT,
    "status" "MissionConfirmationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),
    "decidedByUserId" UUID,
    "showClientName" BOOLEAN NOT NULL DEFAULT false,
    "emailSendAfter" TIMESTAMPTZ(3),
    "emailSentAt" TIMESTAMPTZ(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionConfirmationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionConfirmationRequest_tokenHash_key" ON "MissionConfirmationRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_profileId_createdAt_idx" ON "MissionConfirmationRequest"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_organisation_idx" ON "MissionConfirmationRequest"("organisationId", "status") WHERE ("organisationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_mail_idx" ON "MissionConfirmationRequest"("emailSendAfter", "id") WHERE ("emailSentAt" IS NULL AND "contactEmail" IS NOT NULL AND "status" = 'pending');

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_contactEmail_idx" ON "MissionConfirmationRequest"("contactEmail") WHERE ("contactEmail" IS NOT NULL);

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_decidedByUserId_idx" ON "MissionConfirmationRequest"("decidedByUserId") WHERE ("decidedByUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "MissionConfirmationRequest_expiresAt_idx" ON "MissionConfirmationRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedMission_confirmationId_key" ON "VerifiedMission"("confirmationId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedMission_contractId_key" ON "VerifiedMission"("contractId");

-- CreateIndex
CREATE INDEX "VerifiedMission_confirmedByOrganisationId_idx" ON "VerifiedMission"("confirmedByOrganisationId") WHERE ("confirmedByOrganisationId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "MissionConfirmationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_confirmedByOrganisationId_fkey" FOREIGN KEY ("confirmedByOrganisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;




-- ═══ Missions vérifiées par le client ou par un paiement sur Proofseen ════════════════════════════════════════════
-- Exactement une cible : l'entreprise inscrite, ou le contact par e-mail. Un contact par e-mail a toujours un jeton.
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_one_target"
  CHECK (("organisationId" IS NULL) <> ("contactEmail" IS NULL));
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_email_has_token"
  CHECK ("contactEmail" IS NULL OR "tokenHash" IS NOT NULL);
-- Une adresse en minuscules, comme celle des comptes : « A@x.fr » et « a@x.fr » sont le même contact.
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_email_format"
  CHECK ("contactEmail" IS NULL OR ("contactEmail" = lower("contactEmail") AND char_length("contactEmail") <= 254 AND "contactEmail" LIKE '%_@_%'));
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_text_chk"
  CHECK (char_length("role") BETWEEN 2 AND 200 AND char_length("clientName") BETWEEN 2 AND 200 AND char_length("summary") BETWEEN 10 AND 2000);
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_siret_format"
  CHECK ("clientSiret" IS NULL OR "clientSiret" ~ '^[0-9]{14}$');
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_period_chk" CHECK ("endedOn" >= "startedOn");
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_lang_chk" CHECK ("lang" IN ('fr', 'en'));
-- Une demande décidée a une date de décision ; une demande en attente n'en a pas.
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_decided_dated"
  CHECK (("status" = 'pending') = ("decidedAt" IS NULL));
-- Le client n'autorise l'affichage de son nom qu'en confirmant.
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_name_consent"
  CHECK (NOT "showClientName" OR "status" = 'confirmed');
ALTER TABLE "MissionConfirmationRequest" ADD CONSTRAINT "MissionConfirmationRequest_attempts_range" CHECK ("emailAttempts" BETWEEN 0 AND 20);
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_origin_chk"
  CHECK (("clientName" IS NULL OR char_length("clientName") BETWEEN 2 AND 200) AND ("confirmedByDomain" IS NULL OR char_length("confirmedByDomain") <= 253));
