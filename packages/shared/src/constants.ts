export const PLAYERS_PER_TEAM = 11;

export const BALLS_PER_OVER = 6;

export const DEFAULT_OVERS_PER_INNINGS = 20;

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 32;

export const MIN_PLAYERS_PER_TEAM = 5;
export const MAX_PLAYERS_PER_TEAM = 11;

export const MAX_FOOTBALL_SQUAD = 30;

export const DEFAULT_PERIODS = 2;
export const DEFAULT_PERIOD_MINUTES = 45;

export const MIN_PERIODS = 1;
export const MAX_PERIODS = 4;
export const MIN_PERIOD_MINUTES = 1;
export const MAX_PERIOD_MINUTES = 60;

/** How many changes a side is allowed. `null` is futsal's rolling, unlimited bench. */
export const SUBSTITUTION_LIMIT_OPTIONS: Array<number | null> = [3, 5, null];

export const MAX_SUBSTITUTION_LIMIT = MAX_FOOTBALL_SQUAD;

export const FOOTBALL_POINTS_WIN = 3;
export const FOOTBALL_POINTS_DRAW = 1;
export const FOOTBALL_POINTS_LOSS = 0;

export const CLOCK_TICK_MS = 200;
