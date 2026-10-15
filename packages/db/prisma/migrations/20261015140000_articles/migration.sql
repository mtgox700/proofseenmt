-- CreateEnum
CREATE TYPE "ArticleCategory" AS ENUM ('guide', 'actualite', 'etude');

-- CreateEnum
CREATE TYPE "ArticleAudience" AS ENUM ('freelance', 'entreprise', 'tous');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "Article" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "lang" CHAR(2) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "ArticleCategory" NOT NULL,
    "audience" "ArticleAudience" NOT NULL,
    "authorName" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMPTZ(3),
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_published_recent_idx" ON "Article"("lang", "publishedAt" DESC, "id" DESC) WHERE ("status" = 'published');

-- CreateIndex
CREATE UNIQUE INDEX "Article_lang_slug_key" ON "Article"("lang", "slug");



-- ═══ Articles du blog ═════════════════════════════════════════════════════════════════════════════════════════════
-- Une adresse lisible et stable, deux langues, des textes bornés. Un article publié a toujours sa date de publication.
-- Les sources sont une liste JSON ; la règle « aucun chiffre sans source » est tenue par le dépôt, qui lit le texte.
ALTER TABLE "Article" ADD CONSTRAINT "Article_lang_chk" CHECK ("lang" IN ('fr','en'));
ALTER TABLE "Article" ADD CONSTRAINT "Article_slug_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 120);
ALTER TABLE "Article" ADD CONSTRAINT "Article_title_length" CHECK (char_length(btrim("title")) BETWEEN 1 AND 160);
ALTER TABLE "Article" ADD CONSTRAINT "Article_description_length" CHECK (char_length(btrim("description")) BETWEEN 1 AND 300);
ALTER TABLE "Article" ADD CONSTRAINT "Article_body_length" CHECK (char_length(btrim("body")) BETWEEN 1 AND 100000);
ALTER TABLE "Article" ADD CONSTRAINT "Article_author_length" CHECK (char_length(btrim("authorName")) BETWEEN 1 AND 80);
ALTER TABLE "Article" ADD CONSTRAINT "Article_sources_array" CHECK (jsonb_typeof("sources") = 'array' AND jsonb_array_length("sources") <= 30);
ALTER TABLE "Article" ADD CONSTRAINT "Article_published_dated" CHECK ("status" <> 'published' OR "publishedAt" IS NOT NULL);
