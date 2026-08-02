-- Football as a second sport.
--
-- Everything added here is additive and defaulted, so an existing cricket
-- tournament reads back exactly as it did before: sport defaults to CRICKET,
-- playersPerTeam to the 11 that was previously a constant, and the clock
-- columns are inert for a code that has no clock.

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "Sport" AS ENUM ('CRICKET', 'FOOTBALL');
CREATE TYPE "FootballEventKind" AS ENUM ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD');
CREATE TYPE "FootballEventType" AS ENUM ('EVENT', 'UNDO');
CREATE TYPE "ClockStatus" AS ENUM ('NOT_STARTED', 'RUNNING', 'PAUSED', 'PERIOD_BREAK', 'FINISHED');

-- ── Tournament ───────────────────────────────────────────────────────────
ALTER TABLE "tournaments" ADD COLUMN "sport" "Sport" NOT NULL DEFAULT 'CRICKET';
ALTER TABLE "tournaments" ADD COLUMN "playersPerTeam" INTEGER NOT NULL DEFAULT 11;
ALTER TABLE "tournaments" ADD COLUMN "periods" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "tournaments" ADD COLUMN "periodMinutes" INTEGER NOT NULL DEFAULT 45;

-- ── Match ────────────────────────────────────────────────────────────────
ALTER TABLE "matches" ADD COLUMN "team1Formation" TEXT;
ALTER TABLE "matches" ADD COLUMN "team2Formation" TEXT;

-- ── Match players ────────────────────────────────────────────────────────
ALTER TABLE "match_players" ADD COLUMN "lineupSlot" INTEGER;
ALTER TABLE "match_players" ADD COLUMN "shirtNumber" INTEGER;

-- ── Points table ─────────────────────────────────────────────────────────
ALTER TABLE "points_table" ADD COLUMN "goalsFor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "points_table" ADD COLUMN "goalsAgainst" INTEGER NOT NULL DEFAULT 0;

-- ── Football event log ───────────────────────────────────────────────────
CREATE TABLE "football_events" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventType" "FootballEventType" NOT NULL DEFAULT 'EVENT',
    "supersedesEventId" TEXT,
    "kind" "FootballEventKind" NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT,
    "assistPlayerId" TEXT,
    "minute" INTEGER NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 1,
    "stoppage" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "football_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "football_events_clientEventId_key" ON "football_events"("clientEventId");
CREATE UNIQUE INDEX "football_events_matchId_seq_key" ON "football_events"("matchId", "seq");
CREATE INDEX "football_events_matchId_createdAt_idx" ON "football_events"("matchId", "createdAt");

ALTER TABLE "football_events" ADD CONSTRAINT "football_events_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "football_events" ADD CONSTRAINT "football_events_supersedesEventId_fkey"
  FOREIGN KEY ("supersedesEventId") REFERENCES "football_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "football_events" ADD CONSTRAINT "football_events_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "football_events" ADD CONSTRAINT "football_events_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "football_events" ADD CONSTRAINT "football_events_assistPlayerId_fkey"
  FOREIGN KEY ("assistPlayerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "football_events" ADD CONSTRAINT "football_events_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Match clock ──────────────────────────────────────────────────────────
CREATE TABLE "match_clocks" (
    "matchId" TEXT NOT NULL,
    "periods" INTEGER NOT NULL,
    "periodMinutes" INTEGER NOT NULL,
    "currentPeriod" INTEGER NOT NULL DEFAULT 1,
    "status" "ClockStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "runningSince" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_clocks_pkey" PRIMARY KEY ("matchId")
);

ALTER TABLE "match_clocks" ADD CONSTRAINT "match_clocks_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
