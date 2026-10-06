-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClientKind" AS ENUM ('startup', 'scaleup', 'grand_groupe', 'eti', 'pme', 'secteur_public', 'editeur_logiciel', 'esn', 'association');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('facture', 'contrat', 'attestation_client', 'acces_depot', 'livrable_public');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'available_from', 'unavailable');

-- CreateEnum
CREATE TYPE "ProofMethod" AS ENUM ('well_known_file', 'meta_tag', 'dns_txt', 'profile_token');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('named', 'pseudonymous', 'private');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('onsite', 'hybrid', 'remote');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "JobPostStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'shortlisted', 'declined', 'withdrawn', 'hired');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('pending', 'accepted', 'declined', 'closed');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'superseded', 'closed');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('pending_signatures', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'held', 'releasing', 'released', 'refunding', 'refunded', 'disputed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('mission', 'commission');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('contact_received', 'application_received', 'message_received', 'application_status', 'mission_match', 'contract_update');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "lang" CHAR(2) NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ClientKind" NOT NULL,
    "siret" TEXT,
    "vatNumber" TEXT,
    "billingAddress" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("organisationId","userId")
);

-- CreateTable
CREATE TABLE "FreelanceProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'private',
    "headline" TEXT,
    "summary" TEXT,
    "city" TEXT,
    "cityKey" TEXT,
    "workMode" "WorkMode" NOT NULL,
    "dailyRateCents" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'available',
    "availableFrom" DATE,
    "availabilityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreelanceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingIdentity" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "siret" TEXT,
    "vatNumber" TEXT,
    "address" JSONB NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 0,
    "stripeAccountId" TEXT,
    "payoutsEnabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelanceSkill" (
    "profileId" UUID NOT NULL,
    "skillId" UUID NOT NULL,

    CONSTRAINT "FreelanceSkill_pkey" PRIMARY KEY ("profileId","skillId")
);

