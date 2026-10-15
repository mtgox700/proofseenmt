-- CreateEnum
CREATE TYPE "AppNotificationKind" AS ENUM ('contact_received', 'message_received', 'application_received', 'application_read', 'application_status', 'mission_invitation', 'mission_confirmation', 'contract_update', 'measurement_done');

-- AlterEnum
ALTER TYPE "StoredFileKind" ADD VALUE 'message_attachment';

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "messageId" UUID;

-- CreateTable
CREATE TABLE "ConversationRead" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AppNotificationKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDigest" (
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMPTZ(3),

    CONSTRAINT "MessageDigest_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ConversationRead_userId_idx" ON "ConversationRead"("userId");

-- CreateIndex
CREATE INDEX "AppNotification_userId_createdAt_id_idx" ON "AppNotification"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AppNotification_unread_idx" ON "AppNotification"("userId") WHERE ("readAt" IS NULL);

-- CreateIndex
CREATE INDEX "AppNotification_read_idx" ON "AppNotification"("readAt") WHERE ("readAt" IS NOT NULL);

-- CreateIndex
CREATE INDEX "MessageDigest_lastRunAt_idx" ON "MessageDigest"("lastRunAt");

-- CreateIndex
CREATE INDEX "StoredFile_messageId_idx" ON "StoredFile"("messageId") WHERE ("messageId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDigest" ADD CONSTRAINT "MessageDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;





-- ═══ Messagerie vivante (C15) ════════════════════════════════════════════════════════════════════════════════════
-- La nouvelle valeur « message_attachment » est comparée en texte : ajoutée par ALTER TYPE dans cette même
-- transaction, elle ne peut pas encore servir de constante du type énuméré.

-- Une pièce jointe est un PDF ou une image ; les autres usages gardent leur règle (un CV est un PDF, une image n'en
-- est pas un).
ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_content_type";
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_content_type" CHECK (
  "contentType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND ("kind"::text = 'message_attachment' OR (("kind"::text = 'cv') = ("contentType" = 'application/pdf')))
);
-- Seule une pièce jointe se rattache à un message.
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_message_chk" CHECK ("messageId" IS NULL OR "kind"::text = 'message_attachment');

-- Une pièce jointe se rattache une fois, au message de la personne qui l'a déposée, trois au plus par message. Elle
-- peut perdre son message (clé étrangère remise à nul quand il disparaît), jamais en changer.
CREATE FUNCTION proofseen_attachment_link() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."messageId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."messageId" IS NOT DISTINCT FROM NEW."messageId" THEN
      RETURN NEW;
    END IF;
    IF OLD."messageId" IS NOT NULL THEN
      RAISE EXCEPTION 'une pièce jointe ne change pas de message';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Message" m WHERE m."id" = NEW."messageId" AND m."senderUserId" = NEW."ownerId") THEN
    RAISE EXCEPTION 'pièce jointe refusée : elle appartient à l''auteur du message';
  END IF;
  IF (SELECT count(*) FROM "StoredFile" f WHERE f."messageId" = NEW."messageId" AND f."id" <> NEW."id") >= 3 THEN
    RAISE EXCEPTION 'trois pièces jointes au plus par message';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER "StoredFile_attachment_link" BEFORE INSERT OR UPDATE OF "messageId" ON "StoredFile"
  FOR EACH ROW EXECUTE FUNCTION proofseen_attachment_link();

-- Une notification ne porte que des références : un petit objet, jamais un texte de message.
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_payload_chk"
  CHECK (jsonb_typeof("payload") = 'object' AND pg_column_size("payload") <= 2048);
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_read_chk" CHECK ("readAt" IS NULL OR "readAt" >= "createdAt");

-- Événements en direct : chaque message, chaque lecture et chaque notification est signalé sur le canal
-- « proofseen_live » (LISTEN/NOTIFY). Postgres ne livre le signal qu'à la validation de la transaction : celui qui
-- l'écoute relit donc toujours une ligne déjà visible. Le signal ne porte que des identifiants ; qui a le droit de
-- savoir quoi est décidé par l'application, qui relit la base.
CREATE FUNCTION proofseen_live_message() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_notify('proofseen_live', json_build_object('kind', 'message', 'conversationId', NEW."conversationId", 'senderUserId', NEW."senderUserId")::text);
  RETURN NULL;
END $fn$;
CREATE TRIGGER "Message_live" AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION proofseen_live_message();

CREATE FUNCTION proofseen_live_read() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_notify('proofseen_live', json_build_object('kind', 'read', 'conversationId', NEW."conversationId", 'userId', NEW."userId", 'readAt', NEW."readAt")::text);
  RETURN NULL;
END $fn$;
CREATE TRIGGER "ConversationRead_live" AFTER INSERT OR UPDATE ON "ConversationRead"
  FOR EACH ROW EXECUTE FUNCTION proofseen_live_read();

-- Plusieurs notifications d'une même personne dans une transaction donnent un seul signal : Postgres fusionne les
-- signaux identiques d'une transaction.
CREATE FUNCTION proofseen_live_notification() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_notify('proofseen_live', json_build_object('kind', 'notification', 'userId', NEW."userId")::text);
  RETURN NULL;
END $fn$;
CREATE TRIGGER "AppNotification_live" AFTER INSERT OR UPDATE OF "readAt" ON "AppNotification"
  FOR EACH ROW EXECUTE FUNCTION proofseen_live_notification();

