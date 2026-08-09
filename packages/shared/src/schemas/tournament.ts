import { z } from 'zod';
import { nameSchema } from './common';
import { SPORTS, TOURNAMENT_FORMATS } from '../types/enums';
import {
  DEFAULT_OVERS_PER_INNINGS,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_MINUTES,
  MAX_PERIODS,
  MAX_PERIOD_MINUTES,
  MAX_PLAYERS_PER_TEAM,
  MAX_TEAMS,
  MIN_PERIODS,
  MIN_PERIOD_MINUTES,
  MIN_PLAYERS_PER_TEAM,
  MIN_TEAMS,
  PLAYERS_PER_TEAM,
} from '../constants';

export const createTournamentSchema = z
  .object({
    name: nameSchema,
    sport: z.enum(SPORTS).default('CRICKET'),
    format: z.enum(TOURNAMENT_FORMATS).default('LEAGUE'),
    teamsCount: z.number().int().min(MIN_TEAMS).max(MAX_TEAMS),
    playersPerTeam: z
      .number()
      .int()
      .min(MIN_PLAYERS_PER_TEAM)
      .max(MAX_PLAYERS_PER_TEAM)
      .default(PLAYERS_PER_TEAM),
    oversPerInnings: z.number().int().min(1).max(50).default(DEFAULT_OVERS_PER_INNINGS),
    doubleRoundRobin: z.boolean().default(false),
    periods: z.number().int().min(MIN_PERIODS).max(MAX_PERIODS).default(DEFAULT_PERIODS),
    periodMinutes: z
      .number()
      .int()
      .min(MIN_PERIOD_MINUTES)
      .max(MAX_PERIOD_MINUTES)
      .default(DEFAULT_PERIOD_MINUTES),
  })
  .refine((input) => input.sport !== 'CRICKET' || input.playersPerTeam === PLAYERS_PER_TEAM, {
    message: `A cricket side is exactly ${PLAYERS_PER_TEAM} players`,
    path: ['playersPerTeam'],
  });
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z.object({
  name: nameSchema.optional(),
  format: z.enum(TOURNAMENT_FORMATS).optional(),
  teamsCount: z.number().int().min(MIN_TEAMS).max(MAX_TEAMS).optional(),
  playersPerTeam: z.number().int().min(MIN_PLAYERS_PER_TEAM).max(MAX_PLAYERS_PER_TEAM).optional(),
  oversPerInnings: z.number().int().min(1).max(50).optional(),
  doubleRoundRobin: z.boolean().optional(),
  periods: z.number().int().min(MIN_PERIODS).max(MAX_PERIODS).optional(),
  periodMinutes: z.number().int().min(MIN_PERIOD_MINUTES).max(MAX_PERIOD_MINUTES).optional(),
});
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