-- CreateTable
CREATE TABLE "OwnedUrl" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "proofMethod" "ProofMethod" NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedMission" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "clientKind" "ClientKind" NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceKind" "EvidenceKind" NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPost" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "authorUserId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMonths" INTEGER,
    "dailyRateMinCents" INTEGER,
    "dailyRateMaxCents" INTEGER,
    "currency" CHAR(3) NOT NULL,
    "city" TEXT,
    "cityKey" TEXT,
    "workMode" "WorkMode" NOT NULL,
    "status" "JobPostStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPostSkill" (
    "jobPostId" UUID NOT NULL,
    "skillId" UUID NOT NULL,

    CONSTRAINT "JobPostSkill_pkey" PRIMARY KEY ("jobPostId","skillId")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "jobPostId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "coverNote" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "applicationId" UUID,
    "direct" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConversationStatus" NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderUserId" UUID,
    "body" TEXT NOT NULL,
    "containsContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "dailyRateCents" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "quoteId" UUID,
    "organisationId" UUID,
    "profileId" UUID,
    "dailyRateCents" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "sellerSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "acceptedByFreelanceAt" TIMESTAMPTZ(3),
    "acceptedByOrgAt" TIMESTAMPTZ(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'pending_signatures',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "stripeIntentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "transferId" TEXT,
    "releasedAt" TIMESTAMPTZ(3),
    "claimedAt" TIMESTAMPTZ(3),
    "disputeOpenedAt" TIMESTAMPTZ(3),
    "disputeWon" BOOLEAN,
    "needsReviewAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "issuer" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("issuer","year")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "issuer" TEXT NOT NULL,
    "contractId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "netCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "sellerSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueOn" DATE NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "authorUserId" UUID,
    "targetProfileId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRequest" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "urls" TEXT[],
    "lang" CHAR(2) NOT NULL,
    "consentAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wave" (
    "id" UUID NOT NULL,
    "waveId" TEXT NOT NULL,
    "profileId" UUID,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "draws" INTEGER NOT NULL,
    "costCents" INTEGER,
    "currency" CHAR(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilityResult" (
    "id" UUID NOT NULL,
    "waveRefId" UUID NOT NULL,
    "engine" TEXT NOT NULL,
    "draws" INTEGER NOT NULL,
    "retrieved" INTEGER NOT NULL,
    "named" INTEGER NOT NULL,
    "top5" INTEGER NOT NULL,
    "cited" INTEGER NOT NULL,

    CONSTRAINT "VisibilityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "email" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","kind")
);

-- CreateTable
CREATE TABLE "MissionAlert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceProfile_userId_key" ON "FreelanceProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceProfile_reference_key" ON "FreelanceProfile"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceProfile_slug_key" ON "FreelanceProfile"("slug");

-- CreateIndex
CREATE INDEX "FreelanceProfile_public_search_idx" ON "FreelanceProfile"("workMode", "availability", "id") WHERE ("visibility" <> 'private');

-- CreateIndex
CREATE INDEX "FreelanceProfile_public_city_idx" ON "FreelanceProfile"("cityKey", "workMode", "id") WHERE ("visibility" <> 'private');

-- CreateIndex
CREATE UNIQUE INDEX "BillingIdentity_profileId_key" ON "BillingIdentity"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingIdentity_stripeAccountId_key" ON "BillingIdentity"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_key_key" ON "Skill"("key");

-- CreateIndex
CREATE INDEX "FreelanceSkill_skillId_profileId_idx" ON "FreelanceSkill"("skillId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedUrl_profileId_urlKey_key" ON "OwnedUrl"("profileId", "urlKey");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedUrl_verified_uq" ON "OwnedUrl"("urlKey") WHERE ("verifiedAt" IS NOT NULL);

-- CreateIndex
CREATE INDEX "VerifiedMission_profileId_idx" ON "VerifiedMission"("profileId");

-- CreateIndex
CREATE INDEX "JobPost_open_recent_idx" ON "JobPost"("publishedAt" DESC, "id" DESC) WHERE ("status" = 'open');

-- CreateIndex
CREATE INDEX "JobPost_open_workmode_recent_idx" ON "JobPost"("workMode", "publishedAt" DESC, "id" DESC) WHERE ("status" = 'open');

-- CreateIndex
CREATE INDEX "JobPost_open_city_recent_idx" ON "JobPost"("cityKey", "publishedAt" DESC, "id" DESC) WHERE ("status" = 'open');

-- CreateIndex
CREATE INDEX "JobPost_organisationId_createdAt_idx" ON "JobPost"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobPost_authorUserId_idx" ON "JobPost"("authorUserId") WHERE ("authorUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "JobPostSkill_skillId_jobPostId_idx" ON "JobPostSkill"("skillId", "jobPostId");

-- CreateIndex
CREATE INDEX "Application_jobPostId_status_createdAt_idx" ON "Application"("jobPostId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Application_profileId_createdAt_idx" ON "Application"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobPostId_profileId_key" ON "Application"("jobPostId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_applicationId_key" ON "Conversation"("applicationId");

-- CreateIndex
CREATE INDEX "Conversation_profileId_lastMessageAt_id_idx" ON "Conversation"("profileId", "lastMessageAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Conversation_organisationId_lastMessageAt_id_idx" ON "Conversation"("organisationId", "lastMessageAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_direct_uq" ON "Conversation"("organisationId", "profileId") WHERE ("direct");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId") WHERE ("senderUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "Quote_conversationId_idx" ON "Quote"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_one_accepted_uq" ON "Quote"("conversationId") WHERE ("status" = 'accepted');

-- CreateIndex
CREATE UNIQUE INDEX "Contract_quoteId_key" ON "Contract"("quoteId");

-- CreateIndex
CREATE INDEX "Contract_profileId_status_idx" ON "Contract"("profileId", "status");

-- CreateIndex
CREATE INDEX "Contract_organisationId_status_idx" ON "Contract"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_id_currency_key" ON "Contract"("id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeIntentId_key" ON "Payment"("stripeIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transferId_key" ON "Payment"("transferId");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "StripeEvent_receivedAt_idx" ON "StripeEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_contractId_kind_key" ON "Invoice"("contractId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Review_contractId_key" ON "Review"("contractId");

-- CreateIndex
CREATE INDEX "Review_targetProfileId_createdAt_idx" ON "Review"("targetProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Review_authorUserId_idx" ON "Review"("authorUserId") WHERE ("authorUserId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "AuditRequest_reference_key" ON "AuditRequest"("reference");

-- CreateIndex
CREATE INDEX "AuditRequest_email_idx" ON "AuditRequest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wave_waveId_key" ON "Wave"("waveId");

-- CreateIndex
CREATE INDEX "Wave_profileId_idx" ON "Wave"("profileId") WHERE ("profileId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityResult_waveRefId_engine_key" ON "VisibilityResult"("waveRefId", "engine");

-- CreateIndex
CREATE INDEX "Notification_pending_idx" ON "Notification"("sendAfter") WHERE ("sentAt" IS NULL);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MissionAlert_userId_idx" ON "MissionAlert"("userId");

-- CreateIndex
CREATE INDEX "MissionAlert_lastCheckedAt_idx" ON "MissionAlert"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingIdentity" ADD CONSTRAINT "BillingIdentity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceSkill" ADD CONSTRAINT "FreelanceSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceSkill" ADD CONSTRAINT "FreelanceSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedUrl" ADD CONSTRAINT "OwnedUrl_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostSkill" ADD CONSTRAINT "JobPostSkill_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostSkill" ADD CONSTRAINT "JobPostSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_currency_fkey" FOREIGN KEY ("contractId", "currency") REFERENCES "Contract"("id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_currency_fkey" FOREIGN KEY ("contractId", "currency") REFERENCES "Contract"("id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityResult" ADD CONSTRAINT "VisibilityResult_waveRefId_fkey" FOREIGN KEY ("waveRefId") REFERENCES "Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAlert" ADD CONSTRAINT "MissionAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Contraintes et déclencheurs que Prisma ne sait pas exprimer. Ils protègent les données même si un code oublie de
-- valider : la dernière ligne de défense est dans la base.
--
-- Règle tenue partout : une colonne qui peut devenir NULL par suppression de compte (RGPD) n'est jamais exigée par un
-- CHECK, qui ferait échouer la suppression. Elle est exigée à la création par un déclencheur.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- Devises : liste fermée, élargie quand un marché ouvre. Toutes ont deux décimales : les centimes restent justes.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_currency_chk" CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "JobPost"          ADD CONSTRAINT "JobPost_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Quote"            ADD CONSTRAINT "Quote_currency_chk"            CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Contract"         ADD CONSTRAINT "Contract_currency_chk"         CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Payment"          ADD CONSTRAINT "Payment_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Invoice"          ADD CONSTRAINT "Invoice_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Wave"             ADD CONSTRAINT "Wave_currency_chk"             CHECK ("currency" IN ('EUR','GBP','CHF','USD'));

-- Argent. Entiers 32 bits : 21,4 M€ par ligne, très au-dessus de tout contrat freelance ; les bornes attrapent surtout
-- les erreurs d'unité (des euros saisis comme des centimes). Les produits sont calculés en 64 bits.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_rate_chk" CHECK ("dailyRateCents" IS NULL OR "dailyRateCents" BETWEEN 0 AND 10000000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_rate_chk" CHECK (
  ("dailyRateMinCents" IS NULL OR "dailyRateMinCents" BETWEEN 0 AND 10000000) AND
  ("dailyRateMaxCents" IS NULL OR "dailyRateMaxCents" BETWEEN 0 AND 10000000) AND
  ("dailyRateMinCents" IS NULL OR "dailyRateMaxCents" IS NULL OR "dailyRateMinCents" <= "dailyRateMaxCents"));
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_amounts_chk" CHECK (
  "dailyRateCents" BETWEEN 0 AND 10000000 AND "days" BETWEEN 1 AND 1000 AND "totalCents" = "dailyRateCents"::bigint * "days");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_amounts_chk" CHECK (
  "dailyRateCents" BETWEEN 0 AND 10000000 AND "days" BETWEEN 1 AND 1000 AND "totalCents" = "dailyRateCents"::bigint * "days");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amounts_chk" CHECK (
  "amountCents" > 0 AND "commissionCents" BETWEEN 0 AND "amountCents" AND "refundedCents" BETWEEN 0 AND "amountCents");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_chk" CHECK (
  "netCents" >= 0 AND "vatCents" >= 0 AND "vatRateBp" BETWEEN 0 AND 10000 AND "totalCents" = "netCents"::bigint + "vatCents");
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_chk" CHECK ("year" BETWEEN 2000 AND 2999 AND "last" >= 0);
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_counts_chk" CHECK ("costCents" >= 0 AND "draws" >= 0);

-- Profil : un brouillon privé peut être incomplet ; un profil publié, non.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_publishable_chk" CHECK (
  "visibility" = 'private' OR ("slug" IS NOT NULL AND "headline" IS NOT NULL AND "summary" IS NOT NULL AND "city" IS NOT NULL));
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_availability_chk" CHECK (
  ("availability" = 'available_from') = ("availableFrom" IS NOT NULL));
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_slug_chk" CHECK ("slug" IS NULL OR "slug" ~ '^[a-z0-9-]{3,60}$');
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_reference_chk" CHECK ("reference" ~ '^FR-[A-Z2-9]{5,8}$');
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_text_chk" CHECK (
  char_length(coalesce("headline", '')) <= 200 AND char_length(coalesce("summary", '')) <= 4000);
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_reference_chk" CHECK ("reference" ~ '^FR-[A-Z2-9]{5,8}$');

-- Formes normalisées : une seule écriture possible d'une même chose.
ALTER TABLE "User"         ADD CONSTRAINT "User_email_lower_chk"         CHECK ("email" = lower("email"));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_email_lower_chk" CHECK ("email" = lower("email"));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_lang_chk"        CHECK ("lang" IN ('fr','en'));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_urls_chk"        CHECK (cardinality("urls") BETWEEN 1 AND 10);
ALTER TABLE "Skill"        ADD CONSTRAINT "Skill_key_lower_chk"          CHECK ("key" = lower("key"));
ALTER TABLE "OwnedUrl"     ADD CONSTRAINT "OwnedUrl_urlKey_chk"          CHECK ("urlKey" !~ '/$');

-- Missions et candidatures.
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_chk" CHECK (
  "durationMonths" BETWEEN 1 AND 600 AND char_length("role") <= 200 AND char_length("summary") <= 2000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_duration_chk" CHECK ("durationMonths" IS NULL OR "durationMonths" BETWEEN 1 AND 600);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_text_chk" CHECK (
  char_length("title") BETWEEN 1 AND 200 AND char_length("description") BETWEEN 1 AND 20000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_location_chk" CHECK ("workMode" = 'remote' OR "city" IS NOT NULL);
-- Une mission ouverte a une date de publication ; une mission close, une date de clôture, postérieure.
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_state_dates_chk" CHECK (
  ("status" <> 'open' OR "publishedAt" IS NOT NULL) AND
  ("status" <> 'closed' OR "closedAt" IS NOT NULL) AND
  ("closedAt" IS NULL OR "publishedAt" IS NULL OR "closedAt" >= "publishedAt"));
ALTER TABLE "Application" ADD CONSTRAINT "Application_text_chk" CHECK (char_length("coverNote") <= 5000);

-- Messagerie, contrat, avis.
ALTER TABLE "Message" ADD CONSTRAINT "Message_body_chk" CHECK (char_length("body") BETWEEN 1 AND 10000);
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_dates_chk" CHECK ("endsOn" IS NULL OR "endsOn" >= "startsOn");
-- Un contrat actif ou terminé a été accepté par les deux parties.
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signed_chk" CHECK (
  "status" NOT IN ('active','completed') OR ("acceptedByFreelanceAt" IS NOT NULL AND "acceptedByOrgAt" IS NOT NULL));
