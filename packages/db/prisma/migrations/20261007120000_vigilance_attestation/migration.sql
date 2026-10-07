-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'vigilance_expiring';

-- CreateTable
CREATE TABLE "VigilanceAttestation" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "issuedOn" DATE NOT NULL,
    "securityCode" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "remindedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VigilanceAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VigilanceAttestation_profileId_key" ON "VigilanceAttestation"("profileId");

-- CreateIndex
CREATE INDEX "VigilanceAttestation_issuedOn_idx" ON "VigilanceAttestation"("issuedOn");

-- AddForeignKey
ALTER TABLE "VigilanceAttestation" ADD CONSTRAINT "VigilanceAttestation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Code de sécurité tel qu'imprimé sur l'attestation : lettres et chiffres, normalisé en majuscules par l'application.
ALTER TABLE "VigilanceAttestation" ADD CONSTRAINT "VigilanceAttestation_code_chk" CHECK ("securityCode" ~ '^[A-Z0-9]{6,40}$');
