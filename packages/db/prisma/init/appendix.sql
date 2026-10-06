
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Contraintes et déclencheurs que Prisma ne sait pas exprimer. Ils protègent les données même si un code oublie de
-- valider : la dernière ligne de défense est dans la base.
--
-- Règle tenue partout : une colonne qui peut devenir NULL par suppression de compte (RGPD) n'est jamais exigée par un
-- CHECK, qui ferait échouer la suppression. Elle est exigée à la création par un déclencheur.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- Devises : liste fermée, élargie quand un marché ouvre. Toutes ont deux décimales : les centimes restent justes.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_currency_chk" CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "JobPost"          ADD CONSTRAINT "JobPost_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Quote"            ADD CONSTRAINT "Quote_currency_chk"            CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Contract"         ADD CONSTRAINT "Contract_currency_chk"         CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Payment"          ADD CONSTRAINT "Payment_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Invoice"          ADD CONSTRAINT "Invoice_currency_chk"          CHECK ("currency" IN ('EUR','GBP','CHF','USD'));
ALTER TABLE "Wave"             ADD CONSTRAINT "Wave_currency_chk"             CHECK ("currency" IN ('EUR','GBP','CHF','USD'));

-- Argent. Entiers 32 bits : 21,4 M€ par ligne, très au-dessus de tout contrat freelance ; les bornes attrapent surtout
-- les erreurs d'unité (des euros saisis comme des centimes). Les produits sont calculés en 64 bits.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_rate_chk" CHECK ("dailyRateCents" IS NULL OR "dailyRateCents" BETWEEN 0 AND 10000000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_rate_chk" CHECK (
  ("dailyRateMinCents" IS NULL OR "dailyRateMinCents" BETWEEN 0 AND 10000000) AND
  ("dailyRateMaxCents" IS NULL OR "dailyRateMaxCents" BETWEEN 0 AND 10000000) AND
  ("dailyRateMinCents" IS NULL OR "dailyRateMaxCents" IS NULL OR "dailyRateMinCents" <= "dailyRateMaxCents"));
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_amounts_chk" CHECK (
  "dailyRateCents" BETWEEN 0 AND 10000000 AND "days" BETWEEN 1 AND 1000 AND "totalCents" = "dailyRateCents"::bigint * "days");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_amounts_chk" CHECK (
  "dailyRateCents" BETWEEN 0 AND 10000000 AND "days" BETWEEN 1 AND 1000 AND "totalCents" = "dailyRateCents"::bigint * "days");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amounts_chk" CHECK (
  "amountCents" > 0 AND "commissionCents" BETWEEN 0 AND "amountCents" AND "refundedCents" BETWEEN 0 AND "amountCents");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_chk" CHECK (
  "netCents" >= 0 AND "vatCents" >= 0 AND "vatRateBp" BETWEEN 0 AND 10000 AND "totalCents" = "netCents"::bigint + "vatCents");
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_chk" CHECK ("year" BETWEEN 2000 AND 2999 AND "last" >= 0);
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_counts_chk" CHECK ("costCents" >= 0 AND "draws" >= 0);

-- Profil : un brouillon privé peut être incomplet ; un profil publié, non.
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_publishable_chk" CHECK (
  "visibility" = 'private' OR ("slug" IS NOT NULL AND "headline" IS NOT NULL AND "summary" IS NOT NULL AND "city" IS NOT NULL));
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_availability_chk" CHECK (
  ("availability" = 'available_from') = ("availableFrom" IS NOT NULL));
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_slug_chk" CHECK ("slug" IS NULL OR "slug" ~ '^[a-z0-9-]{3,60}$');
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_reference_chk" CHECK ("reference" ~ '^FR-[A-Z2-9]{5,8}$');
ALTER TABLE "FreelanceProfile" ADD CONSTRAINT "FreelanceProfile_text_chk" CHECK (
  char_length(coalesce("headline", '')) <= 200 AND char_length(coalesce("summary", '')) <= 4000);
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_reference_chk" CHECK ("reference" ~ '^FR-[A-Z2-9]{5,8}$');

-- Formes normalisées : une seule écriture possible d'une même chose.
ALTER TABLE "User"         ADD CONSTRAINT "User_email_lower_chk"         CHECK ("email" = lower("email"));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_email_lower_chk" CHECK ("email" = lower("email"));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_lang_chk"        CHECK ("lang" IN ('fr','en'));
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_urls_chk"        CHECK (cardinality("urls") BETWEEN 1 AND 10);
ALTER TABLE "Skill"        ADD CONSTRAINT "Skill_key_lower_chk"          CHECK ("key" = lower("key"));
ALTER TABLE "OwnedUrl"     ADD CONSTRAINT "OwnedUrl_urlKey_chk"          CHECK ("urlKey" !~ '/$');

