-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('photo', 'cv', 'portfolio_image');

-- CreateEnum
CREATE TYPE "LanguageLevel" AS ENUM ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native');

-- AlterTable
ALTER TABLE "FreelanceProfile" ADD COLUMN     "photoFileId" UUID;

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "StoredFileKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileExperience" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "companyHidden" BOOLEAN NOT NULL DEFAULT false,
    "startMonth" DATE NOT NULL,
    "endMonth" DATE,
    "description" TEXT,
    "skills" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEducation" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "school" TEXT NOT NULL,
    "degree" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCertification" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "year" INTEGER,
    "credentialUrl" TEXT,
    "skills" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileLanguage" (
    "profileId" UUID NOT NULL,
    "code" CHAR(2) NOT NULL,
    "level" "LanguageLevel" NOT NULL,

    CONSTRAINT "ProfileLanguage_pkey" PRIMARY KEY ("profileId","code")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "imageFileId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileImportDraft" (
    "profileId" UUID NOT NULL,
    "proposal" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileImportDraft_pkey" PRIMARY KEY ("profileId")
);

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_kind_createdAt_idx" ON "StoredFile"("ownerId", "kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProfileExperience_profileId_startMonth_idx" ON "ProfileExperience"("profileId", "startMonth" DESC);

-- CreateIndex
CREATE INDEX "ProfileEducation_profileId_idx" ON "ProfileEducation"("profileId");

-- CreateIndex
CREATE INDEX "ProfileCertification_profileId_idx" ON "ProfileCertification"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_imageFileId_key" ON "PortfolioItem"("imageFileId");

-- CreateIndex
CREATE INDEX "PortfolioItem_profileId_idx" ON "PortfolioItem"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceProfile_photoFileId_key" ON "FreelanceProfile"("photoFileId");

-- AddForeignKey
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEducation" ADD CONSTRAINT "ProfileEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCertification" ADD CONSTRAINT "ProfileCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileLanguage" ADD CONSTRAINT "ProfileLanguage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileImportDraft" ADD CONSTRAINT "ProfileImportDraft_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ═══ Fichiers déposés ══════════════════════════════════════════════════════════════════════════════════════════════
-- Le type enregistré est celui reconnu dans le contenu, dans une liste fermée ; un CV est un PDF, une image n'en est
-- jamais un. Taille bornée (5 Mo, le plus grand des usages), empreinte en hexadécimal, dimensions positives.
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_content_type" CHECK (
  "contentType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND (("kind" = 'cv') = ("contentType" = 'application/pdf'))
);
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_size" CHECK ("size" BETWEEN 1 AND 5242880);
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_dimensions" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));

-- ═══ Profil enrichi ════════════════════════════════════════════════════════════════════════════════════════════════
-- Mêmes bornes que les schémas du dépôt (`profile-section-schemas.ts`). Une adresse publiée est toujours en https ; un
-- mois est rangé à son premier jour ; une fin ne précède jamais un début. Les plafonds par section sont tenus par le
-- dépôt, sous verrou du profil.
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_lengths" CHECK (
  char_length(btrim("title")) BETWEEN 2 AND 120
  AND ("company" IS NULL OR char_length(btrim("company")) BETWEEN 1 AND 120)
  AND ("description" IS NULL OR char_length("description") BETWEEN 1 AND 2000)
  AND cardinality("skills") <= 15
);
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_months" CHECK (
  extract(day FROM "startMonth") = 1
  AND ("endMonth" IS NULL OR (extract(day FROM "endMonth") = 1 AND "endMonth" >= "startMonth"))
);
ALTER TABLE "ProfileEducation" ADD CONSTRAINT "ProfileEducation_lengths" CHECK (
  char_length(btrim("school")) BETWEEN 2 AND 160 AND ("degree" IS NULL OR char_length(btrim("degree")) BETWEEN 1 AND 160)
);
ALTER TABLE "ProfileEducation" ADD CONSTRAINT "ProfileEducation_years" CHECK (
  ("startYear" IS NULL OR "startYear" BETWEEN 1950 AND 2100)
  AND ("endYear" IS NULL OR "endYear" BETWEEN 1950 AND 2100)
  AND ("startYear" IS NULL OR "endYear" IS NULL OR "endYear" >= "startYear")
);
ALTER TABLE "ProfileCertification" ADD CONSTRAINT "ProfileCertification_fields" CHECK (
  char_length(btrim("name")) BETWEEN 2 AND 160
  AND ("issuer" IS NULL OR char_length(btrim("issuer")) BETWEEN 1 AND 160)
  AND ("year" IS NULL OR "year" BETWEEN 1950 AND 2100)
  AND ("credentialUrl" IS NULL OR ("credentialUrl" LIKE 'https://%' AND char_length("credentialUrl") <= 500))
  AND cardinality("skills") <= 15
);
ALTER TABLE "ProfileLanguage" ADD CONSTRAINT "ProfileLanguage_code" CHECK ("code" ~ '^[a-z]{2}$');
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_fields" CHECK (
  char_length(btrim("title")) BETWEEN 2 AND 120
  AND "url" LIKE 'https://%' AND char_length("url") <= 500
  AND ("description" IS NULL OR char_length("description") BETWEEN 1 AND 1000)
);
