-- CreateEnum
CREATE TYPE "RegistryStatus" AS ENUM ('active', 'ceased', 'not_found');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "registryCheckedAt" TIMESTAMPTZ(3),
ADD COLUMN     "registryStatus" "RegistryStatus";

-- AlterTable
ALTER TABLE "BillingIdentity" ADD COLUMN     "registryCheckedAt" TIMESTAMPTZ(3),
ADD COLUMN     "registryStatus" "RegistryStatus";

