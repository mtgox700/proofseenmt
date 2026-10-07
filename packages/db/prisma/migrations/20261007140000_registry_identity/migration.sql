-- AlterEnum
ALTER TYPE "RegistryStatus" ADD VALUE 'mismatch';

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "registryAttemptedAt" TIMESTAMPTZ(3),
ADD COLUMN     "registryName" TEXT;

-- AlterTable
ALTER TABLE "BillingIdentity" ADD COLUMN     "registryAttemptedAt" TIMESTAMPTZ(3),
ADD COLUMN     "registryName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_siret_key" ON "Organisation"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "BillingIdentity_siret_key" ON "BillingIdentity"("siret");

