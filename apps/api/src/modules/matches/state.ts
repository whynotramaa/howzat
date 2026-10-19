import { buildState, materializeEvents, type ScorerStateDto } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { loadEvents, loadInningsContext } from '../snapshot';
import { toMatchDto, toInningsDto } from './serialize';

export async function loadScorerState(matchId: string): Promise<ScorerStateDto> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: true,
      team2: true,
      scorerAssignments: {
        select: { scorer: { select: { id: true, username: true, name: true } } },
      },
      innings: { orderBy: { number: 'desc' } },
      tournament: { select: { sport: true } },
    },
  });

  if (!match) throw notFound('Match');

  const live = match.innings.find((entry) => entry.status === 'IN_PROGRESS') ?? null;

  if (!live) {
    const empty: ScorerStateDto = {
      match: toMatchDto(match),
      innings: null,
      state: null,
      context: null,
      previousOverBowlerId: null,
    };

    return empty;
  }

  const context = await loadInningsContext(live.id);
  const events = await loadEvents(live.id);
  const state = buildState(context, events);

  const deliveries = materializeEvents(events);
  const previousOverBowlerId =
    state.thisOver.length === 0 && state.legalBalls > 0
      ? (deliveries[deliveries.length - 1]?.bowlerId ?? null)
      : null;

  const dto: ScorerStateDto = {
    match: toMatchDto(match),
    innings: toInningsDto(live),
    state,
    context,
    previousOverBowlerId,
  };

  return { ...dto, acceptedEventIds: events.map((event) => event.clientEventId) };
}
