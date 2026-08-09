import { BALLS_PER_OVER } from '../constants';
import type { InningsEndReason } from '../types/enums';
import { ballsToOvers, round2 } from '../scoring/format';

export const POINTS_WIN = 2;
export const POINTS_TIE = 1;
export const POINTS_NO_RESULT = 1;
export const POINTS_LOSS = 0;

export interface InningsResult {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  legalBalls: number;
  oversQuota: number;
  /** The allotment to the ball where DLS revised it. Falls back to the overs. */
  ballsQuota?: number | null;
  endReason: InningsEndReason | null;
}

export interface MatchResult {
  matchId: string;
  teamIds: [string, string];
  innings: InningsResult[];
  winnerTeamId: string | null;
  noResult: boolean;
  /** Set only where DLS decided the match — see `nrrInnings`. */
  dls?: { parScore: number } | null;
}

/**
 * The innings figures a DLS-decided match contributes to net run rate.
 *
 * Charging the side batting first with the runs it happened to make off the
 * overs it happened to face would punish it for a chase that never ran its
 * course, so the ICC substitutes the par score: the side batting first is
 * deemed to have scored par off the same overs the chasing side is charged
 * with. Par is by construction the score that ties over exactly those overs,
 * which is what makes the two rows comparable.
 *
 * Every other match is returned untouched.
 */
export function nrrInnings(match: MatchResult): InningsResult[] {
  const par = match.dls?.parScore;
  const [first, second] = match.innings;

  if (par === undefined || par === null || !first || !second) return match.innings;

  const balls = chargeableBalls(second);

  return [{ ...first, runs: par, legalBalls: balls, endReason: null }, second];
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

export function chargeableBalls(innings: InningsResult): number {
  if (innings.endReason === 'ALL_OUT') {
    return innings.ballsQuota ?? innings.oversQuota * BALLS_PER_OVER;
  }

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

export function aggregateStandings(teamIds: string[], matches: MatchResult[]): TeamTotals[] {
  const totals = new Map(teamIds.map((id) => [id, emptyTotals(id)]));

  for (const match of matches) {
    const [teamA, teamB] = match.teamIds;
    const rowA = totals.get(teamA);
    const rowB = totals.get(teamB);

    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;

    if (match.noResult) {
      rowA.noResult += 1;
      rowB.noResult += 1;
      rowA.points += POINTS_NO_RESULT;
      rowB.points += POINTS_NO_RESULT;
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

    for (const innings of nrrInnings(match)) {
      const batting = totals.get(innings.battingTeamId);
      const bowling = totals.get(innings.bowlingTeamId);
      if (!batting || !bowling) continue;

      const balls = chargeableBalls(innings);

      batting.runsScored += innings.runs;
      batting.ballsFaced += balls;

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

  return Math.round((scoringRate - concedingRate) * 1000) / 1000;
}

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

export function ballsAsOversText(balls: number): string {
  const completed = Math.floor(balls / BALLS_PER_OVER);
  return `${completed}.${balls % BALLS_PER_OVER}`;
}

export { round2 };
