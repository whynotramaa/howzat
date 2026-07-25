import { z } from 'zod';

/**
 * Prisma emits cuid()s, not uuids — validating as a uuid would reject every
 * real id. A permissive opaque-id check is the honest constraint here.
 */
export const idSchema = z
  .string()
  .trim()
  .min(1, 'id is required')
  .max(64, 'id is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'id contains invalid characters');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Enter a valid email address');

/** #RGB or #RRGGBB. Used for team colors, which get injected as CSS vars. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex color like #1e40af');

export const nameSchema = z.string().trim().min(2, 'Too short').max(80, 'Too long');

/**
 * Handles generated for squad members who have no account start with this.
 * Reserving the prefix at registration is what stops a real account from
 * being created that shadows a placeholder — or, worse, from a placeholder
 * being mistaken for a real profile in a squad list.
 */
export const GUEST_USERNAME_PREFIX = 'guest_';

/**
 * A public handle: lowercase, 3–20 characters, letters/digits/underscore, and
 * it must start with a letter. Deliberately narrow — it appears in URLs, it is
 * what people type to log in, and it is what an organizer types when adding a
 * known player to a squad, so ambiguity is expensive.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Start with a letter; letters, numbers and underscores only',
  );

/** The handle an account may claim — the same rules, minus the reserved prefix. */
export const claimableUsernameSchema = usernameSchema.refine(
  (value) => !value.startsWith(GUEST_USERNAME_PREFIX),
  { message: `Usernames cannot start with "${GUEST_USERNAME_PREFIX}" — that prefix is reserved` },
);

export function isGuestUsername(username: string): boolean {
  return username.startsWith(GUEST_USERNAME_PREFIX);
}

/**
 * Sign-in accepts either handle or email in one field. Which one it is can be
 * decided by looking for an "@", so the form never has to ask.
 */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter your username or email')
  .max(254);

/**
 * Long rather than complex. Character-class rules push people towards
 * "Password1!" and no further; length is the property that actually costs an
 * attacker something, so that is the only thing enforced here.
 */
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(200, 'At most 200 characters');

/** Derives a valid handle from an arbitrary string (an email local part, a name). */
export function slugifyUsername(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 20);

  return cleaned.length >= 3 ? cleaned : `user${cleaned}`.slice(0, 20);
}

export type Id = z.infer<typeof idSchema>;
