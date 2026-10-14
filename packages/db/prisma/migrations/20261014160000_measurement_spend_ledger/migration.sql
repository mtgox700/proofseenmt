-- CreateTable
CREATE TABLE "MeasurementSpend" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "reservedCents" INTEGER NOT NULL,
    "actualCents" INTEGER,
    "hostKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "settledAt" TIMESTAMPTZ(3),

    CONSTRAINT "MeasurementSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeasurementSpend_startedAt_idx" ON "MeasurementSpend"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementSpend_requestId_attempt_key" ON "MeasurementSpend"("requestId", "attempt");



-- ═══ Registre de dépense des mesures ═══════════════════════════════════════════════════════════════════════════════
-- Aucune clé étrangère, à dessein : effacer un compte ne doit effacer ni la dépense de la plateforme, ni ses plafonds.
ALTER TABLE "MeasurementSpend" ADD CONSTRAINT "MeasurementSpend_attempt_range" CHECK ("attempt" BETWEEN 1 AND 20);
ALTER TABLE "MeasurementSpend" ADD CONSTRAINT "MeasurementSpend_costs_positive"
  CHECK ("reservedCents" >= 0 AND ("actualCents" IS NULL OR "actualCents" >= 0));
-- Un essai réglé a une dépense réelle et une date de règlement ; un essai en cours n'a ni l'une ni l'autre.
ALTER TABLE "MeasurementSpend" ADD CONSTRAINT "MeasurementSpend_settled_consistent"
  CHECK (("actualCents" IS NULL) = ("settledAt" IS NULL));
-- Des empreintes SHA-256 seulement : jamais une adresse en clair dans un registre qui survit à l'effacement.
ALTER TABLE "MeasurementSpend" ADD CONSTRAINT "MeasurementSpend_host_keys_hashed"
  CHECK ("hostKeys" IS NOT NULL AND cardinality("hostKeys") <= 20 AND array_to_string("hostKeys", ',') ~ '^([0-9a-f]{64}(,[0-9a-f]{64})*)?$');
