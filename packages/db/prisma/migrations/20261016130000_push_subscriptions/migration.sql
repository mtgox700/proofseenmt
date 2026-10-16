-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMPTZ(3),
    "failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushDelivery_sendAfter_idx" ON "PushDelivery"("sendAfter");

-- CreateIndex
CREATE INDEX "PushDelivery_notificationId_idx" ON "PushDelivery"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "PushDelivery_subscriptionId_notificationId_key" ON "PushDelivery"("subscriptionId", "notificationId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;





-- ═══ Application installable et notifications poussées (C20) ═══════════════════════════════════════════════════════
-- L'adresse d'envoi est une URL https sans identifiants ; la liste des services autorisés est vérifiée par
-- l'application avant l'écriture. Les clés du navigateur sont en base64url : 65 octets pour la clé publique, 16 pour
-- le secret d'authentification. Le libellé de l'appareil est court, jamais l'en-tête complet du navigateur.
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_endpoint_chk"
  CHECK ("endpoint" ~ '^https://[A-Za-z0-9.-]+/' AND length("endpoint") <= 1024);
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_keys_chk"
  CHECK ("p256dh" ~ '^[A-Za-z0-9_-]{86,88}={0,2}$' AND "auth" ~ '^[A-Za-z0-9_-]{21,24}={0,2}$');
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_agent_chk"
  CHECK ("userAgent" IS NULL OR length("userAgent") <= 60);
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_failures_chk" CHECK ("failures" >= 0);
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_attempts_chk" CHECK ("attempts" >= 0);

-- Dix appareils au plus par compte. L'application retire le plus ancien avant d'en ajouter un onzième, sous verrou du
-- compte ; ce déclencheur est le filet si elle l'oubliait.
CREATE FUNCTION proofseen_push_subscription_cap() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF (SELECT count(*) FROM "PushSubscription" s WHERE s."userId" = NEW."userId" AND s."id" <> NEW."id") >= 10 THEN
    RAISE EXCEPTION 'dix appareils au plus par compte';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "PushSubscription_cap" BEFORE INSERT OR UPDATE OF "userId" ON "PushSubscription"
  FOR EACH ROW EXECUTE FUNCTION proofseen_push_subscription_cap();