ALTER TABLE "Review" ADD CONSTRAINT "Review_chk" CHECK ("rating" BETWEEN 1 AND 5 AND char_length("body") BETWEEN 1 AND 4000);

-- Limiteur de débit : table très écrite, laissée à moitié vide pour que la mise à jour du compteur reste locale.
ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_count_chk" CHECK ("count" >= 0);
ALTER TABLE "RateLimitBucket" SET (fillfactor = 50, autovacuum_vacuum_scale_factor = 0.01);

-- ═══ Déclencheurs ══════════════════════════════════════════════════════════════════════════════════════════════════

-- Une facture émise ne se modifie ni ne se supprime. La purge légale à dix ans désactivera ce déclencheur pour son seul rôle.
CREATE FUNCTION proofseen_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION '% est immuable', TG_TABLE_NAME;
END $fn$;
CREATE TRIGGER "Invoice_immutable" BEFORE UPDATE OR DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION proofseen_forbid_mutation();

-- Les deux parties sont obligatoires à la création d'un contrat (elles ne deviennent nulles que par suppression de compte).
CREATE FUNCTION proofseen_contract_parties() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
  ) THEN
    RAISE EXCEPTION 'contrat incohérent avec son devis';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_parties" BEFORE INSERT ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_parties();

-- Un paiement ne s'enregistre que sur un contrat signé.
CREATE FUNCTION proofseen_payment_contract_active() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE s "ContractStatus";
BEGIN
  SELECT "status" INTO s FROM "Contract" WHERE "id" = NEW."contractId";
  IF s IS NULL OR s NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'paiement refusé : le contrat n''est pas signé';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Payment_contract_active" BEFORE INSERT ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION proofseen_payment_contract_active();

