-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('public', 'members');

-- CreateEnum
CREATE TYPE "PostReactionKind" AS ENUM ('like', 'insightful', 'celebrate', 'support');

-- AlterEnum
ALTER TYPE "StoredFileKind" ADD VALUE 'post_image';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppNotificationKind" ADD VALUE 'post_comment';
ALTER TYPE "AppNotificationKind" ADD VALUE 'post_reaction';
ALTER TYPE "AppNotificationKind" ADD VALUE 'post_share';
ALTER TYPE "AppNotificationKind" ADD VALUE 'new_follower';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperatorActionKind" ADD VALUE 'post_hidden';
ALTER TYPE "OperatorActionKind" ADD VALUE 'post_restored';
ALTER TYPE "OperatorActionKind" ADD VALUE 'comment_hidden';
ALTER TYPE "OperatorActionKind" ADD VALUE 'comment_restored';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperatorTargetType" ADD VALUE 'post';
ALTER TYPE "OperatorTargetType" ADD VALUE 'comment';

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "authorUserId" UUID,
    "profileId" UUID,
    "organisationId" UUID,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "imageFileId" UUID,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'public',
    "sharedPostId" UUID,
    "moderatedAt" TIMESTAMPTZ(3),
    "moderationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "PostReactionKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "parentId" UUID,
    "authorUserId" UUID,
    "profileId" UUID,
    "organisationId" UUID,
    "body" TEXT NOT NULL,
    "moderatedAt" TIMESTAMPTZ(3),
    "moderationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileFollow" (
    "userId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileFollow_pkey" PRIMARY KEY ("userId","profileId")
);

-- CreateTable
CREATE TABLE "PostStatDay" (
    "postId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostStatDay_pkey" PRIMARY KEY ("postId","day")
);

