-- Per-match clock settings, and room on the bench.
--
-- Both columns are nullable and mean "inherit the tournament's setting", so
-- every existing match keeps the clock it would have had. Nothing is backfilled
-- on purpose: copying the tournament's numbers onto each row would freeze them,
-- and then changing the tournament default would stop moving matches nobody had
-- deliberately overridden.
ALTER TABLE "matches" ADD COLUMN "periods" INTEGER;
ALTER TABLE "matches" ADD COLUMN "periodMinutes" INTEGER;
