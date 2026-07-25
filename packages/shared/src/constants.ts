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