-- Un avis : contrat terminé, cible = le freelance du contrat, auteur membre de l'entreprise du contrat.
CREATE FUNCTION proofseen_review_integrity() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD;
BEGIN
  IF NEW."authorUserId" IS NULL THEN
    RAISE EXCEPTION 'un avis a un auteur';
  END IF;
  SELECT "status", "profileId", "organisationId" INTO c FROM "Contract" WHERE "id" = NEW."contractId";
  IF c."status" IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'avis refusé : la mission n''est pas terminée';
  END IF;
  -- Un avis vient d'une mission réellement payée par la plateforme : jamais d'avis libre, jamais d'avis acheté.
  IF NOT EXISTS (SELECT 1 FROM "Payment" WHERE "contractId" = NEW."contractId" AND "status" = 'released'
                 AND "refundedCents" = 0 AND ("disputeOpenedAt" IS NULL OR "disputeWon")) THEN
    RAISE EXCEPTION 'avis refusé : la mission n''a pas été payée';
  END IF;
  IF EXISTS (SELECT 1 FROM "FreelanceProfile" p WHERE p."id" = c."profileId" AND p."userId" = NEW."authorUserId") THEN
    RAISE EXCEPTION 'avis refusé : on ne s''évalue pas soi-même';
  END IF;
  IF c."profileId" IS DISTINCT FROM NEW."targetProfileId" THEN
    RAISE EXCEPTION 'avis refusé : la cible n''est pas le freelance de ce contrat';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."organisationId" = c."organisationId" AND m."userId" = NEW."authorUserId") THEN
    RAISE EXCEPTION 'avis refusé : l''auteur n''est pas membre de l''entreprise du contrat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Review_integrity" BEFORE INSERT ON "Review"
  FOR EACH ROW EXECUTE FUNCTION proofseen_review_integrity();