-- CreateTable
CREATE TABLE "PostStatSeen" (
    "day" DATE NOT NULL,
    "postId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "viewerHash" TEXT NOT NULL,

    CONSTRAINT "PostStatSeen_pkey" PRIMARY KEY ("day","postId","scope","viewerHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_imageFileId_key" ON "Post"("imageFileId");

-- CreateIndex
CREATE INDEX "Post_live_recent_idx" ON "Post"("createdAt" DESC, "id" DESC) WHERE ("deletedAt" IS NULL AND "moderatedAt" IS NULL);

-- CreateIndex
CREATE INDEX "Post_profileId_createdAt_idx" ON "Post"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_organisationId_createdAt_idx" ON "Post"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_authorUserId_createdAt_idx" ON "Post"("authorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_sharedPostId_idx" ON "Post"("sharedPostId") WHERE ("sharedPostId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "PostReaction_userId_idx" ON "PostReaction"("userId");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_id_idx" ON "PostComment"("postId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PostComment_authorUserId_createdAt_idx" ON "PostComment"("authorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId") WHERE ("parentId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "PostComment_profileId_idx" ON "PostComment"("profileId") WHERE ("profileId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "PostComment_organisationId_idx" ON "PostComment"("organisationId") WHERE ("organisationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "ProfileFollow_profileId_createdAt_idx" ON "ProfileFollow"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PostStatDay_day_idx" ON "PostStatDay"("day");

-- CreateIndex
CREATE INDEX "PostStatSeen_postId_idx" ON "PostStatSeen"("postId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sharedPostId_fkey" FOREIGN KEY ("sharedPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileFollow" ADD CONSTRAINT "ProfileFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileFollow" ADD CONSTRAINT "ProfileFollow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostStatDay" ADD CONSTRAINT "PostStatDay_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostStatSeen" ADD CONSTRAINT "PostStatSeen_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Règles de la communauté (C22), que Prisma ne sait pas exprimer ────────────────────────────────────────────────

-- Une publication parle au nom d'un seul : un profil freelance ou une entreprise.
ALTER TABLE "Post" ADD CONSTRAINT "Post_speaker_chk" CHECK (num_nonnulls("profileId", "organisationId") = 1);
-- Le texte a une taille bornée ; il n'est vide que pour un partage sans commentaire ou une publication supprimée.
ALTER TABLE "Post" ADD CONSTRAINT "Post_body_chk"
  CHECK (char_length("body") <= 3000 AND ("deletedAt" IS NOT NULL OR "sharedPostId" IS NOT NULL OR char_length(btrim("body")) >= 1));
-- Un lien est une adresse https de taille raisonnable ; le filtre des adresses de contact est appliqué par le dépôt.
ALTER TABLE "Post" ADD CONSTRAINT "Post_link_chk" CHECK ("linkUrl" IS NULL OR ("linkUrl" ~ '^https://' AND char_length("linkUrl") <= 500));
-- Masquer, c'est toujours avec un motif.
ALTER TABLE "Post" ADD CONSTRAINT "Post_moderation_chk"
  CHECK (("moderatedAt" IS NULL) = ("moderationReason" IS NULL) AND ("moderationReason" IS NULL OR char_length(btrim("moderationReason")) BETWEEN 3 AND 1000));

ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_speaker_chk" CHECK (num_nonnulls("profileId", "organisationId") <= 1);
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_body_chk"
  CHECK (char_length("body") <= 1500 AND ("deletedAt" IS NOT NULL OR char_length(btrim("body")) >= 1));
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_moderation_chk"
  CHECK (("moderatedAt" IS NULL) = ("moderationReason" IS NULL) AND ("moderationReason" IS NULL OR char_length(btrim("moderationReason")) BETWEEN 3 AND 1000));

-- L'empreinte est un HMAC tronqué (22 caractères base64url) : une adresse IP ne peut pas y entrer, même par erreur.
ALTER TABLE "PostStatSeen" ADD CONSTRAINT "PostStatSeen_hash_chk" CHECK ("viewerHash" ~ '^[A-Za-z0-9_-]{22}$');
ALTER TABLE "PostStatSeen" ADD CONSTRAINT "PostStatSeen_scope_chk" CHECK ("scope" IN ('impression', 'view'));
ALTER TABLE "PostStatDay" ADD CONSTRAINT "PostStatDay_counts_chk" CHECK ("impressions" >= 0 AND "views" >= 0);

-- Un partage reprend une publication publique, vivante, qui n'est pas elle-même un partage ; il ne porte ni lien ni
-- image (ce sont ceux de l'original). Une image est une image de publication déposée par l'auteur.
CREATE FUNCTION "proofseen_post_rules"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sharedPostId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."sharedPostId" IS DISTINCT FROM OLD."sharedPostId") THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Post" o
      WHERE o."id" = NEW."sharedPostId" AND o."sharedPostId" IS NULL AND o."visibility" = 'public'
        AND o."deletedAt" IS NULL AND o."moderatedAt" IS NULL
    ) THEN
      RAISE EXCEPTION 'partage : publication d''origine non partageable';
    END IF;
    IF NEW."linkUrl" IS NOT NULL OR NEW."imageFileId" IS NOT NULL THEN
      RAISE EXCEPTION 'partage : ni lien ni image';
    END IF;
  END IF;
  IF NEW."imageFileId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."imageFileId" IS DISTINCT FROM OLD."imageFileId") THEN
    IF NOT EXISTS (
      SELECT 1 FROM "StoredFile" f WHERE f."id" = NEW."imageFileId" AND f."kind"::text = 'post_image' AND f."ownerId" = NEW."authorUserId"
    ) THEN
      RAISE EXCEPTION 'publication : image inconnue ou d''un autre compte';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Post_rules" BEFORE INSERT OR UPDATE OF "sharedPostId", "imageFileId" ON "Post"
  FOR EACH ROW EXECUTE FUNCTION "proofseen_post_rules"();

-- Une réponse répond à un commentaire de la même publication, qui n'est pas lui-même une réponse : un seul niveau.
CREATE FUNCTION "proofseen_comment_thread"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."parentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PostComment" p WHERE p."id" = NEW."parentId" AND p."postId" = NEW."postId" AND p."parentId" IS NULL
  ) THEN
    RAISE EXCEPTION 'commentaire : réponse à un seul niveau, sur la même publication';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PostComment_thread" BEFORE INSERT OR UPDATE OF "parentId", "postId" ON "PostComment"
  FOR EACH ROW EXECUTE FUNCTION "proofseen_comment_thread"();

-- On ne suit pas son propre profil.
CREATE FUNCTION "proofseen_profile_follow"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FreelanceProfile" p WHERE p."id" = NEW."profileId" AND p."userId" = NEW."userId") THEN
    RAISE EXCEPTION 'abonnement : pas à son propre profil';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ProfileFollow_not_self" BEFORE INSERT ON "ProfileFollow"
  FOR EACH ROW EXECUTE FUNCTION "proofseen_profile_follow"();
