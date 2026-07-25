-- In-app notifications.
--
-- No foreign keys to tournaments/teams/matches: those columns are context for
-- rendering a link, not a relationship. Cascading a tournament delete into the
-- record of "you were added to it" would erase something that did happen.

CREATE TYPE "NotificationType" AS ENUM ('SQUAD_ADDED', 'SCORER_ASSIGNED');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "tournamentId" TEXT,
    "teamId" TEXT,
    "matchId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- The bell's unread count reads this one every page load.
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
