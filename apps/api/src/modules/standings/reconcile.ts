import { PLAYOFF_BRACKET, type SeedSource } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { tournamentLockKey, withLock } from '../../lib/lock';
import { recomputeStandings, getStandings } from './service';
import { recomputePlayerStatsForMatch } from '../stats/service';
import { rebuildSnapshot } from '../snapshot';
import { rebuildFootballSnapshot } from '../football/snapshot';

export async function reconcileTournament(tournamentId: string): Promise<void> {
  const pending = await prisma.match.count({ where: { tournamentId, projectionPending: true } });
  if (!pending) return;
  await withLock(tournamentLockKey(tournamentId), async () => {
    const matches = await prisma.match.findMany({
      where: { tournamentId, projectionPending: true },
      include: { tournament: true },
    });
    if (!matches.length) return;
    await recomputeStandings(tournamentId);
    for (const match of matches) {
      await recomputePlayerStatsForMatch(match.id);
      if (match.tournament.sport === 'FOOTBALL' && match.team1Id && match.team2Id)
        await rebuildFootballSnapshot(match.id);
      else if (match.tournament.sport === 'CRICKET') await rebuildSnapshot(match.id);
      await prisma.match.update({ where: { id: match.id }, data: { projectionPending: false } });
    }
    await advancePlayoffs(tournamentId);
  });
}

async function advancePlayoffs(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const matches = await prisma.match.findMany({ where: { tournamentId } });
  if (!matches.every((match) => match.status === 'COMPLETED' || match.status === 'ABANDONED')) {
    if (
      tournament.format !== 'LEAGUE_PLAYOFFS' ||
      matches.some((m) => m.stage === 'LEAGUE' && !['COMPLETED', 'ABANDONED'].includes(m.status))
    )
      return;
  }
  if (tournament.format === 'LEAGUE_PLAYOFFS') {
    const table = await getStandings(tournamentId);
    const resolve = (source: SeedSource): string | null => {
      if (source.kind === 'SEED') return table[source.position - 1]?.team.id ?? null;
      const feeder = matches.find((match) => match.stage === source.stage);
      if (!feeder || feeder.status !== 'COMPLETED' || !feeder.winnerTeamId) return null;
      return source.kind === 'WINNER'
        ? feeder.winnerTeamId
        : feeder.team1Id === feeder.winnerTeamId
          ? feeder.team2Id
          : feeder.team1Id;
    };
    for (const slot of PLAYOFF_BRACKET) {
      const match = matches.find((entry) => entry.stage === slot.stage);
      if (!match || match.status !== 'SCHEDULED') continue;
      const team1Id = resolve(slot.home),
        team2Id = resolve(slot.away);
      if (team1Id && team2Id)
        await prisma.match.update({ where: { id: match.id }, data: { team1Id, team2Id } });
    }
  }
  if (
    matches.length &&
    matches.every((match) => ['COMPLETED', 'ABANDONED'].includes(match.status))
  ) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'COMPLETED' } });
  }
}
