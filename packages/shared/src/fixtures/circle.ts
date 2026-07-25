/**
 * Round-robin fixture generation by the circle method.
 *
 * Deterministic, O(n²), and it always succeeds — there is no constraint to
 * satisfy and therefore nothing to backtrack over. Dates and venues are not
 * assigned here and never will be: the brief puts venue-clash logic explicitly
 * out of scope, and fixtures must not depend on the calendar.
 */

export const BYE = '__BYE__';

export interface Pairing {
  /** Nominal home side — the flip on the reverse leg is what "away" means. */
  homeTeamId: string;
  awayTeamId: string;
}

export interface Round {
  round: number;
  matches: Pairing[];
}

export interface RoundRobinOptions {
  double: boolean;
}

/**
 * Fix the first team, rotate the rest one position each round. With n teams
 * that yields n-1 rounds of n/2 matches, every pair meeting exactly once.
 * An odd n gets a BYE sentinel appended, and the pairing against it is dropped
 * — that team simply sits out the round.
 */
export function generateRoundRobin(
  teamIds: string[],
  options: RoundRobinOptions = { double: false },
): Round[] {
  const unique = [...new Set(teamIds)];

  if (unique.length !== teamIds.length) {
    throw new Error('generateRoundRobin: duplicate team ids');
  }

  if (unique.length < 2) return [];

  const entrants = unique.length % 2 === 0 ? [...unique] : [...unique, BYE];
  const roundCount = entrants.length - 1;
  const half = entrants.length / 2;

  const rounds: Round[] = [];
  let rotation = [...entrants];

  for (let round = 0; round < roundCount; round += 1) {
    const matches: Pairing[] = [];

    for (let slot = 0; slot < half; slot += 1) {
      const home = rotation[slot]!;
      const away = rotation[rotation.length - 1 - slot]!;

      if (home === BYE || away === BYE) continue;

      // Alternating the nominal home side by round stops the fixed team from
      // being "home" in every single one of its matches.
      matches.push(
        round % 2 === 0
          ? { homeTeamId: home, awayTeamId: away }
          : { homeTeamId: away, awayTeamId: home },
      );
    }

    rounds.push({ round: round + 1, matches });

    // Team 0 stays put; everyone else shifts one place clockwise.
    const [fixed, ...rest] = rotation;
    const last = rest.pop()!;
    rotation = [fixed!, last, ...rest];
  }

  if (!options.double) return rounds;

  // The reverse leg is the same schedule with home and away swapped.
  const reverse: Round[] = rounds.map((entry, index) => ({
    round: roundCount + index + 1,
    matches: entry.matches.map((match) => ({
      homeTeamId: match.awayTeamId,
      awayTeamId: match.homeTeamId,
    })),
  }));

  return [...rounds, ...reverse];
}

/** Total matches a round-robin will produce — useful for a preview count. */
export function roundRobinMatchCount(teamCount: number, double: boolean): number {
  if (teamCount < 2) return 0;
  const single = (teamCount * (teamCount - 1)) / 2;
  return double ? single * 2 : single;
}
