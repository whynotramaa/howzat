import { z } from 'zod';
import { BALLS_PER_OVER } from '../constants';
import { DLS_TABLE_MAX_OVERS } from '../dls/table';

const MAX_BALLS = DLS_TABLE_MAX_OVERS * BALLS_PER_OVER;

/**
 * Overs are typed the way cricket says them — 12.3 is twelve overs and three
 * balls, not twelve and a third — so the part after the point is a ball count.
 * Returns null when it is not a legible over figure, which the form reports
 * rather than silently rounding away.
 */
export function parseOversToBalls(overs: string): number | null {
  const trimmed = overs.trim();
  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) return null;

  const [whole = '0', balls = '0'] = trimmed.split('.');
  const ballPart = Number(balls);

  if (ballPart >= BALLS_PER_OVER) return null;

  return Number(whole) * BALLS_PER_OVER + ballPart;
}

export const dlsSettingsSchema = z.object({
  applied: z.boolean().optional(),
  g50: z.number().int().min(50).max(400).optional(),
});
export type DlsSettingsInput = z.infer<typeof dlsSettingsSchema>;

export const dlsInterruptionSchema = z
  .object({
    inningsNumber: z.union([z.literal(1), z.literal(2)]),
    /** Balls still to be bowled in the innings when the players walked off. */
    ballsRemainingAtSuspension: z.number().int().min(0).max(MAX_BALLS),
    wicketsLost: z.number().int().min(0).max(9),
    /** Balls still to be bowled once play resumed. Zero closes the innings. */
    ballsRemainingOnResumption: z.number().int().min(0).max(MAX_BALLS),
    reason: z.string().trim().max(120).nullable().default(null),
  })
  .refine((input) => input.ballsRemainingOnResumption <= input.ballsRemainingAtSuspension, {
    message: 'Play cannot resume with more overs left than there were when it stopped',
    path: ['ballsRemainingOnResumption'],
  });
export type DlsInterruptionInput = z.infer<typeof dlsInterruptionSchema>;

export const dlsConcludeSchema = z.object({
  /**
   * Set when the scorer has already logged the stoppage that ended play. Left
   * false, the chase is closed where it stands and the par score is read off
   * the balls the side had actually faced.
   */
  confirm: z.boolean().default(true),
  reason: z.string().trim().max(120).optional(),
});
export type DlsConcludeInput = z.infer<typeof dlsConcludeSchema>;
