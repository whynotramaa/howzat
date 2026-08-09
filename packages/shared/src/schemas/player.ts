import { z } from 'zod';
import { claimableUsernameSchema, nameSchema } from './common';
import { PLAYER_ROLES } from '../types/enums';
import { MAX_FOOTBALL_SQUAD } from '../constants';

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

export const updatePlayerSchema = playerFields.omit({ username: true }).partial();
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export const bulkCreatePlayersSchema = z.object({
  players: z.array(createPlayerSchema).min(1).max(MAX_FOOTBALL_SQUAD),
});
export type BulkCreatePlayersInput = z.infer<typeof bulkCreatePlayersSchema>;
