/**
 * These mirror the Prisma enums exactly. They live here (rather than being
 * imported from @prisma/client) so the web app can use them without pulling
 * the Prisma runtime into the browser bundle.
 */

export const TOURNAMENT_FORMATS = ['LEAGUE', 'KNOCKOUT', 'LEAGUE_PLAYOFFS'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_STATUSES = [
  'DRAFT',
  'FIXTURES_GENERATED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const PLAYER_ROLES = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'KEEPER'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const MATCH_STAGES = ['LEAGUE', 'Q1', 'ELIMINATOR', 'Q2', 'FINAL'] as const;
export type MatchStage = (typeof MATCH_STAGES)[number];

export const MATCH_STATUSES = [
  'SCHEDULED',
  'TOSS',
  'LIVE',
  'INNINGS_BREAK',
  'COMPLETED',
  'ABANDONED',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const TOSS_DECISIONS = ['BAT', 'BOWL'] as const;
export type TossDecision = (typeof TOSS_DECISIONS)[number];

export const INNINGS_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;
export type InningsStatus = (typeof INNINGS_STATUSES)[number];

export const INNINGS_END_REASONS = ['ALL_OUT', 'OVERS_COMPLETE', 'TARGET_CHASED'] as const;
export type InningsEndReason = (typeof INNINGS_END_REASONS)[number];

export const BALL_EVENT_TYPES = ['BALL', 'CORRECTION', 'UNDO'] as const;
export type BallEventType = (typeof BALL_EVENT_TYPES)[number];

export const EXTRA_TYPES = ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'] as const;
export type ExtraType = (typeof EXTRA_TYPES)[number];

export const WICKET_TYPES = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'RUN_OUT',
  'STUMPED',
  'HIT_WICKET',
  'RETIRED_HURT',
  'OBSTRUCTING_FIELD',
] as const;
export type WicketType = (typeof WICKET_TYPES)[number];

export const NOTIFICATION_TYPES = ['SQUAD_ADDED', 'SCORER_ASSIGNED'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Player roles that count as wicketkeepers for XI validation. */
export const KEEPER_ROLES: readonly PlayerRole[] = ['KEEPER'];
