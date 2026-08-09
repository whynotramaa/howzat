import type { MatchStage } from '../types/enums';

export type SeedSource =
  | { kind: 'SEED'; position: 1 | 2 | 3 | 4 }
  | { kind: 'WINNER'; stage: MatchStage }
  | { kind: 'LOSER'; stage: MatchStage };

export interface BracketSlot {
  stage: MatchStage;
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

export const MIN_TEAMS_FOR_PLAYOFFS = 4;