-- Un fil direct n'a jamais de candidature. L'inverse n'est exigé qu'à la création : une candidature supprimée se détache.
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_direct_chk" CHECK (NOT "direct" OR "applicationId" IS NULL);

-- Les parties et l'origine d'un fil sont fixées à sa création ; un fil de candidature réunit ce freelance et l'entreprise
-- de cette mission. Seul changement admis ensuite : la candidature qui se détache.
CREATE FUNCTION proofseen_conversation_consistency() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."organisationId" IS DISTINCT FROM OLD."organisationId" OR NEW."profileId" IS DISTINCT FROM OLD."profileId"
       OR NEW."direct" IS DISTINCT FROM OLD."direct"
       OR (NEW."applicationId" IS NOT NULL AND NEW."applicationId" IS DISTINCT FROM OLD."applicationId") THEN
      RAISE EXCEPTION 'les parties et l''origine d''une conversation ne changent pas';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT NEW."direct" AND NEW."applicationId" IS NULL THEN
    RAISE EXCEPTION 'une conversation est directe ou rattachée à une candidature';
  END IF;
  -- Un fil direct naît en attente : seul le freelance peut l'accepter, jamais l'entreprise en le créant.
  IF NEW."direct" AND NEW."status" <> 'pending' THEN
    RAISE EXCEPTION 'un fil direct naît en attente de l''accord du freelance';
  END IF;
  -- Personne ne se contacte soi-même au nom de son entreprise : ce serait fabriquer des missions et des avis.
  IF EXISTS (
    SELECT 1 FROM "FreelanceProfile" p JOIN "Membership" m ON m."userId" = p."userId"
    WHERE p."id" = NEW."profileId" AND m."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'conversation refusée : le freelance est membre de cette entreprise';
  END IF;
  IF NEW."applicationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Application" a JOIN "JobPost" j ON j."id" = a."jobPostId"
    WHERE a."id" = NEW."applicationId" AND a."profileId" = NEW."profileId" AND j."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'conversation incohérente avec sa candidature';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Conversation_consistency" BEFORE INSERT OR UPDATE OF "applicationId", "profileId", "organisationId", "direct" ON "Conversation"
  FOR EACH ROW EXECUTE FUNCTION proofseen_conversation_consistency();

-- La date du dernier message suit chaque message, dans la même transaction.
CREATE FUNCTION proofseen_touch_conversation() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "Conversation" SET "lastMessageAt" = GREATEST("lastMessageAt", NEW."createdAt") WHERE "id" = NEW."conversationId";
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_touch_conversation" AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_touch_conversation();

-- ═══ Ce qui est écrit ne se réécrit pas ════════════════════════════════════════════════════════════════════════════
-- Les déclencheurs d'insertion ne suffisent pas : sans ceux-ci, une mise à jour réécrirait un avis, déplacerait un
-- paiement vers un contrat non signé ou changerait le montant d'un contrat signé. Partout, une partie peut devenir
-- nulle (suppression de compte, RGPD) mais jamais être remplacée par une autre.

CREATE FUNCTION proofseen_contract_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF (NEW."organisationId" IS DISTINCT FROM OLD."organisationId" AND NEW."organisationId" IS NOT NULL)
     OR (NEW."profileId" IS DISTINCT FROM OLD."profileId" AND NEW."profileId" IS NOT NULL)
     OR (NEW."quoteId" IS DISTINCT FROM OLD."quoteId" AND NEW."quoteId" IS NOT NULL) THEN
    RAISE EXCEPTION 'les parties d''un contrat ne changent pas';
  END IF;
  IF NEW."dailyRateCents" <> OLD."dailyRateCents" OR NEW."days" <> OLD."days" OR NEW."totalCents" <> OLD."totalCents"
     OR NEW."currency" <> OLD."currency" OR NEW."startsOn" <> OLD."startsOn"
     OR NEW."sellerSnapshot" IS DISTINCT FROM OLD."sellerSnapshot" OR NEW."buyerSnapshot" IS DISTINCT FROM OLD."buyerSnapshot" THEN
    RAISE EXCEPTION 'les conditions d''un contrat ne changent pas : un nouveau contrat les remplace';
  END IF;
  IF (OLD."acceptedByFreelanceAt" IS NOT NULL AND NEW."acceptedByFreelanceAt" IS DISTINCT FROM OLD."acceptedByFreelanceAt")
     OR (OLD."acceptedByOrgAt" IS NOT NULL AND NEW."acceptedByOrgAt" IS DISTINCT FROM OLD."acceptedByOrgAt") THEN
    RAISE EXCEPTION 'une signature ne se retire pas';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending_signatures' AND NEW."status" IN ('active', 'cancelled'))
    OR (OLD."status" = 'active' AND NEW."status" IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  -- Valider la prestation suppose que l'argent est là : sans fonds bloqués, le freelance ne serait jamais payé.
  IF NEW."status" = 'completed' AND OLD."status" <> 'completed'
     AND NOT EXISTS (SELECT 1 FROM "Payment" WHERE "contractId" = NEW."id" AND "status" = 'held') THEN
    RAISE EXCEPTION 'validation refusée : aucun paiement bloqué pour ce contrat';
  END IF;
  -- Un contrat avec de l'argent en jeu ne s'annule pas en silence : il se rembourse d'abord.
  IF NEW."status" = 'cancelled' AND OLD."status" <> 'cancelled'
     AND EXISTS (SELECT 1 FROM "Payment" WHERE "contractId" = NEW."id" AND "status" IN ('pending', 'held', 'releasing', 'refunding')) THEN
    RAISE EXCEPTION 'annulation refusée : un paiement est en cours sur ce contrat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_update" BEFORE UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_update();

-- Un paiement reste attaché à son contrat, dans sa devise, pour son montant ; seuls son statut et ses remboursements évoluent.
CREATE FUNCTION proofseen_payment_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
CREATE TRIGGER "Payment_update" BEFORE UPDATE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION proofseen_payment_update();

-- Un avis publié ne se réécrit pas, ni ne change de cible ; seul son auteur peut disparaître (suppression de compte).
CREATE FUNCTION proofseen_review_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."contractId" <> OLD."contractId" OR NEW."targetProfileId" <> OLD."targetProfileId"
     OR NEW."rating" <> OLD."rating" OR NEW."body" <> OLD."body" OR NEW."createdAt" <> OLD."createdAt"
     OR (NEW."authorUserId" IS DISTINCT FROM OLD."authorUserId" AND NEW."authorUserId" IS NOT NULL) THEN
    RAISE EXCEPTION 'un avis publié ne se modifie pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Review_update" BEFORE UPDATE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION proofseen_review_update();

-- Un message envoyé ne change ni de fil, ni de texte, ni de date ; seul son expéditeur peut disparaître.
CREATE FUNCTION proofseen_message_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."conversationId" <> OLD."conversationId" OR NEW."body" <> OLD."body" OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."containsContact" <> OLD."containsContact"
     OR (NEW."senderUserId" IS DISTINCT FROM OLD."senderUserId" AND NEW."senderUserId" IS NOT NULL) THEN
    RAISE EXCEPTION 'un message envoyé ne se modifie pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_update" BEFORE UPDATE ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_message_update();

-- Une facture ne disparaît pas non plus en vidant la table.
CREATE TRIGGER "Invoice_no_truncate" BEFORE TRUNCATE ON "Invoice"
  FOR EACH STATEMENT EXECUTE FUNCTION proofseen_forbid_mutation();

-- ═══ Consentement du freelance ═════════════════════════════════════════════════════════════════════════════════════
-- Le contact passe par la plateforme, et c'est le freelance qui l'accepte. La règle vit dans la base : un écran ou une
-- route qui l'oublierait ne peut pas la contourner.

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_decision_chk" CHECK (("status" = 'pending') = ("decidedAt" IS NULL));
-- Un fil né d'une candidature n'attend pas d'accord : c'est le freelance qui a écrit le premier.
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_application_accepted_chk" CHECK ("direct" OR "status" <> 'pending');

-- Une décision est définitive : en attente vers accepté ou refusé ; un fil accepté peut seulement être fermé.
CREATE FUNCTION proofseen_conversation_decision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('accepted', 'declined'))
    OR (OLD."status" = 'accepted' AND NEW."status" = 'closed')
  ) THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  IF OLD."decidedAt" IS NOT NULL AND NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt" THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Conversation_decision" BEFORE UPDATE OF "status", "decidedAt" ON "Conversation"
  FOR EACH ROW EXECUTE FUNCTION proofseen_conversation_decision();

