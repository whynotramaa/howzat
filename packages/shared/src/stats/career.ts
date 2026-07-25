import type { CareerStatsDto } from '../types/domain';
import { formatOvers, round2 } from '../scoring/format';

/**
 * Career totals from per-match rows.
 *
 * Pure, and deliberately so: this is the arithmetic people argue about in a
 * WhatsApp group after a match, so it needs to be testable without a database
 * in the way. The API's job is to hand it rows; every rule about what counts
 * as an innings or a not-out lives here.
 */

export interface CareerInput {
  batted: boolean;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  bowled: boolean;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

export function aggregateCareer(rows: readonly CareerInput[]): CareerStatsDto {
  const batting = {
    innings: 0,
    runs: 0,
    ballsFaced: 0,
    notOuts: 0,
    highScore: 0,
    highScoreNotOut: false,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
  };

  const bowling = {
    innings: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    fiveWicketHauls: 0,
  };

  const fielding = { catches: 0, runOuts: 0, stumpings: 0 };

  let best: { wickets: number; runs: number } | null = null;

  for (const row of rows) {
    if (row.batted) {
      batting.innings += 1;
      batting.runs += row.runs;
      batting.ballsFaced += row.ballsFaced;
      batting.fours += row.fours;
      batting.sixes += row.sixes;
      if (!row.isOut) batting.notOuts += 1;

      // A hundred is not also counted as a fifty — the convention every
      // scorecard uses, and the one people expect to see on a profile.
      if (row.runs >= 100) batting.hundreds += 1;
      else if (row.runs >= 50) batting.fifties += 1;

      // A duck requires being dismissed for nought; 0 not out is not a duck.
      if (row.runs === 0 && row.isOut) batting.ducks += 1;

      // Ties on runs go to the unbeaten innings: 84* is the better knock.
      if (
        row.runs > batting.highScore ||
        (row.runs === batting.highScore && !row.isOut && !batting.highScoreNotOut)
      ) {
        batting.highScore = row.runs;
        batting.highScoreNotOut = !row.isOut;
      }
    }

    if (row.bowled) {
      bowling.innings += 1;
      bowling.ballsBowled += row.ballsBowled;
      bowling.runsConceded += row.runsConceded;
      bowling.wickets += row.wickets;
      bowling.maidens += row.maidens;
      if (row.wickets >= 5) bowling.fiveWicketHauls += 1;

      // More wickets wins; on equal wickets, fewer runs wins.
      if (
        !best ||
        row.wickets > best.wickets ||
        (row.wickets === best.wickets && row.runsConceded < best.runs)
      ) {
        best = { wickets: row.wickets, runs: row.runsConceded };
      }
    }

    fielding.catches += row.catches;
    fielding.runOuts += row.runOuts;
    fielding.stumpings += row.stumpings;
  }

  const dismissals = batting.innings - batting.notOuts;

  return {
    matches: rows.length,
    batting: {
      ...batting,
      // Null, not zero: "never been dismissed" is not an average of 0.
      average: dismissals > 0 ? round2(batting.runs / dismissals) : null,
      strikeRate:
        batting.ballsFaced > 0 ? round2((batting.runs / batting.ballsFaced) * 100) : null,
    },
    bowling: {
      ...bowling,
      oversBowled: formatOvers(bowling.ballsBowled),
      average: bowling.wickets > 0 ? round2(bowling.runsConceded / bowling.wickets) : null,
      economy:
        bowling.ballsBowled > 0
          ? round2(bowling.runsConceded / (bowling.ballsBowled / 6))
          : null,
      strikeRate: bowling.wickets > 0 ? round2(bowling.ballsBowled / bowling.wickets) : null,
      bestFigures: best ? `${best.wickets}/${best.runs}` : null,
    },
    fielding: { ...fielding, dismissals: fielding.catches + fielding.runOuts + fielding.stumpings },
  };
}
