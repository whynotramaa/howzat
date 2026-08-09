import { z } from 'zod';

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

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex color like #1e40af');

export const nameSchema = z.string().trim().min(2, 'Too short').max(80, 'Too long');

export const GUEST_USERNAME_PREFIX = 'guest_';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-z][a-z0-9_]*$/, 'Start with a letter; letters, numbers and underscores only');

export const claimableUsernameSchema = usernameSchema.refine(
  (value) => !value.startsWith(GUEST_USERNAME_PREFIX),
  { message: `Usernames cannot start with "${GUEST_USERNAME_PREFIX}" — that prefix is reserved` },
);

export const loginIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter your username or email')
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(200, 'At most 200 characters');
