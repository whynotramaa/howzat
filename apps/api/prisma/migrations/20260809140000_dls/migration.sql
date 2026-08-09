-- Duckworth-Lewis-Stern.
--
-- Everything here is opt-in and additive: a match nobody applied DLS to reads
-- exactly as it did before, because dlsApplied is false, ballsQuota is null and
-- there are no interruption rows to fold in.

-- An innings closed by the weather rather than by cricket.
ALTER TYPE "InningsEndReason" ADD VALUE 'DLS_TERMINATED';

ALTER TABLE "matches" ADD COLUMN "dlsApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "matches" ADD COLUMN "dlsG50" INTEGER;
ALTER TABLE "matches" ADD COLUMN "dlsParScore" INTEGER;
ALTER TABLE "matches" ADD COLUMN "decidedByDls" BOOLEAN NOT NULL DEFAULT false;

-- The allotment to the ball. A stoppage does not wait for the end of an over,
-- so an innings can be left owing 40.3 overs, which oversQuota cannot express.
-- Null means "no stoppage has touched this innings" and oversQuota * 6 stands.
ALTER TABLE "innings" ADD COLUMN "ballsQuota" INTEGER;

CREATE TABLE "dls_interruptions" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "inningsNumber" INTEGER NOT NULL,
  "ballsRemainingAtSuspension" INTEGER NOT NULL,
  "wicketsLost" INTEGER NOT NULL,
  "ballsRemainingOnResumption" INTEGER NOT NULL,
  "reason" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dls_interruptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dls_interruptions_matchId_inningsNumber_createdAt_idx"
  ON "dls_interruptions"("matchId", "inningsNumber", "createdAt");

ALTER TABLE "dls_interruptions" ADD CONSTRAINT "dls_interruptions_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dls_interruptions" ADD CONSTRAINT "dls_interruptions_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
