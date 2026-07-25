import { z } from 'zod';
import { nameSchema } from './common';
import { TOURNAMENT_FORMATS } from '../types/enums';
import { DEFAULT_OVERS_PER_INNINGS, MAX_TEAMS, MIN_TEAMS } from '../constants';

export const createTournamentSchema = z.object({
  name: nameSchema,
  format: z.enum(TOURNAMENT_FORMATS).default('LEAGUE'),
  teamsCount: z.number().int().min(MIN_TEAMS).max(MAX_TEAMS),
  oversPerInnings: z.number().int().min(1).max(50).default(DEFAULT_OVERS_PER_INNINGS),
  doubleRoundRobin: z.boolean().default(false),
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

/**
 * teamsCount is intentionally updatable while the tournament is DRAFT — an
 * organizer often finds out on registration day that a team dropped out.
 * The API refuses to shrink it below the number of teams already created.
 */
export const updateTournamentSchema = createTournamentSchema.partial();
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
