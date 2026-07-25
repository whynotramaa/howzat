import type { MatchStage } from '../types/enums';

/**
 * The IPL-style playoff bracket. Four teams, four matches, and the crucial
 * property that Q1's loser gets a second life in Q2.
 *
 * Slots are created with null teams and filled in as their feeders complete,
 * which is the only honest way to schedule a bracket before the league ends.
 */

export type SeedSource =
  | { kind: 'SEED'; position: 1 | 2 | 3 | 4 }
  | { kind: 'WINNER'; stage: MatchStage }
  | { kind: 'LOSER'; stage: MatchStage };

export interface BracketSlot {
  stage: MatchStage;
  /** Ordering within the playoff phase, continuing after the league rounds. */
  order: number;
  label: string;
  home: SeedSource;
  away: SeedSource;
}

export const PLAYOFF_BRACKET: readonly BracketSlot[] = [
  {
    stage: 'Q1',
    order: 1,
    label: 'Qualifier 1',
    home: { kind: 'SEED', position: 1 },
    away: { kind: 'SEED', position: 2 },
  },
  {
    stage: 'ELIMINATOR',
    order: 2,
    label: 'Eliminator',
    home: { kind: 'SEED', position: 3 },
    away: { kind: 'SEED', position: 4 },
  },
  {
    stage: 'Q2',
    order: 3,
    label: 'Qualifier 2',
    home: { kind: 'LOSER', stage: 'Q1' },
    away: { kind: 'WINNER', stage: 'ELIMINATOR' },
  },
  {
    stage: 'FINAL',
    order: 4,
    label: 'Final',
    home: { kind: 'WINNER', stage: 'Q1' },
    away: { kind: 'WINNER', stage: 'Q2' },
  },
];

/** Playoffs need a top four; below that the bracket is meaningless. */
export const MIN_TEAMS_FOR_PLAYOFFS = 4;
