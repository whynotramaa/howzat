import {
  materializeFootballEvents,
  round2,
  type FootballPlayerStatsDto,
  type FootballTournamentStatsDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';

export async function getFootballTournamentStats(
  tournamentId: string,
): Promise<FootballTournamentStatsDto> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ['LIVE', 'INNINGS_BREAK', 'COMPLETED'] } },
    select: {
      id: true,
      footballEvents: { orderBy: { seq: 'asc' } },
      team1Id: true,
      team2Id: true,
      matchPlayers: {
        select: {
          playerId: true,
          teamId: true,
          lineupSlot: true,
          player: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: { id: true, name: true, shortName: true, primaryColor: true },
  });
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  interface Row {
    playerId: string;
    playerName: string;
    username: string;
    teamId: string;
    matches: number;
    goals: number;
    assists: number;
    ownGoals: number;
    saves: number;
    yellowCards: number;
    redCards: number;
    goalsConceded: number;
    cleanSheets: number;
    keptGoal: number;
  }

  const rows = new Map<string, Row>();

  const totals = {
    goals: 0,
    ownGoals: 0,
    saves: 0,
    yellowCards: 0,
    redCards: 0,
    matchesPlayed: matches.length,
    goalsPerMatch: null as number | null,
  };

  for (const match of matches) {
    for (const entry of match.matchPlayers) {
      const existing = rows.get(entry.playerId);

      if (existing) {
        existing.matches += 1;
        continue;
      }

      rows.set(entry.playerId, {
        playerId: entry.playerId,
        playerName: entry.player.name,
        username: entry.player.username,
        teamId: entry.teamId,
        matches: 1,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        goalsConceded: 0,
        cleanSheets: 0,
        keptGoal: 0,
      });
    }

    const conceded = { [match.team1Id ?? '']: 0, [match.team2Id ?? '']: 0 };

    for (const event of materializeFootballEvents(
      match.footballEvents.map((event) => ({
        ...event,
        matchId: match.id,
        createdAt: event.createdAt.toISOString(),
      })),
    )) {
      switch (event.kind) {
        case 'GOAL':
          totals.goals += 1;
          conceded[event.teamId] = (conceded[event.teamId] ?? 0) + 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.goals += 1));
          if (event.assistPlayerId) {
            bump(rows, event.assistPlayerId, (row) => (row.assists += 1));
          }
          break;

        case 'OWN_GOAL':
          totals.goals += 1;
          totals.ownGoals += 1;
          conceded[event.teamId] = (conceded[event.teamId] ?? 0) + 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.ownGoals += 1));
          break;

        case 'SAVE':
          totals.saves += 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.saves += 1));
          break;

        case 'YELLOW_CARD':
          totals.yellowCards += 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.yellowCards += 1));
          break;

        case 'RED_CARD':
          totals.redCards += 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.redCards += 1));
          break;
      }
    }

    for (const entry of match.matchPlayers) {
      if (entry.lineupSlot !== 0) continue;

      const against =
        (entry.teamId === match.team1Id
          ? conceded[match.team2Id ?? '']
          : conceded[match.team1Id ?? '']) ?? 0;

      bump(rows, entry.playerId, (row) => {
        row.keptGoal += 1;
        row.goalsConceded += against;
        if (against === 0) row.cleanSheets += 1;
      });
    }
  }

  totals.goalsPerMatch =
    totals.matchesPlayed > 0 ? round2(totals.goals / totals.matchesPlayed) : null;

  const players: FootballPlayerStatsDto[] = [...rows.values()]
    .map((row) => {
      const team = teamsById.get(row.teamId);

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        username: row.username,
        team: {
          id: row.teamId,
          name: team?.name ?? 'Unknown side',
          shortName: team?.shortName ?? '—',
          primaryColor: team?.primaryColor ?? '#64748b',
        },
        matches: row.matches,
        goals: row.goals,
        assists: row.assists,
        ownGoals: row.ownGoals,
        saves: row.saves,
        goalsConceded: row.goalsConceded,
        cleanSheets: row.cleanSheets,
        isGoalkeeper: row.keptGoal > 0,
        yellowCards: row.yellowCards,
        redCards: row.redCards,
        goalsPerMatch: row.matches > 0 ? round2(row.goals / row.matches) : null,
        disciplinePoints: row.yellowCards + row.redCards * 3,
      } satisfies FootballPlayerStatsDto;
    })
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.matches - b.matches ||
        a.playerName.localeCompare(b.playerName),
    );

  return {
    sport: 'FOOTBALL',
    tournamentId,
    players,
    goldenBoot: best(players, (player) => player.goals),
    playmaker: best(players, (player) => player.assists),
    mostBooked: best(players, (player) => player.disciplinePoints),
    goldenGlove: bestKeeper(players),
    totals,
  };
}

function bump<T>(rows: Map<string, T>, playerId: string, apply: (row: T) => void): void {
  const row = rows.get(playerId);
  if (row) apply(row);
}

function bestKeeper(players: FootballPlayerStatsDto[]): FootballPlayerStatsDto | null {
  const keepers = players.filter((player) => player.isGoalkeeper);
  if (keepers.length === 0) return null;

  return keepers.reduce((leader, player) => {
    if (player.cleanSheets !== leader.cleanSheets) {
      return player.cleanSheets > leader.cleanSheets ? player : leader;
    }
    return player.goalsConceded < leader.goalsConceded ? player : leader;
  });
}

function best(
  players: FootballPlayerStatsDto[],
  measure: (player: FootballPlayerStatsDto) => number,
): FootballPlayerStatsDto | null {
  return players.reduce<FootballPlayerStatsDto | null>(
    (leader, player) =>
      measure(player) > 0 && (!leader || measure(player) > measure(leader)) ? player : leader,
    null,
  );
}
