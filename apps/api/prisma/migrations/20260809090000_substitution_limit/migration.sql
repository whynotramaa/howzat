-- How many changes a side is allowed.
--
-- Null means the rolling, unlimited bench futsal is played with, which is what
-- every match recorded before this column existed was scored under: a player
-- may come off and go straight back on, as often as the game asks for it. The
-- scorer picks 3, 5, or unlimited at kick off.
ALTER TABLE "matches" ADD COLUMN "subLimit" INTEGER;
