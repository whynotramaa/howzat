import { z } from 'zod';
import { idSchema } from './common';
import { CLOCK_COMMANDS, FOOTBALL_EVENT_KINDS } from '../types/enums';
import {
  MAX_PERIODS,
  MAX_PERIOD_MINUTES,
  MAX_FOOTBALL_SQUAD,
  MAX_PLAYERS_PER_TEAM,
  MAX_SUBSTITUTION_LIMIT,
  MIN_PERIODS,
  MIN_PERIOD_MINUTES,
} from '../constants';

/** A cap on changes per side, or `null` for futsal's rolling, unlimited bench. */
const substitutionLimitSchema = z.number().int().min(1).max(MAX_SUBSTITUTION_LIMIT).nullable();

const lineupEntrySchema = z.object({
  playerId: idSchema,
  slot: z
    .number()
    .int()
    .min(0)
    .max(MAX_PLAYERS_PER_TEAM - 1),
  shirtNumber: z.number().int().min(1).max(99).nullable().default(null),
  isCaptain: z.boolean().default(false),
});

export const footballLineupSchema = z.object({
  teams: z
    .array(
      z
        .object({
          teamId: idSchema,
          formation: z
            .string()
            .trim()
            .regex(/^\d+(-\d+){1,3}$/, 'A formation looks like 4-4-2'),
          players: z
            .array(lineupEntrySchema)
            .min(1)
            .max(MAX_PLAYERS_PER_TEAM)
            .refine(
              (players) => new Set(players.map((p) => p.playerId)).size === players.length,
              'A player cannot appear twice in the lineup',
            )
            .refine(
              (players) => new Set(players.map((p) => p.slot)).size === players.length,
              'Two players cannot occupy the same position',
            )
            .refine(
              (players) => players.filter((p) => p.isCaptain).length <= 1,
              'A side cannot have two captains',
            ),
          substitutes: z
            .array(idSchema)
            .max(MAX_FOOTBALL_SQUAD)
            .default([])
            .refine((ids) => new Set(ids).size === ids.length, 'A player cannot be named twice'),
        })
        .refine(
          (team) => !team.players.some((player) => team.substitutes.includes(player.playerId)),
          {
            message: 'A player cannot start and be a substitute',
            path: ['substitutes'],
          },
        ),
    )
    .length(2, 'Both sides must be named'),
});
export type FootballLineupInput = z.infer<typeof footballLineupSchema>;

export const kickOffSchema = z.object({
  periods: z.number().int().min(MIN_PERIODS).max(MAX_PERIODS).optional(),
  periodMinutes: z.number().int().min(MIN_PERIOD_MINUTES).max(MAX_PERIOD_MINUTES).optional(),
  substitutionLimit: substitutionLimitSchema.optional(),
});
export type KickOffInput = z.infer<typeof kickOffSchema>;

export const footballEventSchema = z
  .object({
    clientEventId: z.string().uuid('clientEventId must be a UUID'),
    kind: z.enum(FOOTBALL_EVENT_KINDS),
    teamId: idSchema,
    playerId: idSchema.nullable().default(null),
    assistPlayerId: idSchema.nullable().default(null),
    playerOffId: idSchema.nullable().default(null),
  })
  .refine(
    (input) =>
      input.kind !== 'SUBSTITUTION' || (Boolean(input.playerId) && Boolean(input.playerOffId)),
    { message: 'Name both the player coming on and the player going off', path: ['playerOffId'] },
  )
  .refine((input) => !input.playerOffId || input.playerOffId !== input.playerId, {
    message: 'A player cannot replace themselves',
    path: ['playerOffId'],
  });
export type FootballEventRequestInput = z.infer<typeof footballEventSchema>;

export const footballUndoSchema = z.object({
  clientEventId: z.string().uuid(),
  targetEventId: idSchema.optional(),
});
export type FootballUndoInput = z.infer<typeof footballUndoSchema>;

export const clockCommandSchema = z.object({
  command: z.enum(CLOCK_COMMANDS),
});
export type ClockCommandInput = z.infer<typeof clockCommandSchema>;
