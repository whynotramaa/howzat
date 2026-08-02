import {
  materializeFootballEvents,
  round2,
  type FootballPlayerStatsDto,
  type FootballTournamentStatsDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';

/**
 * Football's tournament leaderboards.
 *
 * Unlike the cricket side, this is folded straight out of the event log at read
 * time rather than through a stored per-match projection. That is a deliberate
 * difference and not an inconsistency: PlayerMatchStats exists because a cricket
 * tournament is a quarter of a million ball events and folding them on every
 * page view would not be viable. A football tournament of the same size is a few
 * hundred goals and cards. Introducing a projection table here would buy nothing
 * and add a second place for the truth to live.
 *
 * What it keeps is the property that matters: the numbers are a function of the
 * log. An undone goal leaves the golden boot without anybody remembering to
 * decrement a counter.
 */

export async function getFootballTournamentStats(
  tournamentId: string,
): Promise<FootballTournamentStatsDto> {
  // Only finished matches count. A goal in a match still being played is on the
  // live scoreboard already, and letting it into the leaderboard would make the
  // table shuffle under an organizer reading it.
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: 'COMPLETED' },
    select: {
      id: true,
      footballEvents: { orderBy: { seq: 'asc' } },
      matchPlayers: {
        select: {
          playerId: true,
          teamId: true,
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
    yellowCards: number;
    redCards: number;
  }

  const rows = new Map<string, Row>();

  const totals = {
    goals: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
    matchesPlayed: matches.length,
    goalsPerMatch: null as number | null,
  };

  for (const match of matches) {
    // An appearance is being named on the team sheet of a match that finished.
    // Recorded before the events are read so a player who did nothing all game
    // still appears in the table — playing is itself a fact worth having.
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
        yellowCards: 0,
        redCards: 0,
      });
    }

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
          if (event.playerId) bump(rows, event.playerId, (row) => (row.goals += 1));
          if (event.assistPlayerId) {
            bump(rows, event.assistPlayerId, (row) => (row.assists += 1));
          }
          break;

        case 'OWN_GOAL':
          totals.goals += 1;
          totals.ownGoals += 1;
          if (event.playerId) bump(rows, event.playerId, (row) => (row.ownGoals += 1));
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
        yellowCards: row.yellowCards,
        redCards: row.redCards,
        goalsPerMatch: row.matches > 0 ? round2(row.goals / row.matches) : null,
        // A red is worth three yellows, the usual weighting, so one sending-off
        // outranks a pair of bookings.
        disciplinePoints: row.yellowCards + row.redCards * 3,
      } satisfies FootballPlayerStatsDto;
    })
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        // Fewer appearances for the same tally is the better record.
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
    totals,
  };
}

function bump<T>(rows: Map<string, T>, playerId: string, apply: (row: T) => void): void {
  const row = rows.get(playerId);
  // A player named in the log but not on any team sheet can only mean the sheet
  // was edited after the fact. Skipping is better than inventing a row with no
  // team and no appearances behind it.
  if (row) apply(row);
}

/**
 * The leader on one measure, or null when nobody has any of it. A zero-goal
 * "golden boot" is worse than an empty card — it names somebody for nothing.
 */
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
