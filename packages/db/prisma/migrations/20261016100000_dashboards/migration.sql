-- CreateEnum
CREATE TYPE "StatKeywordKind" AS ENUM ('skill', 'city');

-- CreateTable
CREATE TABLE "ProfileStatDay" (
    "profileId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "searchAppearances" INTEGER NOT NULL DEFAULT 0,
    "directoryAppearances" INTEGER NOT NULL DEFAULT 0,
    "listAdds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileStatDay_pkey" PRIMARY KEY ("profileId","day")
);

-- CreateTable
CREATE TABLE "ProfileStatKeyword" (
    "profileId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" "StatKeywordKind" NOT NULL,
    "keyword" TEXT NOT NULL,
    "appearances" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileStatKeyword_pkey" PRIMARY KEY ("profileId","day","kind","keyword")
);

-- CreateTable
CREATE TABLE "ProfileStatSeen" (
    "day" DATE NOT NULL,
    "profileId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "viewerHash" TEXT NOT NULL,

    CONSTRAINT "ProfileStatSeen_pkey" PRIMARY KEY ("day","profileId","scope","viewerHash")
);

-- CreateTable
CREATE TABLE "OrganisationStatDay" (
    "organisationId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrganisationStatDay_pkey" PRIMARY KEY ("organisationId","day")
);

-- CreateIndex
CREATE INDEX "ProfileStatDay_day_idx" ON "ProfileStatDay"("day");

-- CreateIndex
CREATE INDEX "ProfileStatKeyword_day_idx" ON "ProfileStatKeyword"("day");

-- CreateIndex
CREATE INDEX "ProfileStatSeen_profileId_idx" ON "ProfileStatSeen"("profileId");

-- CreateIndex
CREATE INDEX "OrganisationStatDay_day_idx" ON "OrganisationStatDay"("day");

-- AddForeignKey
ALTER TABLE "ProfileStatDay" ADD CONSTRAINT "ProfileStatDay_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileStatKeyword" ADD CONSTRAINT "ProfileStatKeyword_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileStatSeen" ADD CONSTRAINT "ProfileStatSeen_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationStatDay" ADD CONSTRAINT "OrganisationStatDay_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══ Tableaux de bord (C17) ══════════════════════════════════════════════════════════════════════════════════════
-- Des compteurs, jamais négatifs.
ALTER TABLE "ProfileStatDay" ADD CONSTRAINT "ProfileStatDay_counts_chk"
  CHECK ("views" >= 0 AND "searchAppearances" >= 0 AND "directoryAppearances" >= 0 AND "listAdds" >= 0);
ALTER TABLE "OrganisationStatDay" ADD CONSTRAINT "OrganisationStatDay_counts_chk" CHECK ("searches" >= 0);

-- Un filtre de recherche est gardé sous sa forme normalisée (`skillKey`) : jamais une phrase libre.
ALTER TABLE "ProfileStatKeyword" ADD CONSTRAINT "ProfileStatKeyword_keyword_chk"
  CHECK ("keyword" ~ '^[a-z0-9+#-]{1,60}$' AND "appearances" >= 0);

-- L'empreinte est un HMAC tronqué (22 caractères base64url) : une adresse IP, avec ses points ou ses deux-points, ne
-- peut pas y entrer, même par erreur de code.
ALTER TABLE "ProfileStatSeen" ADD CONSTRAINT "ProfileStatSeen_hash_chk" CHECK ("viewerHash" ~ '^[A-Za-z0-9_-]{22}$');
ALTER TABLE "ProfileStatSeen" ADD CONSTRAINT "ProfileStatSeen_scope_chk"
  CHECK ("scope" IN ('view', 'search', 'directory') OR "scope" ~ '^keyword:(skill|city):[a-z0-9+#-]{1,60}$');
