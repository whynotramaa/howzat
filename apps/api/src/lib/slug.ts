import crypto from 'node:crypto';

/**
 * Public match links use a short random slug rather than the database id.
 * A raw cuid in a shared URL leaks insertion order and invites enumeration of
 * every match in the system; ten random base32 characters do not.
 *
 * Ambiguous glyphs (0/O, 1/I/L) are excluded so a slug read aloud at a ground
 * still works.
 */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const SLUG_LENGTH = 10;

export function generatePublicSlug(): string {
  const bytes = crypto.randomBytes(SLUG_LENGTH);
  let slug = '';

  for (let index = 0; index < SLUG_LENGTH; index += 1) {
    slug += ALPHABET[bytes[index]! % ALPHABET.length];
  }

  return slug;
}

/** Distinct slugs for a batch of fixtures, generated without a round-trip each. */
export function generateSlugs(count: number): string[] {
  const slugs = new Set<string>();
  while (slugs.size < count) slugs.add(generatePublicSlug());
  return [...slugs];
}
