import {
  FOOTBALL_POINTS_DRAW,
  FOOTBALL_POINTS_LOSS,
  FOOTBALL_POINTS_WIN,
} from '../constants';

/**
 * The football league table. Pure, for the same reason the NRR module is:
 * it takes finished matches and returns rows, so the whole thing is testable
 * without a database and recomputed from scratch rather than incremented.
 *
 * Ordering is the near-universal one — points, then goal difference, then goals
 * scored, then head-to-head, then name. Goal difference sits above goals scored
 * because a 4-3 win and a 1-0 win are worth the same, and a table that ranked
 * the shootout higher would be rewarding a leaky defence.
 */

export interface FootballMatchResult {
  matchId: string;
  teamIds: [string, string];
  /** Goals in the same order as `teamIds`. */
  goals: [number, number];
  /** Null for a draw, and for an abandoned match (which is also noResult). */
  winnerTeamId: string | null;
  noResult: boolean;
}

export interface FootballTeamTotals {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

function emptyTotals(teamId: string): FootballTeamTotals {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

export function aggregateFootballStandings(
  teamIds: string[],
  matches: FootballMatchResult[],
): FootballTeamTotals[] {
  const totals = new Map(teamIds.map((id) => [id, emptyTotals(id)]));

  for (const match of matches) {
    const [teamA, teamB] = match.teamIds;
    const rowA = totals.get(teamA);
    const rowB = totals.get(teamB);

    // A match involving a team outside this tournament is not ours to count.
    if (!rowA || !rowB) continue;

    // An abandoned match counts for nothing at all — no appearance, no goals.
    // Cricket awards a point for a washout because a scheduled fifty overs
    // cannot be replayed next Sunday; a football fixture simply is.
    if (match.noResult) continue;

    const [goalsA, goalsB] = match.goals;

    rowA.played += 1;
    rowB.played += 1;

    rowA.goalsFor += goalsA;
    rowA.goalsAgainst += goalsB;
    rowB.goalsFor += goalsB;
    rowB.goalsAgainst += goalsA;

    if (match.winnerTeamId === null) {
      rowA.drawn += 1;
      rowB.drawn += 1;
      rowA.points += FOOTBALL_POINTS_DRAW;
      rowB.points += FOOTBALL_POINTS_DRAW;
    } else {
      const winner = match.winnerTeamId === teamA ? rowA : rowB;
      const loser = match.winnerTeamId === teamA ? rowB : rowA;

      winner.won += 1;
      winner.points += FOOTBALL_POINTS_WIN;
      loser.lost += 1;
      loser.points += FOOTBALL_POINTS_LOSS;
    }
  }

  for (const row of totals.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return [...totals.values()];
}

/**
 * Points, goal difference, goals scored, head-to-head, name. Head-to-head is
 * only consulted between exactly two level teams — with three or more the
 * mini-table is ambiguous, so it is skipped rather than guessed at, the same
 * call the cricket table makes.
 */
export function sortFootballStandings(
  rows: FootballTeamTotals[],
  matches: FootballMatchResult[],
  teamName: (teamId: string) => string = (id) => id,
): FootballTeamTotals[] {
  const levelGroups = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.points}:${row.goalDifference}:${row.goalsFor}`;
    levelGroups.set(key, (levelGroups.get(key) ?? 0) + 1);
  }

  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    const key = `${a.points}:${a.goalDifference}:${a.goalsFor}`;
    if (levelGroups.get(key) === 2) {
      const decided = footballHeadToHead(a.teamId, b.teamId, matches);
      if (decided !== 0) return decided;
    }

    return teamName(a.teamId).localeCompare(teamName(b.teamId));
  });
}

/** Negative when `a` ranks ahead of `b`, positive when behind, 0 when level. */
export function footballHeadToHead(
  a: string,
  b: string,
  matches: FootballMatchResult[],
): number {
  let aWins = 0;
  let bWins = 0;

  for (const match of matches) {
    if (match.noResult) continue;
    if (!match.teamIds.includes(a) || !match.teamIds.includes(b)) continue;

    if (match.winnerTeamId === a) aWins += 1;
    else if (match.winnerTeamId === b) bWins += 1;
  }

  return bWins - aWins;
}

/** "+7", "0", "−3" — signed, with a true minus sign rather than a hyphen. */
export function formatGoalDifference(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}