-- Qui peut écrire : une partie du fil, jamais un tiers ; personne dans un fil refusé ; l'entreprise, avant l'accord du
-- freelance, seulement le message qui ouvre le fil.
CREATE FUNCTION proofseen_message_sender() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD; freelance BOOLEAN; member BOOLEAN;
BEGIN
  SELECT cv."status", cv."organisationId", p."userId" AS "freelanceUserId" INTO c
    FROM "Conversation" cv JOIN "FreelanceProfile" p ON p."id" = cv."profileId" WHERE cv."id" = NEW."conversationId";
  IF NEW."senderUserId" IS NULL THEN
    RAISE EXCEPTION 'un message a un expéditeur';
  END IF;
  freelance := c."freelanceUserId" = NEW."senderUserId";
  member := EXISTS (SELECT 1 FROM "Membership" m WHERE m."organisationId" = c."organisationId" AND m."userId" = NEW."senderUserId");
  IF NOT freelance AND NOT member THEN
    RAISE EXCEPTION 'message refusé : l''expéditeur n''est pas partie à la conversation';
  END IF;
  IF c."status" IN ('declined', 'closed') THEN
    RAISE EXCEPTION 'message refusé : la conversation est fermée';
  END IF;
  IF NOT freelance AND c."status" = 'pending' AND EXISTS (SELECT 1 FROM "Message" WHERE "conversationId" = NEW."conversationId") THEN
    RAISE EXCEPTION 'message refusé : en attente de l''accord du freelance';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_sender" BEFORE INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_message_sender();

