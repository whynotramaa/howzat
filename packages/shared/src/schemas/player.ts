import { z } from 'zod';
import { claimableUsernameSchema, nameSchema } from './common';
import { PLAYER_ROLES } from '../types/enums';
import { MAX_FOOTBALL_SQUAD } from '../constants';

/**
 * A squad slot is added one of two ways, and the difference matters:
 *
 *   • by `username` — the player has a Howzat account, the organizer found
 *     them by handle, and everything they do in this tournament lands on their
 *     career profile.
 *   • by `name` — they don't, so the server mints a `guest_…` placeholder. The
 *     match can be scored either way; only the profile differs.
 *
 * Both fields are optional in the shape and the pairing is enforced by a
 * refinement, so the client can offer one search box and one text field
 * without having to model two request types.
 */
const playerFields = z.object({
  name: nameSchema.optional(),
  username: claimableUsernameSchema.optional(),
  role: z.enum(PLAYER_ROLES).default('BATSMAN'),
  battingStyle: z.string().trim().max(40).optional().nullable(),
  bowlingStyle: z.string().trim().max(40).optional().nullable(),
});

export const createPlayerSchema = playerFields.refine(
  (input) => Boolean(input.name?.trim() || input.username),
  { message: 'Give the player a name, or add them by their username', path: ['name'] },
);
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

/**
 * Renaming a slot is fine; re-pointing it at a different account is not — that
 * would silently move one person's match history onto another's profile. Drop
 * the player and add the right one instead.
 */
export const updatePlayerSchema = playerFields.omit({ username: true }).partial();
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

/**
 * Bulk add — the fastest path to a full squad. The organizer pastes the names,
 * one per line, rather than filling the same form eleven times.
 *
 * The cap is the largest squad any sport here allows, not the size of a
 * starting side: in football those are different numbers, and capping the paste
 * at the eleven who start would refuse the bench on the way in.
 */
export const bulkCreatePlayersSchema = z.object({
  players: z.array(createPlayerSchema).min(1).max(MAX_FOOTBALL_SQUAD),
});
export type BulkCreatePlayersInput = z.infer<typeof bulkCreatePlayersSchema>;
