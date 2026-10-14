-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('queued', 'running', 'done', 'failed', 'refused');

-- CreateTable
CREATE TABLE "MeasurementRequest" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "status" "MeasurementStatus" NOT NULL DEFAULT 'queued',
    "engines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leasedUntil" TIMESTAMPTZ(3),
    "estimatedCostCents" INTEGER,
    "costCents" INTEGER,
    "waveRefId" UUID,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementRequest_waveRefId_key" ON "MeasurementRequest"("waveRefId");

-- CreateIndex
CREATE INDEX "MeasurementRequest_profileId_createdAt_idx" ON "MeasurementRequest"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MeasurementRequest_requestedByUserId_idx" ON "MeasurementRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "MeasurementRequest_queue_idx" ON "MeasurementRequest"("runAfter", "id") WHERE ("status" = 'queued');

-- CreateIndex
CREATE INDEX "MeasurementRequest_startedAt_idx" ON "MeasurementRequest"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementRequest_active_uq" ON "MeasurementRequest"("profileId") WHERE ("status" IN ('queued', 'running'));

-- AddForeignKey
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelanceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_waveRefId_fkey" FOREIGN KEY ("waveRefId") REFERENCES "Wave"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ═══ Demandes de mesure ═══════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_attempts_range" CHECK ("attempts" BETWEEN 0 AND 20);
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_costs_positive"
  CHECK (("estimatedCostCents" IS NULL OR "estimatedCostCents" >= 0) AND ("costCents" IS NULL OR "costCents" >= 0));
-- Seuls les moteurs du protocole (identiques à `EngineIdSchema` de `@proofseen/core`) : jamais un nom libre.
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_engines_known"
  CHECK ("engines" IS NOT NULL AND "engines" <@ ARRAY['openai', 'anthropic', 'perplexity']::TEXT[]);
-- Un code court, jamais un message de fournisseur qui pourrait citer une réponse ou une adresse.
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_error_code_format"
  CHECK ("errorCode" IS NULL OR "errorCode" ~ '^[a-z0-9_:.-]{1,80}$');
-- Une demande terminée a une date de fin ; une demande en cours a un bail.
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_finished_dated"
  CHECK ("status" NOT IN ('done', 'failed', 'refused') OR "finishedAt" IS NOT NULL);
ALTER TABLE "MeasurementRequest" ADD CONSTRAINT "MeasurementRequest_running_leased"
  CHECK ("status" <> 'running' OR "leasedUntil" IS NOT NULL);