-- ═══ Missions et candidatures ══════════════════════════════════════════════════════════════════════════════════════

-- Une mission clôturée ne rouvre pas (on en publie une nouvelle) ; elle ne change pas d'entreprise ; sa date de
-- publication est celle de la première publication.
CREATE FUNCTION proofseen_job_post_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."organisationId" <> OLD."organisationId" THEN
    RAISE EXCEPTION 'une mission ne change pas d''entreprise';
  END IF;
  IF OLD."status" = 'closed' AND NEW."status" <> 'closed' THEN
    RAISE EXCEPTION 'une mission clôturée ne rouvre pas';
  END IF;
  IF OLD."status" = 'open' AND NEW."status" = 'draft' THEN
    RAISE EXCEPTION 'une mission publiée ne redevient pas un brouillon';
  END IF;
  IF OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'la date de publication d''une mission ne change pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "JobPost_update" BEFORE UPDATE ON "JobPost"
  FOR EACH ROW EXECUTE FUNCTION proofseen_job_post_update();

-- Une candidature vise une mission ouverte, vient d'un profil publié (un profil privé n'a rien à montrer et ne doit pas
-- être exposé par sa candidature) et jamais d'un membre de l'entreprise qui publie.
CREATE FUNCTION proofseen_application_open_mission() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "JobPost" WHERE "id" = NEW."jobPostId" AND "status" = 'open') THEN
    RAISE EXCEPTION 'candidature refusée : la mission n''est pas ouverte';
  END IF;
  IF EXISTS (SELECT 1 FROM "FreelanceProfile" WHERE "id" = NEW."profileId" AND "visibility" = 'private') THEN
    RAISE EXCEPTION 'candidature refusée : le profil n''est pas publié';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "FreelanceProfile" p JOIN "Membership" m ON m."userId" = p."userId" JOIN "JobPost" j ON j."organisationId" = m."organisationId"
    WHERE p."id" = NEW."profileId" AND j."id" = NEW."jobPostId"
  ) THEN
    RAISE EXCEPTION 'candidature refusée : le freelance est membre de cette entreprise';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_open_mission" BEFORE INSERT ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_open_mission();

