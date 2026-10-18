-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'profile_match';

-- AlterTable
ALTER TABLE "FreelanceProfile" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "createdByUserId" UUID,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearchSeen" (
    "savedSearchId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "seenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearchSeen_pkey" PRIMARY KEY ("savedSearchId","profileId")
);

-- CreateIndex
CREATE INDEX "SavedSearch_organisationId_createdAt_idx" ON "SavedSearch"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SavedSearch_createdByUserId_idx" ON "SavedSearch"("createdByUserId") WHERE ("createdByUserId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "SavedSearch_alert_due_idx" ON "SavedSearch"("lastCheckedAt") WHERE ("alert");

-- CreateIndex
CREATE INDEX "SavedSearchSeen_profileId_idx" ON "SavedSearchSeen"("profileId");

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchSeen" ADD CONSTRAINT "SavedSearchSeen_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchSeen" ADD CONSTRAINT "SavedSearchSeen_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ═══ C22 : recherche par mots-clés des profils ═════════════════════════════════════════════════════════════════════

-- Le texte cherché d'un profil : titre, résumé, compétences et intitulés des expériences, pliés comme celui des missions
-- (proofseen_fold, migration 20261017090000_search_unaccent). Tenu par la base : chaque chemin d'écriture (profil,
-- compétences, expériences, import d'un CV) le met à jour sans que l'application y pense. Une écriture directe de la
-- colonne est recalculée elle aussi : le texte ne dit jamais autre chose que le profil.
CREATE FUNCTION proofseen_profile_search_text(p_id uuid, p_headline text, p_summary text) RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $fn$
  SELECT proofseen_fold(concat_ws(' ', p_headline, p_summary,
    (SELECT string_agg(s."label", ' ' ORDER BY s."label") FROM "FreelanceSkill" fs JOIN "Skill" s ON s."id" = fs."skillId" WHERE fs."profileId" = p_id),
    (SELECT string_agg(e."title", ' ' ORDER BY e."startMonth" DESC, e."id") FROM "ProfileExperience" e WHERE e."profileId" = p_id)))
$fn$;

CREATE FUNCTION proofseen_profile_search_row() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW."searchText" := proofseen_profile_search_text(NEW."id", NEW."headline", NEW."summary");
  RETURN NEW;
END $fn$;
CREATE TRIGGER "FreelanceProfile_search_text" BEFORE INSERT OR UPDATE OF "headline", "summary", "searchText" ON "FreelanceProfile"
  FOR EACH ROW EXECUTE FUNCTION proofseen_profile_search_row();

-- Une compétence ou une expérience ajoutée, modifiée ou retirée : le profil recalcule son texte (le déclencheur
-- ci-dessus fait le calcul). Un profil effacé en cascade n'est plus là : la mise à jour ne touche alors aucune ligne.
CREATE FUNCTION proofseen_profile_search_child() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "FreelanceProfile" SET "searchText" = '' WHERE "id" = OLD."profileId";
    RETURN NULL;
  END IF;
  UPDATE "FreelanceProfile" SET "searchText" = '' WHERE "id" = NEW."profileId";
  IF TG_OP = 'UPDATE' AND OLD."profileId" IS DISTINCT FROM NEW."profileId" THEN
    UPDATE "FreelanceProfile" SET "searchText" = '' WHERE "id" = OLD."profileId";
  END IF;
  RETURN NULL;
END $fn$;
CREATE TRIGGER "FreelanceSkill_search_text" AFTER INSERT OR UPDATE OR DELETE ON "FreelanceSkill"
  FOR EACH ROW EXECUTE FUNCTION proofseen_profile_search_child();
CREATE TRIGGER "ProfileExperience_search_text" AFTER INSERT OR UPDATE OF "title", "profileId" OR DELETE ON "ProfileExperience"
  FOR EACH ROW EXECUTE FUNCTION proofseen_profile_search_child();

-- Le libellé d'une compétence corrigé : les profils qui la portent recalculent leur texte.
CREATE FUNCTION proofseen_skill_label_search() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "FreelanceProfile" SET "searchText" = '' WHERE "id" IN (SELECT "profileId" FROM "FreelanceSkill" WHERE "skillId" = NEW."id");
  RETURN NULL;
END $fn$;
CREATE TRIGGER "Skill_label_search_text" AFTER UPDATE OF "label" ON "Skill"
  FOR EACH ROW WHEN (OLD."label" IS DISTINCT FROM NEW."label") EXECUTE FUNCTION proofseen_skill_label_search();

-- Les profils qui existent déjà.
UPDATE "FreelanceProfile" SET "searchText" = '';

-- Recherche plein texte des profils publiés, en français et en anglais, sur le texte plié. Un filtre, jamais un ordre :
-- aucun ts_rank, la liste garde l'ordre choisi par l'entreprise. L'expression est recopiée telle quelle par la requête
-- (packages/db/src/profile-search-ids.ts), sinon l'index ne sert pas.
CREATE INDEX "FreelanceProfile_public_search_text_idx" ON "FreelanceProfile" USING GIN (
  (to_tsvector('french'::regconfig, "searchText") || to_tsvector('english'::regconfig, "searchText"))
) WHERE "visibility" <> 'private';

-- ═══ C22 : recherches enregistrées ═════════════════════════════════════════════════════════════════════════════════

-- Les bornes du dépôt (packages/db/src/saved-searches.ts), tenues aussi par la base.
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_name_chk" CHECK (char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_query_chk" CHECK (char_length("query") <= 2000);

