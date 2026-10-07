-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- CreateIndex
CREATE INDEX "ApiKey_organisationId_idx" ON "ApiKey"("organisationId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ═══ Clés d'API ═══════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_name_length" CHECK (char_length("name") BETWEEN 1 AND 60);
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_hash_format" CHECK ("hash" ~ '^[0-9a-f]{64}$');

-- Une clé ne change jamais d'empreinte ni d'entreprise, et une clé révoquée ne revit pas.
CREATE FUNCTION proofseen_api_key_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."hash" <> OLD."hash" OR NEW."organisationId" <> OLD."organisationId" OR NEW."prefix" <> OLD."prefix" THEN
    RAISE EXCEPTION 'clé d''API figée : empreinte, préfixe et entreprise ne changent pas';
  END IF;
  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'clé d''API révoquée pour toujours';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "ApiKey_guard" BEFORE UPDATE ON "ApiKey"
  FOR EACH ROW EXECUTE FUNCTION proofseen_api_key_guard();