-- Une candidature ne change ni de mission, ni de candidat, ni de mot ; ses statuts avancent, ne reculent pas.
CREATE FUNCTION proofseen_application_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."jobPostId" <> OLD."jobPostId" OR NEW."profileId" <> OLD."profileId" OR NEW."coverNote" <> OLD."coverNote" THEN
    RAISE EXCEPTION 'une candidature ne se réécrit pas';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'submitted' AND NEW."status" IN ('shortlisted', 'declined', 'hired', 'withdrawn'))
    OR (OLD."status" = 'shortlisted' AND NEW."status" IN ('declined', 'hired', 'withdrawn'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_update" BEFORE UPDATE ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_update();

-- ═══ Devis ═════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Un devis n'existe que dans un fil accepté par le freelance : sans cela, une entreprise irait d'un fil en attente ou
-- refusé jusqu'au contrat et au paiement sans que le freelance ait jamais consenti au contact. Un devis naît brouillon
-- ou envoyé, n'est accepté qu'après avoir été envoyé, et ses montants ne bougent plus une fois envoyé.
CREATE FUNCTION proofseen_quote_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  -- Clore un devis dont le contrat est fini ne demande rien au fil, qui peut avoir été fermé depuis.
  IF TG_OP = 'UPDATE' AND OLD."status" = 'accepted' AND NEW."status" = 'closed' THEN
    IF (NEW."dailyRateCents", NEW."days", NEW."totalCents", NEW."currency", NEW."conversationId")
       IS DISTINCT FROM (OLD."dailyRateCents", OLD."days", OLD."totalCents", OLD."currency", OLD."conversationId") THEN
      RAISE EXCEPTION 'un devis clos ne change pas';
    END IF;
    -- Clos quand son contrat est fini, ou quand aucun contrat n'a pu en naître (contrat avec soi-même refusé).
    IF EXISTS (SELECT 1 FROM "Contract" WHERE "quoteId" = NEW."id" AND "status" IN ('pending_signatures', 'active')) THEN
      RAISE EXCEPTION 'un devis ne se clôt pas pendant son contrat';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Conversation" WHERE "id" = NEW."conversationId" AND "status" = 'accepted') THEN
    RAISE EXCEPTION 'devis refusé : la conversation n''est pas acceptée par le freelance';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" NOT IN ('draft', 'sent') THEN
      RAISE EXCEPTION 'un devis naît brouillon ou envoyé';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."conversationId" <> OLD."conversationId" THEN
    RAISE EXCEPTION 'un devis ne change pas de conversation';
  END IF;
  IF OLD."status" <> 'draft' AND (NEW."dailyRateCents" <> OLD."dailyRateCents" OR NEW."days" <> OLD."days"
     OR NEW."totalCents" <> OLD."totalCents" OR NEW."currency" <> OLD."currency") THEN
    RAISE EXCEPTION 'un devis envoyé ne change pas de montant : un nouveau devis le remplace';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'draft' AND NEW."status" = 'sent')
    OR (OLD."status" = 'sent' AND NEW."status" IN ('accepted', 'declined', 'superseded'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Quote_guard" BEFORE INSERT OR UPDATE ON "Quote"
  FOR EACH ROW EXECUTE FUNCTION proofseen_quote_guard();

-- Un contrat terminé ou annulé clôt son devis : une mission suivante ou refaite reste sur la plateforme, dans le même
-- fil, au lieu de partir ailleurs faute de pouvoir accepter un second devis.
CREATE FUNCTION proofseen_contract_closes_quote() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."quoteId" IS NOT NULL AND NEW."status" IN ('completed', 'cancelled') AND OLD."status" IS DISTINCT FROM NEW."status" THEN
    UPDATE "Quote" SET "status" = 'closed' WHERE "id" = NEW."quoteId" AND "status" = 'accepted';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_closes_quote" AFTER UPDATE OF "status" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_closes_quote();

-- ═══ Notifications ═════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "User" ADD CONSTRAINT "User_lang_chk" CHECK ("lang" IN ('fr','en'));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts_chk" CHECK ("attempts" BETWEEN 0 AND 20);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_error_chk" CHECK ("lastError" IS NULL OR char_length("lastError") <= 200);

-- ═══ Facturation ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Taux de TVA d'un freelance : franchise (0), taux réduits, taux normal. Rien d'autre n'existe en France métropolitaine.
ALTER TABLE "BillingIdentity" ADD CONSTRAINT "BillingIdentity_vat_chk" CHECK ("vatRateBp" IN (0, 210, 550, 1000, 2000));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_text_chk" CHECK (char_length("label") BETWEEN 1 AND 300 AND char_length("number") BETWEEN 3 AND 80);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuer_chk" CHECK ("issuer" = 'proofseen' OR "issuer" ~ '^[0-9a-f-]{36}$');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_due_chk" CHECK ("dueOn" >= ("issuedAt" AT TIME ZONE 'UTC')::date);
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_issuer_chk" CHECK ("issuer" = 'proofseen' OR "issuer" ~ '^[0-9a-f-]{36}$');
-- Un paiement versé porte son virement et sa date, dès l'insertion.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_released_chk" CHECK ("status" <> 'released' OR ("transferId" IS NOT NULL AND "releasedAt" IS NOT NULL));
ALTER TABLE "BillingIdentity" ADD CONSTRAINT "BillingIdentity_stripe_chk" CHECK ("stripeAccountId" IS NULL OR "stripeAccountId" ~ '^acct_[A-Za-z0-9]{6,64}$');

-- Le freelance d'un contrat en cours ne devient pas membre de l'entreprise cliente : il pourrait valider sa propre
-- prestation et déclencher son propre versement.
CREATE FUNCTION proofseen_membership_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Contract" c JOIN "FreelanceProfile" p ON p."id" = c."profileId"
    WHERE c."organisationId" = NEW."organisationId" AND p."userId" = NEW."userId" AND c."status" IN ('pending_signatures', 'active')
  ) THEN
    RAISE EXCEPTION 'adhésion refusée : cette personne est le freelance d''un contrat en cours avec l''entreprise';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Membership_guard" BEFORE INSERT ON "Membership"
  FOR EACH ROW EXECUTE FUNCTION proofseen_membership_guard();

-- ═══ Visibilité mesurée ════════════════════════════════════════════════════════════════════════════════════════════
-- Chaque étape compte des tirages : jamais plus que les tirages de la vague pour ce moteur.
ALTER TABLE "VisibilityResult" ADD CONSTRAINT "VisibilityResult_counts_chk" CHECK (
  "draws" >= 0 AND "retrieved" BETWEEN 0 AND "draws" AND "named" BETWEEN 0 AND "draws" AND "top5" BETWEEN 0 AND "draws" AND "cited" BETWEEN 0 AND "draws");
ALTER TABLE "VisibilityResult" ADD CONSTRAINT "VisibilityResult_engine_chk" CHECK ("engine" ~ '^[a-z0-9-]{2,40}$');
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_cost_currency_chk" CHECK (("costCents" IS NULL) = ("currency" IS NULL));
