import crypto from 'node:crypto';

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const SLUG_LENGTH = 10;

function generatePublicSlug(): string {
  const bytes = crypto.randomBytes(SLUG_LENGTH);
  let slug = '';

  for (let index = 0; index < SLUG_LENGTH; index += 1) {
    slug += ALPHABET[bytes[index]! % ALPHABET.length];
  }

  return slug;
}

export function generateSlugs(count: number): string[] {
  const slugs = new Set<string>();
  while (slugs.size < count) slugs.add(generatePublicSlug());
  return [...slugs];
}