-- Missions et candidatures.
ALTER TABLE "VerifiedMission" ADD CONSTRAINT "VerifiedMission_chk" CHECK (
  "durationMonths" BETWEEN 1 AND 600 AND char_length("role") <= 200 AND char_length("summary") <= 2000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_duration_chk" CHECK ("durationMonths" IS NULL OR "durationMonths" BETWEEN 1 AND 600);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_text_chk" CHECK (
  char_length("title") BETWEEN 1 AND 200 AND char_length("description") BETWEEN 1 AND 20000);
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_location_chk" CHECK ("workMode" = 'remote' OR "city" IS NOT NULL);
-- Une mission ouverte a une date de publication ; une mission close, une date de clôture, postérieure.
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_state_dates_chk" CHECK (
  ("status" <> 'open' OR "publishedAt" IS NOT NULL) AND
  ("status" <> 'closed' OR "closedAt" IS NOT NULL) AND
  ("closedAt" IS NULL OR "publishedAt" IS NULL OR "closedAt" >= "publishedAt"));
ALTER TABLE "Application" ADD CONSTRAINT "Application_text_chk" CHECK (char_length("coverNote") <= 5000);

-- Messagerie, contrat, avis.
ALTER TABLE "Message" ADD CONSTRAINT "Message_body_chk" CHECK (char_length("body") BETWEEN 1 AND 10000);
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_dates_chk" CHECK ("endsOn" IS NULL OR "endsOn" >= "startsOn");
-- Un contrat actif ou terminé a été accepté par les deux parties.
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signed_chk" CHECK (
  "status" NOT IN ('active','completed') OR ("acceptedByFreelanceAt" IS NOT NULL AND "acceptedByOrgAt" IS NOT NULL));
ALTER TABLE "Review" ADD CONSTRAINT "Review_chk" CHECK ("rating" BETWEEN 1 AND 5 AND char_length("body") BETWEEN 1 AND 4000);

-- Limiteur de débit : table très écrite, laissée à moitié vide pour que la mise à jour du compteur reste locale.
ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_count_chk" CHECK ("count" >= 0);
ALTER TABLE "RateLimitBucket" SET (fillfactor = 50, autovacuum_vacuum_scale_factor = 0.01);

-- ═══ Déclencheurs ══════════════════════════════════════════════════════════════════════════════════════════════════

-- Une facture émise ne se modifie ni ne se supprime. La purge légale à dix ans désactivera ce déclencheur pour son seul rôle.
CREATE FUNCTION proofseen_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION '% est immuable', TG_TABLE_NAME;
END $fn$;
CREATE TRIGGER "Invoice_immutable" BEFORE UPDATE OR DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION proofseen_forbid_mutation();

-- Les deux parties sont obligatoires à la création d'un contrat (elles ne deviennent nulles que par suppression de compte).
CREATE FUNCTION proofseen_contract_parties() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."organisationId" IS NULL OR NEW."profileId" IS NULL THEN
    RAISE EXCEPTION 'un contrat se crée avec ses deux parties';
  END IF;
  -- Né d'un devis : ce devis est accepté, entre ces deux parties, et le contrat en reprend exactement les conditions.
  IF NEW."quoteId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Quote" q JOIN "Conversation" c ON c."id" = q."conversationId"
    WHERE q."id" = NEW."quoteId" AND q."status" = 'accepted'
      AND c."organisationId" = NEW."organisationId" AND c."profileId" = NEW."profileId"
      AND q."dailyRateCents" = NEW."dailyRateCents" AND q."days" = NEW."days" AND q."currency" = NEW."currency"
  ) THEN
    RAISE EXCEPTION 'contrat incohérent avec son devis';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_parties" BEFORE INSERT ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_parties();

-- Un paiement ne s'enregistre que sur un contrat signé.
CREATE FUNCTION proofseen_payment_contract_active() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE s "ContractStatus";
BEGIN
  SELECT "status" INTO s FROM "Contract" WHERE "id" = NEW."contractId";
  IF s IS NULL OR s NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'paiement refusé : le contrat n''est pas signé';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Payment_contract_active" BEFORE INSERT ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION proofseen_payment_contract_active();

