-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('freelance', 'client');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'invitation_accepted';

-- AlterEnum
ALTER TYPE "AppNotificationKind" ADD VALUE 'invitation_accepted';

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "kind" "InvitationKind" NOT NULL,
    "senderUserId" UUID NOT NULL,
    "organisationId" UUID,
    "email" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "message" TEXT,
    "lang" CHAR(2) NOT NULL DEFAULT 'fr',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),
    "acceptedByUserId" UUID,
    "clientOrganisationId" UUID,
    "linkedAt" TIMESTAMPTZ(3),
    "remindedAt" TIMESTAMPTZ(3),
    "emailSendAfter" TIMESTAMPTZ(3),
    "emailSentAt" TIMESTAMPTZ(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentPoolEntry" (
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolEntry_pkey" PRIMARY KEY ("organisationId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_senderUserId_createdAt_idx" ON "Invitation"("senderUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invitation_organisation_idx" ON "Invitation"("organisationId", "createdAt" DESC) WHERE ("organisationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "Invitation_mailbox_createdAt_idx" ON "Invitation"("mailbox", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_acceptedByUserId_idx" ON "Invitation"("acceptedByUserId") WHERE ("acceptedByUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "Invitation_clientOrganisationId_idx" ON "Invitation"("clientOrganisationId") WHERE ("clientOrganisationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "Invitation_mail_idx" ON "Invitation"("emailSendAfter", "id") WHERE ("emailSentAt" IS NULL AND "status" = 'pending');

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "TalentPoolEntry_userId_idx" ON "TalentPoolEntry"("userId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_clientOrganisationId_fkey" FOREIGN KEY ("clientOrganisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolEntry" ADD CONSTRAINT "TalentPoolEntry_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolEntry" ADD CONSTRAINT "TalentPoolEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Règles tenues par la base (C23) ────────────────────────────────────────────────────────────────────────────────

-- Une entreprise invite un freelance (elle est nommée) ; un freelance invite une entreprise cliente (aucune entreprise
-- expéditrice). Seule une invitation d'entreprise cliente se rattache, ensuite, à l'entreprise de la personne invitée.
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_kind_shape"
  CHECK ((("kind" = 'freelance') = ("organisationId" IS NOT NULL)) AND ("kind" = 'client' OR "clientOrganisationId" IS NULL));
-- Adresse en minuscules et de taille bornée ; mot personnel court.
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_email_chk"
  CHECK ("email" = lower("email") AND char_length("email") <= 254 AND "email" LIKE '%_@_%' AND char_length("mailbox") <= 254);
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_message_chk" CHECK ("message" IS NULL OR char_length("message") BETWEEN 1 AND 500);
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_lang_chk" CHECK ("lang" IN ('fr', 'en'));
-- Décidée (acceptée, refusée, révoquée) = datée ; un rattachement suppose une invitation acceptée.
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_decision_chk" CHECK (("status" = 'pending') = ("decidedAt" IS NULL));
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_link_chk" CHECK ("clientOrganisationId" IS NULL OR ("linkedAt" IS NOT NULL AND "status" = 'accepted'));
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_attempts_range" CHECK ("emailAttempts" BETWEEN 0 AND 20);
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_expiry_chk" CHECK ("expiresAt" > "createdAt");

-- Ni l'adresse, ni le type, ni le jeton, ni l'entreprise qui invite ne changent après l'envoi, et une décision ne se
-- défait pas : le lien reste à usage unique, même pour une écriture directe en base. Seule exception : l'expéditeur, qui
-- ne voit jamais un refus, peut révoquer une invitation refusée sans le savoir.
CREATE FUNCTION "proofseen_invitation_rules"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."email" IS DISTINCT FROM OLD."email" OR NEW."kind" IS DISTINCT FROM OLD."kind" OR NEW."tokenHash" IS DISTINCT FROM OLD."tokenHash"
     OR NEW."organisationId" IS DISTINCT FROM OLD."organisationId" OR NEW."senderUserId" IS DISTINCT FROM OLD."senderUserId" THEN
    RAISE EXCEPTION 'invitation : adresse, type, jeton, expéditeur et entreprise ne changent pas';
  END IF;
  IF OLD."status" <> 'pending' AND NEW."status" IS DISTINCT FROM OLD."status" AND NOT (OLD."status" = 'declined' AND NEW."status" = 'revoked') THEN
    RAISE EXCEPTION 'invitation : une décision ne se défait pas';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Invitation_rules" BEFORE UPDATE ON "Invitation"
  FOR EACH ROW EXECUTE FUNCTION "proofseen_invitation_rules"();
