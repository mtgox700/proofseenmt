-- AlterEnum
ALTER TYPE "StatKeywordKind" ADD VALUE 'language';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "cvFileId" UUID;

-- CreateIndex
CREATE INDEX "Application_cvFileId_idx" ON "Application"("cvFileId") WHERE ("cvFileId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ═══ C21 : CV joint à une candidature ══════════════════════════════════════════════════════════════════════════════

-- Le CV joint est un fichier `cv` du candidat lui-même, posé à l'envoi. Il ne se remplace pas ensuite : il peut seulement
-- disparaître (le freelance supprime son CV, ou efface son compte : la clé étrangère le remet à nul). Le dépôt vérifie
-- déjà tout cela ; la base le garantit pour tout autre chemin d'écriture.
CREATE FUNCTION proofseen_application_cv() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."cvFileId" IS NOT NULL AND NEW."cvFileId" IS DISTINCT FROM OLD."cvFileId" THEN
    RAISE EXCEPTION 'le CV joint à une candidature ne se remplace pas';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."cvFileId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "StoredFile" f JOIN "FreelanceProfile" p ON p."userId" = f."ownerId"
    WHERE f."id" = NEW."cvFileId" AND p."id" = NEW."profileId" AND f."kind" = 'cv'
  ) THEN
    RAISE EXCEPTION 'candidature refusée : le fichier joint n''est pas un CV du candidat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_cv" BEFORE INSERT OR UPDATE OF "cvFileId" ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_cv();

-- ═══ C21 : filtre « langues » de la recherche d'entreprise ═════════════════════════════════════════════════════════

-- Une langue demandée compte comme filtre dans l'audience du profil (C17), sous son code ISO 639-1, sans le niveau.
ALTER TABLE "ProfileStatSeen" DROP CONSTRAINT "ProfileStatSeen_scope_chk";
ALTER TABLE "ProfileStatSeen" ADD CONSTRAINT "ProfileStatSeen_scope_chk"
  CHECK ("scope" IN ('view', 'search', 'directory') OR "scope" ~ '^keyword:(skill|city|language):[a-z0-9+#-]{1,60}$');