-- Un avis : contrat terminé, cible = le freelance du contrat, auteur membre de l'entreprise du contrat.
CREATE FUNCTION proofseen_review_integrity() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD;
BEGIN
  IF NEW."authorUserId" IS NULL THEN
    RAISE EXCEPTION 'un avis a un auteur';
  END IF;
  SELECT "status", "profileId", "organisationId" INTO c FROM "Contract" WHERE "id" = NEW."contractId";
  IF c."status" IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'avis refusé : la mission n''est pas terminée';
  END IF;
  IF c."profileId" IS DISTINCT FROM NEW."targetProfileId" THEN
    RAISE EXCEPTION 'avis refusé : la cible n''est pas le freelance de ce contrat';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."organisationId" = c."organisationId" AND m."userId" = NEW."authorUserId") THEN
    RAISE EXCEPTION 'avis refusé : l''auteur n''est pas membre de l''entreprise du contrat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Review_integrity" BEFORE INSERT ON "Review"
  FOR EACH ROW EXECUTE FUNCTION proofseen_review_integrity();

-- Un fil direct n'a jamais de candidature. L'inverse n'est exigé qu'à la création : une candidature supprimée se détache.
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_direct_chk" CHECK (NOT "direct" OR "applicationId" IS NULL);

-- Les parties et l'origine d'un fil sont fixées à sa création ; un fil de candidature réunit ce freelance et l'entreprise
-- de cette mission. Seul changement admis ensuite : la candidature qui se détache.
CREATE FUNCTION proofseen_conversation_consistency() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."organisationId" IS DISTINCT FROM OLD."organisationId" OR NEW."profileId" IS DISTINCT FROM OLD."profileId"
       OR NEW."direct" IS DISTINCT FROM OLD."direct"
       OR (NEW."applicationId" IS NOT NULL AND NEW."applicationId" IS DISTINCT FROM OLD."applicationId") THEN
      RAISE EXCEPTION 'les parties et l''origine d''une conversation ne changent pas';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT NEW."direct" AND NEW."applicationId" IS NULL THEN
    RAISE EXCEPTION 'une conversation est directe ou rattachée à une candidature';
  END IF;
  -- Un fil direct naît en attente : seul le freelance peut l'accepter, jamais l'entreprise en le créant.
  IF NEW."direct" AND NEW."status" <> 'pending' THEN
    RAISE EXCEPTION 'un fil direct naît en attente de l''accord du freelance';
  END IF;
  -- Personne ne se contacte soi-même au nom de son entreprise : ce serait fabriquer des missions et des avis.
  IF EXISTS (
    SELECT 1 FROM "FreelanceProfile" p JOIN "Membership" m ON m."userId" = p."userId"
    WHERE p."id" = NEW."profileId" AND m."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'conversation refusée : le freelance est membre de cette entreprise';
  END IF;
  IF NEW."applicationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Application" a JOIN "JobPost" j ON j."id" = a."jobPostId"
    WHERE a."id" = NEW."applicationId" AND a."profileId" = NEW."profileId" AND j."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'conversation incohérente avec sa candidature';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Conversation_consistency" BEFORE INSERT OR UPDATE OF "applicationId", "profileId", "organisationId", "direct" ON "Conversation"
  FOR EACH ROW EXECUTE FUNCTION proofseen_conversation_consistency();

-- La date du dernier message suit chaque message, dans la même transaction.
CREATE FUNCTION proofseen_touch_conversation() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "Conversation" SET "lastMessageAt" = GREATEST("lastMessageAt", NEW."createdAt") WHERE "id" = NEW."conversationId";
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_touch_conversation" AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_touch_conversation();

-- ═══ Ce qui est écrit ne se réécrit pas ════════════════════════════════════════════════════════════════════════════
-- Les déclencheurs d'insertion ne suffisent pas : sans ceux-ci, une mise à jour réécrirait un avis, déplacerait un
-- paiement vers un contrat non signé ou changerait le montant d'un contrat signé. Partout, une partie peut devenir
-- nulle (suppression de compte, RGPD) mais jamais être remplacée par une autre.

CREATE FUNCTION proofseen_contract_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF (NEW."organisationId" IS DISTINCT FROM OLD."organisationId" AND NEW."organisationId" IS NOT NULL)
     OR (NEW."profileId" IS DISTINCT FROM OLD."profileId" AND NEW."profileId" IS NOT NULL)
     OR (NEW."quoteId" IS DISTINCT FROM OLD."quoteId" AND NEW."quoteId" IS NOT NULL) THEN
    RAISE EXCEPTION 'les parties d''un contrat ne changent pas';
  END IF;
  IF NEW."dailyRateCents" <> OLD."dailyRateCents" OR NEW."days" <> OLD."days" OR NEW."totalCents" <> OLD."totalCents"
     OR NEW."currency" <> OLD."currency" OR NEW."startsOn" <> OLD."startsOn"
     OR NEW."sellerSnapshot" IS DISTINCT FROM OLD."sellerSnapshot" OR NEW."buyerSnapshot" IS DISTINCT FROM OLD."buyerSnapshot" THEN
    RAISE EXCEPTION 'les conditions d''un contrat ne changent pas : un nouveau contrat les remplace';
  END IF;
  IF (OLD."acceptedByFreelanceAt" IS NOT NULL AND NEW."acceptedByFreelanceAt" IS DISTINCT FROM OLD."acceptedByFreelanceAt")
     OR (OLD."acceptedByOrgAt" IS NOT NULL AND NEW."acceptedByOrgAt" IS DISTINCT FROM OLD."acceptedByOrgAt") THEN
    RAISE EXCEPTION 'une signature ne se retire pas';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending_signatures' AND NEW."status" IN ('active', 'cancelled'))
    OR (OLD."status" = 'active' AND NEW."status" IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_update" BEFORE UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_update();

-- Un paiement reste attaché à son contrat, dans sa devise, pour son montant ; seuls son statut et ses remboursements évoluent.
CREATE FUNCTION proofseen_payment_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."contractId" <> OLD."contractId" OR NEW."currency" <> OLD."currency" OR NEW."amountCents" <> OLD."amountCents"
     OR NEW."commissionCents" <> OLD."commissionCents" OR NEW."stripeIntentId" <> OLD."stripeIntentId" THEN
    RAISE EXCEPTION 'un paiement enregistré ne change ni de contrat ni de montant';
  END IF;
  IF NEW."refundedCents" < OLD."refundedCents" THEN
    RAISE EXCEPTION 'un remboursement ne s''annule pas';
  END IF;
  IF OLD."transferId" IS NOT NULL AND NEW."transferId" IS DISTINCT FROM OLD."transferId" THEN
    RAISE EXCEPTION 'un versement ne se réécrit pas';
  END IF;
  -- Parcours fermé : payé puis bloqué, puis versé, remboursé ou contesté. Un versement n'est jamais rejoué.
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('held', 'failed', 'canceled'))
    OR (OLD."status" = 'held' AND NEW."status" IN ('released', 'refunded', 'disputed'))
    OR (OLD."status" = 'disputed' AND NEW."status" IN ('held', 'refunded'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Payment_update" BEFORE UPDATE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION proofseen_payment_update();

-- Un avis publié ne se réécrit pas, ni ne change de cible ; seul son auteur peut disparaître (suppression de compte).
CREATE FUNCTION proofseen_review_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."contractId" <> OLD."contractId" OR NEW."targetProfileId" <> OLD."targetProfileId"
     OR NEW."rating" <> OLD."rating" OR NEW."body" <> OLD."body" OR NEW."createdAt" <> OLD."createdAt"
     OR (NEW."authorUserId" IS DISTINCT FROM OLD."authorUserId" AND NEW."authorUserId" IS NOT NULL) THEN
    RAISE EXCEPTION 'un avis publié ne se modifie pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Review_update" BEFORE UPDATE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION proofseen_review_update();

-- Un message envoyé ne change ni de fil, ni de texte, ni de date ; seul son expéditeur peut disparaître.
CREATE FUNCTION proofseen_message_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."conversationId" <> OLD."conversationId" OR NEW."body" <> OLD."body" OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."containsContact" <> OLD."containsContact"
     OR (NEW."senderUserId" IS DISTINCT FROM OLD."senderUserId" AND NEW."senderUserId" IS NOT NULL) THEN
    RAISE EXCEPTION 'un message envoyé ne se modifie pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_update" BEFORE UPDATE ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_message_update();

-- Une facture ne disparaît pas non plus en vidant la table.
CREATE TRIGGER "Invoice_no_truncate" BEFORE TRUNCATE ON "Invoice"
  FOR EACH STATEMENT EXECUTE FUNCTION proofseen_forbid_mutation();

-- ═══ Consentement du freelance ═════════════════════════════════════════════════════════════════════════════════════
-- Le contact passe par la plateforme, et c'est le freelance qui l'accepte. La règle vit dans la base : un écran ou une
-- route qui l'oublierait ne peut pas la contourner.

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_decision_chk" CHECK (("status" = 'pending') = ("decidedAt" IS NULL));
-- Un fil né d'une candidature n'attend pas d'accord : c'est le freelance qui a écrit le premier.
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_application_accepted_chk" CHECK ("direct" OR "status" <> 'pending');

-- Une décision est définitive : en attente vers accepté ou refusé ; un fil accepté peut seulement être fermé.
CREATE FUNCTION proofseen_conversation_decision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'pending' AND NEW."status" IN ('accepted', 'declined'))
    OR (OLD."status" = 'accepted' AND NEW."status" = 'closed')
  ) THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  IF OLD."decidedAt" IS NOT NULL AND NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt" THEN
    RAISE EXCEPTION 'la décision sur une conversation est définitive';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Conversation_decision" BEFORE UPDATE OF "status", "decidedAt" ON "Conversation"
  FOR EACH ROW EXECUTE FUNCTION proofseen_conversation_decision();

-- Qui peut écrire : une partie du fil, jamais un tiers ; personne dans un fil refusé ; l'entreprise, avant l'accord du
-- freelance, seulement le message qui ouvre le fil.
CREATE FUNCTION proofseen_message_sender() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE c RECORD; freelance BOOLEAN; member BOOLEAN;
BEGIN
  SELECT cv."status", cv."organisationId", p."userId" AS "freelanceUserId" INTO c
    FROM "Conversation" cv JOIN "FreelanceProfile" p ON p."id" = cv."profileId" WHERE cv."id" = NEW."conversationId";
  IF NEW."senderUserId" IS NULL THEN
    RAISE EXCEPTION 'un message a un expéditeur';
  END IF;
  freelance := c."freelanceUserId" = NEW."senderUserId";
  member := EXISTS (SELECT 1 FROM "Membership" m WHERE m."organisationId" = c."organisationId" AND m."userId" = NEW."senderUserId");
  IF NOT freelance AND NOT member THEN
    RAISE EXCEPTION 'message refusé : l''expéditeur n''est pas partie à la conversation';
  END IF;
  IF c."status" IN ('declined', 'closed') THEN
    RAISE EXCEPTION 'message refusé : la conversation est fermée';
  END IF;
  IF NOT freelance AND c."status" = 'pending' AND EXISTS (SELECT 1 FROM "Message" WHERE "conversationId" = NEW."conversationId") THEN
    RAISE EXCEPTION 'message refusé : en attente de l''accord du freelance';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Message_sender" BEFORE INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_message_sender();

-- ═══ Missions et candidatures ══════════════════════════════════════════════════════════════════════════════════════

-- Une mission clôturée ne rouvre pas (on en publie une nouvelle) ; elle ne change pas d'entreprise ; sa date de
-- publication est celle de la première publication.
CREATE FUNCTION proofseen_job_post_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."organisationId" <> OLD."organisationId" THEN
    RAISE EXCEPTION 'une mission ne change pas d''entreprise';
  END IF;
  IF OLD."status" = 'closed' AND NEW."status" <> 'closed' THEN
    RAISE EXCEPTION 'une mission clôturée ne rouvre pas';
  END IF;
  IF OLD."status" = 'open' AND NEW."status" = 'draft' THEN
    RAISE EXCEPTION 'une mission publiée ne redevient pas un brouillon';
  END IF;
  IF OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'la date de publication d''une mission ne change pas';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "JobPost_update" BEFORE UPDATE ON "JobPost"
  FOR EACH ROW EXECUTE FUNCTION proofseen_job_post_update();

-- Une candidature vise une mission ouverte, vient d'un profil publié (un profil privé n'a rien à montrer et ne doit pas
-- être exposé par sa candidature) et jamais d'un membre de l'entreprise qui publie.
CREATE FUNCTION proofseen_application_open_mission() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "JobPost" WHERE "id" = NEW."jobPostId" AND "status" = 'open') THEN
    RAISE EXCEPTION 'candidature refusée : la mission n''est pas ouverte';
  END IF;
  IF EXISTS (SELECT 1 FROM "FreelanceProfile" WHERE "id" = NEW."profileId" AND "visibility" = 'private') THEN
    RAISE EXCEPTION 'candidature refusée : le profil n''est pas publié';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "FreelanceProfile" p JOIN "Membership" m ON m."userId" = p."userId" JOIN "JobPost" j ON j."organisationId" = m."organisationId"
    WHERE p."id" = NEW."profileId" AND j."id" = NEW."jobPostId"
  ) THEN
    RAISE EXCEPTION 'candidature refusée : le freelance est membre de cette entreprise';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_open_mission" BEFORE INSERT ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_open_mission();

