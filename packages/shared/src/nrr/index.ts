import { BALLS_PER_OVER } from '../constants';
import type { InningsEndReason } from '../types/enums';
import { ballsToOvers, round2 } from '../scoring/format';

/**
 * Points table and Net Run Rate. Pure — it takes finished innings and returns
 * rows, so the whole thing is testable without a database.
 *
 *   NRR = (runs scored / overs faced) − (runs conceded / overs bowled)
 *
 * aggregated across the tournament, not averaged per match. The two traps:
 *
 *   1. **The bowled-out rule.** A side dismissed inside its quota is charged
 *      the FULL quota of overs, not the balls it actually faced. Skipping this
 *      flatters a team that collapsed and is the single most common NRR bug.
 *   2. **Overs are base-6.** 98 balls is 16.333… overs, never 16.5 and never
 *      "16.2" fed into arithmetic. Everything here is stored and summed in
 *      balls, and converted only at the end.
 */

export const POINTS_WIN = 2;
export const POINTS_TIE = 1;
export const POINTS_NO_RESULT = 1;
export const POINTS_LOSS = 0;

export interface InningsResult {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  /** Legal deliveries actually bowled in the innings. */
  legalBalls: number;
  oversQuota: number;
  endReason: InningsEndReason | null;
}

export interface MatchResult {
  matchId: string;
  teamIds: [string, string];
  innings: InningsResult[];
  /** Null for a tie, or for an abandoned match (which is also noResult). */
  winnerTeamId: string | null;
  noResult: boolean;
}

export interface TeamTotals {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  ballsFaced: number;
  runsConceded: number;
  ballsBowled: number;
  nrr: number;
}

/**
 * The rule, isolated so it is impossible to apply inconsistently: a side that
 * is all out is charged its full quota; a side that chases successfully is
 * charged only the balls it used.
 */
export function chargeableBalls(innings: InningsResult): number {
  if (innings.endReason === 'ALL_OUT') {
    return innings.oversQuota * BALLS_PER_OVER;
  }

  // A completed chase, or an innings that ran out of overs, counts what it
  // actually faced. (For OVERS_COMPLETE the two are the same number anyway.)
  return innings.legalBalls;
}

function emptyTotals(teamId: string): TeamTotals {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsScored: 0,
    ballsFaced: 0,
    runsConceded: 0,
    ballsBowled: 0,
    nrr: 0,
  };
}

/**
 * Folds every completed match into per-team totals. Recomputed from scratch on
 * each match completion rather than incremented, so it is idempotent and
 * self-healing: a bad write cannot accumulate.
 */
export function aggregateStandings(teamIds: string[], matches: MatchResult[]): TeamTotals[] {
  const totals = new Map(teamIds.map((id) => [id, emptyTotals(id)]));

  for (const match of matches) {
    const [teamA, teamB] = match.teamIds;
    const rowA = totals.get(teamA);
    const rowB = totals.get(teamB);

    // A match involving a team outside this tournament is not ours to count.
    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;

    if (match.noResult) {
      rowA.noResult += 1;
      rowB.noResult += 1;
      rowA.points += POINTS_NO_RESULT;
      rowB.points += POINTS_NO_RESULT;
      // An abandoned match contributes nothing to NRR — there is no
      // meaningful run rate in an innings that never finished.
      continue;
    }

    if (match.winnerTeamId === null) {
      rowA.tied += 1;
      rowB.tied += 1;
      rowA.points += POINTS_TIE;
      rowB.points += POINTS_TIE;
    } else {
      const winner = match.winnerTeamId === teamA ? rowA : rowB;
      const loser = match.winnerTeamId === teamA ? rowB : rowA;

      winner.won += 1;
      winner.points += POINTS_WIN;
      loser.lost += 1;
      loser.points += POINTS_LOSS;
    }

    for (const innings of match.innings) {
      const batting = totals.get(innings.battingTeamId);
      const bowling = totals.get(innings.bowlingTeamId);
      if (!batting || !bowling) continue;

      const balls = chargeableBalls(innings);

      batting.runsScored += innings.runs;
      batting.ballsFaced += balls;

      // Symmetric by construction: what one side faced, the other bowled.
      bowling.runsConceded += innings.runs;
      bowling.ballsBowled += balls;
    }
  }

  for (const row of totals.values()) {
    row.nrr = netRunRate(row);
  }

  return [...totals.values()];
}

export function netRunRate(totals: {
  runsScored: number;
  ballsFaced: number;
  runsConceded: number;
  ballsBowled: number;
}): number {
  const scoringRate =
    totals.ballsFaced > 0 ? totals.runsScored / ballsToOvers(totals.ballsFaced) : 0;

  const concedingRate =
    totals.ballsBowled > 0 ? totals.runsConceded / ballsToOvers(totals.ballsBowled) : 0;

  // Three decimals is the conventional precision; rounding later would let
  // presentation drift from the stored value.
  return Math.round((scoringRate - concedingRate) * 1000) / 1000;
}

/**
 * Points, then NRR, then head-to-head, then name — in that order. Head-to-head
 * only makes sense between exactly two tied teams; with three or more the
 * mini-table is ambiguous, so it is skipped rather than guessed at.
 */
export function sortStandings(
  rows: TeamTotals[],
  matches: MatchResult[],
  teamName: (teamId: string) => string = (id) => id,
): TeamTotals[] {
  const tiedGroups = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.points}:${row.nrr}`;
    tiedGroups.set(key, (tiedGroups.get(key) ?? 0) + 1);
  }

  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;

    const key = `${a.points}:${a.nrr}`;
    if (tiedGroups.get(key) === 2) {
      const decided = headToHead(a.teamId, b.teamId, matches);
      if (decided !== 0) return decided;
    }

    return teamName(a.teamId).localeCompare(teamName(b.teamId));
  });
}

/** Negative when `a` ranks ahead of `b`, positive when behind, 0 when level. */
export function headToHead(a: string, b: string, matches: MatchResult[]): number {
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

/** Display form of the overs behind an NRR figure: 98 balls → "16.2". */
export function ballsAsOversText(balls: number): string {
  const completed = Math.floor(balls / BALLS_PER_OVER);
  return `${completed}.${balls % BALLS_PER_OVER}`;
}

export { round2 };
