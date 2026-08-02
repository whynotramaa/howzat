-- Substitutions.
--
-- The only incident that names two players, so it gets a column of its own
-- rather than borrowing assistPlayerId: a field called "assist" holding the
-- player who was hooked at 60 minutes is the kind of saving that costs an hour
-- to understand a season later.
ALTER TYPE "FootballEventKind" ADD VALUE 'SUBSTITUTION';

ALTER TABLE "football_events" ADD COLUMN "playerOffId" TEXT;

ALTER TABLE "football_events" ADD CONSTRAINT "football_events_playerOffId_fkey"
  FOREIGN KEY ("playerOffId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