-- Une candidature ne change ni de mission, ni de candidat, ni de mot ; ses statuts avancent, ne reculent pas.
CREATE FUNCTION proofseen_application_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."jobPostId" <> OLD."jobPostId" OR NEW."profileId" <> OLD."profileId" OR NEW."coverNote" <> OLD."coverNote" THEN
    RAISE EXCEPTION 'une candidature ne se réécrit pas';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'submitted' AND NEW."status" IN ('shortlisted', 'declined', 'hired', 'withdrawn'))
    OR (OLD."status" = 'shortlisted' AND NEW."status" IN ('declined', 'hired', 'withdrawn'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Application_update" BEFORE UPDATE ON "Application"
  FOR EACH ROW EXECUTE FUNCTION proofseen_application_update();

-- ═══ Devis ═════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Un devis n'existe que dans un fil accepté par le freelance : sans cela, une entreprise irait d'un fil en attente ou
-- refusé jusqu'au contrat et au paiement sans que le freelance ait jamais consenti au contact. Un devis naît brouillon
-- ou envoyé, n'est accepté qu'après avoir été envoyé, et ses montants ne bougent plus une fois envoyé.
CREATE FUNCTION proofseen_quote_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Conversation" WHERE "id" = NEW."conversationId" AND "status" = 'accepted') THEN
    RAISE EXCEPTION 'devis refusé : la conversation n''est pas acceptée par le freelance';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" NOT IN ('draft', 'sent') THEN
      RAISE EXCEPTION 'un devis naît brouillon ou envoyé';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."conversationId" <> OLD."conversationId" THEN
    RAISE EXCEPTION 'un devis ne change pas de conversation';
  END IF;
  IF OLD."status" <> 'draft' AND (NEW."dailyRateCents" <> OLD."dailyRateCents" OR NEW."days" <> OLD."days"
     OR NEW."totalCents" <> OLD."totalCents" OR NEW."currency" <> OLD."currency") THEN
    RAISE EXCEPTION 'un devis envoyé ne change pas de montant : un nouveau devis le remplace';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'draft' AND NEW."status" = 'sent')
    OR (OLD."status" = 'sent' AND NEW."status" IN ('accepted', 'declined', 'superseded'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Quote_guard" BEFORE INSERT OR UPDATE ON "Quote"
  FOR EACH ROW EXECUTE FUNCTION proofseen_quote_guard();

-- ═══ Notifications ═════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "User" ADD CONSTRAINT "User_lang_chk" CHECK ("lang" IN ('fr','en'));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts_chk" CHECK ("attempts" BETWEEN 0 AND 20);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_error_chk" CHECK ("lastError" IS NULL OR char_length("lastError") <= 200);

-- ═══ Facturation ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Taux de TVA d'un freelance : franchise (0), taux réduits, taux normal. Rien d'autre n'existe en France métropolitaine.
ALTER TABLE "BillingIdentity" ADD CONSTRAINT "BillingIdentity_vat_chk" CHECK ("vatRateBp" IN (0, 210, 550, 1000, 2000));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_text_chk" CHECK (char_length("label") BETWEEN 1 AND 300 AND char_length("number") BETWEEN 3 AND 80);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuer_chk" CHECK ("issuer" = 'proofseen' OR "issuer" ~ '^[0-9a-f-]{36}$');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_due_chk" CHECK ("dueOn" >= ("issuedAt" AT TIME ZONE 'UTC')::date);
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_issuer_chk" CHECK ("issuer" = 'proofseen' OR "issuer" ~ '^[0-9a-f-]{36}$');
-- Un paiement versé porte son virement et sa date, dès l'insertion.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_released_chk" CHECK ("status" <> 'released' OR ("transferId" IS NOT NULL AND "releasedAt" IS NOT NULL));
ALTER TABLE "BillingIdentity" ADD CONSTRAINT "BillingIdentity_stripe_chk" CHECK ("stripeAccountId" IS NULL OR "stripeAccountId" ~ '^acct_[A-Za-z0-9]{6,64}$');
