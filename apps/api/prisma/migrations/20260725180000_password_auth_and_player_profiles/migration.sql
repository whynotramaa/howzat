-- Three changes that travel together:
--
--   1. Login becomes username + password, with the emailed code demoted to a
--      one-time email verification at signup rather than the way in every time.
--   2. UserRole disappears. Being an organizer is owning a tournament; being a
--      scorer is holding a ScorerAssignment. Neither is a property of a person.
--   3. A squad slot (Player) can now point at an account, and every match a
--      player appears in leaves a stats row behind for their profile.

-- ─────────────────────────────────────────────────────────── users ──

-- Nullable first: the column cannot be created NOT NULL on a table with rows.
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Existing accounts predate passwords. An empty string is not a valid bcrypt
-- digest, so bcrypt.compare against it is always false: these accounts cannot
-- be signed into until a password is set, which is the correct outcome — the
-- alternative is inventing a credential nobody chose.
UPDATE "users" SET "passwordHash" = '' WHERE "passwordHash" IS NULL;

ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL;

ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "UserRole";

-- ─────────────────────────────────────────────────────── otp_codes ──

CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "otp_codes"
  ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'EMAIL_VERIFICATION';

DROP INDEX IF EXISTS "otp_codes_email_createdAt_idx";
CREATE INDEX "otp_codes_email_purpose_createdAt_idx"
  ON "otp_codes"("email", "purpose", "createdAt");

-- ───────────────────────────────────────────────────────── players ──

ALTER TABLE "players" ADD COLUMN "userId" TEXT;
ALTER TABLE "players" ADD COLUMN "username" TEXT;

-- Every existing squad slot is an unregistered player, so each gets a
-- placeholder handle. Derived from the row id rather than randomly, so the
-- migration is deterministic and re-runnable against a restored backup.
UPDATE "players" SET "username" = 'guest_' || RIGHT("id", 8) WHERE "username" IS NULL;

ALTER TABLE "players" ALTER COLUMN "username" SET NOT NULL;

ALTER TABLE "players"
  ADD CONSTRAINT "players_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "players_teamId_userId_key" ON "players"("teamId", "userId");
CREATE UNIQUE INDEX "players_teamId_username_key" ON "players"("teamId", "username");
CREATE INDEX "players_userId_idx" ON "players"("userId");

-- ──────────────────────────────────────────── player_match_stats ──

CREATE TABLE "player_match_stats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,

    "batted" BOOLEAN NOT NULL DEFAULT false,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "isOut" BOOLEAN NOT NULL DEFAULT false,

    "bowled" BOOLEAN NOT NULL DEFAULT false,
    "ballsBowled" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "maidens" INTEGER NOT NULL DEFAULT 0,

    "catches" INTEGER NOT NULL DEFAULT 0,
    "runOuts" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_match_stats_matchId_playerId_key"
  ON "player_match_stats"("matchId", "playerId");
CREATE INDEX "player_match_stats_playerId_idx" ON "player_match_stats"("playerId");
CREATE INDEX "player_match_stats_tournamentId_idx" ON "player_match_stats"("tournamentId");

ALTER TABLE "player_match_stats"
  ADD CONSTRAINT "player_match_stats_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_match_stats"
  ADD CONSTRAINT "player_match_stats_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
