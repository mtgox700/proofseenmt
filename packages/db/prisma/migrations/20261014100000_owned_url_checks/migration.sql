-- AlterTable
ALTER TABLE "OwnedUrl" ADD COLUMN     "checkedAt" TIMESTAMPTZ(3),
ADD COLUMN     "failedAt" TIMESTAMPTZ(3);



-- Une relecture en échec ne concerne qu'une adresse prouvée : une adresse en attente n'a rien à perdre. Et une adresse
-- déclarée reste lisible et recopiable : sa longueur est bornée, comme partout où un tiers écrit.
ALTER TABLE "OwnedUrl" ADD CONSTRAINT "OwnedUrl_failed_chk" CHECK ("failedAt" IS NULL OR "verifiedAt" IS NOT NULL);
ALTER TABLE "OwnedUrl" ADD CONSTRAINT "OwnedUrl_length_chk" CHECK (char_length("url") <= 300 AND char_length("urlKey") <= 300);
