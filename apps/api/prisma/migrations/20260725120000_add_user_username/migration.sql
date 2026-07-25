-- Adds User.username as a required, unique handle.
--
-- Done in four steps rather than one: the column cannot be created NOT NULL on
-- a table that already has rows, and a blanket default would collide with the
-- unique index. So: add it nullable, derive a value for every existing row,
-- then constrain it.

-- 1. Nullable to begin with.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- 2. Backfill from the email local part, lowercased and stripped of anything
--    outside [a-z0-9_]. Ties are broken with a short suffix from the row id so
--    that e.g. alex@a.com and alex@b.com cannot collide.
UPDATE "users"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9_]', '', 'g'));

UPDATE "users" u
SET "username" = u."username" || '_' || RIGHT(u."id", 4)
WHERE EXISTS (
  SELECT 1 FROM "users" other
  WHERE other."username" = u."username" AND other."id" <> u."id"
);

-- Anything that reduced to an empty string still needs a handle.
UPDATE "users"
SET "username" = 'user_' || RIGHT("id", 8)
WHERE "username" IS NULL OR "username" = '';

-- 3. Now it can be required.
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- 4. And unique.
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
