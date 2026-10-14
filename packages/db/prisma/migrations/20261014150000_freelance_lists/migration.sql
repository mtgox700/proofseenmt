-- CreateEnum
CREATE TYPE "ListReaction" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "FreelanceList" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreelanceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelanceListItem" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "addedByUserId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreelanceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelanceListReaction" (
    "itemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reaction" "ListReaction" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreelanceListReaction_pkey" PRIMARY KEY ("itemId","userId")
);

-- CreateIndex
CREATE INDEX "FreelanceList_organisationId_createdAt_idx" ON "FreelanceList"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FreelanceList_createdByUserId_idx" ON "FreelanceList"("createdByUserId") WHERE ("createdByUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "FreelanceListItem_profileId_idx" ON "FreelanceListItem"("profileId");

-- CreateIndex
CREATE INDEX "FreelanceListItem_addedByUserId_idx" ON "FreelanceListItem"("addedByUserId") WHERE ("addedByUserId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "FreelanceListItem_listId_profileId_key" ON "FreelanceListItem"("listId", "profileId");

-- CreateIndex
CREATE INDEX "FreelanceListReaction_userId_idx" ON "FreelanceListReaction"("userId");

-- AddForeignKey
ALTER TABLE "FreelanceList" ADD CONSTRAINT "FreelanceList_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceList" ADD CONSTRAINT "FreelanceList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceListItem" ADD CONSTRAINT "FreelanceListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "FreelanceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceListItem" ADD CONSTRAINT "FreelanceListItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceListItem" ADD CONSTRAINT "FreelanceListItem_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceListReaction" ADD CONSTRAINT "FreelanceListReaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FreelanceListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelanceListReaction" ADD CONSTRAINT "FreelanceListReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ═══ Listes de freelances d'une entreprise ═════════════════════════════════════════════════════════════════════════
-- Un nom court et lisible ; une note privée bornée. Les plafonds par entreprise et par liste sont tenus par le dépôt,
-- sous verrou de l'entreprise ou de la liste.
ALTER TABLE "FreelanceList" ADD CONSTRAINT "FreelanceList_name_length" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80);
ALTER TABLE "FreelanceListItem" ADD CONSTRAINT "FreelanceListItem_note_length" CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 2000);
