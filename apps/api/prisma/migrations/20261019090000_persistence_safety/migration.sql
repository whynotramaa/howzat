ALTER TABLE "matches" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "matches" ADD COLUMN "projectionPending" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "ball_events_inningsId_seq_idx";
UPDATE "matches" SET "projectionPending" = true WHERE "status" IN ('COMPLETED', 'ABANDONED');
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" TEXT;
UPDATE "refresh_tokens" SET "familyId" = "userId";
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");
