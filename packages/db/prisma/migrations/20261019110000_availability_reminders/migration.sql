-- Rappel de reconfirmer la disponibilité (C23) : au plus un par fenêtre de 14 jours et par profil, tenu par cette date.
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'availability_reminder';

-- AlterEnum
ALTER TYPE "AppNotificationKind" ADD VALUE 'availability_reminder';

-- AlterTable
ALTER TABLE "FreelanceProfile" ADD COLUMN     "availabilityRemindedAt" TIMESTAMPTZ(3);
