-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "repeatClient" BOOLEAN NOT NULL DEFAULT false;



-- La fidélité est un fait de la création du contrat : elle ne change plus, pour qu'aucune partie ne découvre après sa
-- signature un taux de commission différent de celui affiché.
CREATE FUNCTION proofseen_contract_repeat_client_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."repeatClient" IS DISTINCT FROM OLD."repeatClient" THEN
    RAISE EXCEPTION 'fidélité figée à la création du contrat';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "Contract_repeat_client_frozen" BEFORE UPDATE OF "repeatClient" ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION proofseen_contract_repeat_client_frozen();
