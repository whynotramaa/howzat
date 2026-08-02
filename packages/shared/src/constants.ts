/**
 * Exactly this many players make a playing XI. The brief makes this
 * non-negotiable: a team is not eligible for a fixture until it has 11.
 */
export const PLAYERS_PER_TEAM = 11;

/** Balls in a completed over. Overs are base-6, never decimal. */
export const BALLS_PER_OVER = 6;

/** Default overs per innings for a T20-style local tournament. */
export const DEFAULT_OVERS_PER_INNINGS = 20;

/** Bounds for tournament sizing, enforced by schema and by the DB. */
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 32;

/**
 * Squad size is fixed at eleven for cricket and chosen by the organizer for
 * football, because five, seven and eleven a side are all played on the same
 * municipal pitch on the same Sunday.
 */
export const MIN_PLAYERS_PER_TEAM = 5;
export const MAX_PLAYERS_PER_TEAM = 11;

/**
 * How large a football squad may be, regardless of how many take the field.
 *
 * Cricket has no equivalent: a squad *is* the eleven who play, which is why the
 * eligibility gate is an equality there and a ceiling here. In football the
 * squad and the starting side are simply different numbers — a five-a-side team
 * turns up with twelve and rolls substitutes all evening — so the squad list is
 * a register of who is available, and the team sheet is where the five who
 * start get picked out of it.
 *
 * The number is a sanity bound rather than a rule: it exists so a paste of the
 * wrong column of a spreadsheet fails loudly instead of creating four hundred
 * players.
 */
export const MAX_FOOTBALL_SQUAD = 30;

// ─────────────────────────────────────────────────────────── football ──

/** Two halves of forty-five. Everything else is a variation on this. */
export const DEFAULT_PERIODS = 2;
export const DEFAULT_PERIOD_MINUTES = 45;

export const MIN_PERIODS = 1;
export const MAX_PERIODS = 4;
export const MIN_PERIOD_MINUTES = 1;
export const MAX_PERIOD_MINUTES = 60;

/** Three points for a win — the modern convention, everywhere. */
export const FOOTBALL_POINTS_WIN = 3;
export const FOOTBALL_POINTS_DRAW = 1;
export const FOOTBALL_POINTS_LOSS = 0;

/**
 * How often the console and the scoreboard redraw a running clock. Fast enough
 * that seconds never appear to skip, slow enough to be free — the clock is
 * interpolated locally from a server instant, so this is a repaint interval and
 * not a poll.
 */
export const CLOCK_TICK_MS = 200;
