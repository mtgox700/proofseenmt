-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'application_read';
ALTER TYPE "NotificationKind" ADD VALUE 'mission_invitation';
ALTER TYPE "NotificationKind" ADD VALUE 'company_mission';

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "publicCity" TEXT,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicName" TEXT,
ADD COLUMN     "publicSince" TIMESTAMPTZ(3),
ADD COLUMN     "publicSlug" TEXT,
ADD COLUMN     "publicWebsite" TEXT;

-- AlterTable
ALTER TABLE "JobPost" ADD COLUMN     "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skillsText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "readAt" TIMESTAMPTZ(3),
ADD COLUMN     "readByUserId" UUID;

-- CreateTable
CREATE TABLE "SavedMission" (
    "userId" UUID NOT NULL,
    "jobPostId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedMission_pkey" PRIMARY KEY ("userId","jobPostId")
);

-- CreateTable
CREATE TABLE "MissionInvitation" (
    "id" UUID NOT NULL,
    "jobPostId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "invitedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MissionInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFollow" (
    "userId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyFollow_pkey" PRIMARY KEY ("userId","organisationId")
);

-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "createdByUserId" UUID,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedMission_userId_createdAt_idx" ON "SavedMission"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SavedMission_jobPostId_idx" ON "SavedMission"("jobPostId");

-- CreateIndex
CREATE INDEX "MissionInvitation_profileId_createdAt_idx" ON "MissionInvitation"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MissionInvitation_jobPostId_createdAt_idx" ON "MissionInvitation"("jobPostId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MissionInvitation_invitedByUserId_idx" ON "MissionInvitation"("invitedByUserId") WHERE ("invitedByUserId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "MissionInvitation_jobPostId_profileId_key" ON "MissionInvitation"("jobPostId", "profileId");

-- CreateIndex
CREATE INDEX "CompanyFollow_organisationId_idx" ON "CompanyFollow"("organisationId");

-- CreateIndex
CREATE INDEX "MissionTemplate_organisationId_createdAt_idx" ON "MissionTemplate"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MissionTemplate_createdByUserId_idx" ON "MissionTemplate"("createdByUserId") WHERE ("createdByUserId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_publicSlug_key" ON "Organisation"("publicSlug");

-- CreateIndex
CREATE INDEX "Application_readByUserId_idx" ON "Application"("readByUserId") WHERE ("readByUserId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_readByUserId_fkey" FOREIGN KEY ("readByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMission" ADD CONSTRAINT "SavedMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMission" ADD CONSTRAINT "SavedMission_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFollow" ADD CONSTRAINT "CompanyFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFollow" ADD CONSTRAINT "CompanyFollow_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTemplate" ADD CONSTRAINT "MissionTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTemplate" ADD CONSTRAINT "MissionTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;





-- ═══ Espace missions vivant (C16) ════════════════════════════════════════════════════════════════════════════════
-- Les listes de Prisma sont des colonnes nullables : une mission a toujours une liste de questions, peut-être vide.
UPDATE "JobPost" SET "questions" = ARRAY[]::TEXT[] WHERE "questions" IS NULL;
UPDATE "Application" SET "answers" = ARRAY[]::TEXT[] WHERE "answers" IS NULL;
ALTER TABLE "JobPost" ALTER COLUMN "questions" SET NOT NULL;
ALTER TABLE "Application" ALTER COLUMN "answers" SET NOT NULL;

-- Trois questions au plus par mission, trois réponses au plus par candidature, d'une longueur bornée.
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_questions_chk"
  CHECK (cardinality("questions") <= 3 AND char_length(array_to_string("questions", '')) <= 900);
ALTER TABLE "Application" ADD CONSTRAINT "Application_answers_chk"
  CHECK (cardinality("answers") <= 3 AND char_length(array_to_string("answers", '')) <= 6000);
-- Une candidature n'a de lecteur que si elle a une date de lecture.
ALTER TABLE "Application" ADD CONSTRAINT "Application_read_chk" CHECK ("readByUserId" IS NULL OR "readAt" IS NOT NULL);

-- Les compétences des missions existantes, recopiées pour la recherche plein texte.
UPDATE "JobPost" j SET "skillsText" = COALESCE(
  (SELECT string_agg(s."label", ' ' ORDER BY s."label") FROM "JobPostSkill" js JOIN "Skill" s ON s."id" = js."skillId" WHERE js."jobPostId" = j."id"),
  '');

-- Recherche plein texte des missions ouvertes, en français et en anglais : intitulé, description, compétences. Un
-- filtre seulement : la liste garde l'ordre choisi par le visiteur, jamais un score de pertinence (aucun ts_rank).
-- L'expression est recopiée telle quelle par la requête (`packages/db/src/mission-search.ts`), sinon l'index ne sert pas.
CREATE INDEX "JobPost_open_fulltext_idx" ON "JobPost" USING GIN (
  (to_tsvector('french'::regconfig, "title" || ' ' || "description" || ' ' || "skillsText")
   || to_tsvector('english'::regconfig, "title" || ' ' || "description" || ' ' || "skillsText"))
) WHERE "status" = 'open';

-- Une candidature est lue une fois : la première date reste. Ses réponses ne se réécrivent pas. Le lecteur peut
-- disparaître (compte effacé : la clé étrangère le remet à nul), jamais être remplacé par un autre.
CREATE FUNCTION proofseen_application_read_once() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."answers" IS DISTINCT FROM OLD."answers" THEN
    RAISE EXCEPTION 'les réponses d''une candidature ne se réécrivent pas';
  END IF;
  IF OLD."readAt" IS NOT NULL AND NEW."readAt" IS DISTINCT FROM OLD."readAt" THEN
    RAISE EXCEPTION 'la date de lecture d''une candidature ne change pas';
  END IF;
  IF OLD."readByUserId" IS NOT NULL AND NEW."readByUserId" IS NOT NULL AND NEW."readByUserId" <> OLD."readByUserId" THEN
    RAISE EXCEPTION 'le lecteur d''une candidature ne change pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_read_once" BEFORE UPDATE ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_read_once();

-- Page publique d'entreprise : seulement complète, et des formes normalisées.
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_public_chk"
  CHECK ("publicSince" IS NULL OR ("publicSlug" IS NOT NULL AND "publicName" IS NOT NULL));
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_public_format_chk"
  CHECK (("publicSlug" IS NULL OR ("publicSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("publicSlug") <= 80))
     AND ("publicName" IS NULL OR char_length("publicName") BETWEEN 2 AND 200)
     AND ("publicDescription" IS NULL OR char_length("publicDescription") <= 1000)
     AND ("publicCity" IS NULL OR char_length("publicCity") <= 120)
     AND ("publicWebsite" IS NULL OR ("publicWebsite" LIKE 'https://%' AND char_length("publicWebsite") <= 200)));

ALTER TABLE "MissionTemplate" ADD CONSTRAINT "MissionTemplate_name_chk" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_dismissed_chk" CHECK ("dismissedAt" IS NULL OR "dismissedAt" >= "createdAt");
