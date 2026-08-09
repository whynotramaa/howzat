export const BYE = '__BYE__';

export interface Pairing {
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

      matches.push(
        round % 2 === 0
          ? { homeTeamId: home, awayTeamId: away }
          : { homeTeamId: away, awayTeamId: home },
      );
    }

    rounds.push({ round: round + 1, matches });

    const [fixed, ...rest] = rotation;
    const last = rest.pop()!;
    rotation = [fixed!, last, ...rest];
  }

  if (!options.double) return rounds;

  const reverse: Round[] = rounds.map((entry, index) => ({
    round: roundCount + index + 1,
    matches: entry.matches.map((match) => ({
      homeTeamId: match.awayTeamId,
      awayTeamId: match.homeTeamId,
    })),
  }));

  return [...rounds, ...reverse];
}

export function roundRobinMatchCount(teamCount: number, double: boolean): number {
  if (teamCount < 2) return 0;
  const single = (teamCount * (teamCount - 1)) / 2;
  return double ? single * 2 : single;
}
