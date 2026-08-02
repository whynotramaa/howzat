-- Goalkeeper saves.
--
-- Added to the existing enum rather than given a table of its own: a save is an
-- incident on the same timeline as a goal or a card, it is undone the same way,
-- and it is stamped with the same minute. The only thing that makes it unusual
-- is which side it is credited to — the one defending, not the one attacking.
ALTER TYPE "FootballEventKind" ADD VALUE 'SAVE';
