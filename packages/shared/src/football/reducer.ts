import type { FootballEventKind } from '../types/enums';
import type {
  FootballEvent,
  FootballIncident,
  FootballMatchState,
  FootballTeamState,
} from '../types/football';
import type { PlayerRef } from '../types/scoring';

export interface FootballContext {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  players: Record<string, PlayerRef>;
  periodMinutes: number;
}

export function materializeFootballEvents(events: FootballEvent[]): FootballEvent[] {
  const removed = new Set<string>();

  for (const event of events) {
    if (event.eventType === 'UNDO' && event.supersedesEventId) {
      removed.add(event.supersedesEventId);
    }
  }

  return events
    .filter((event) => event.eventType === 'EVENT' && !removed.has(event.id))
    .sort((a, b) => a.seq - b.seq);
}

function emptyTeamState(teamId: string): FootballTeamState {
  return {
    teamId,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    scorers: {},
    savesBy: {},
    cards: {},
    sentOff: [],
    substitutions: [],
    subbedOn: [],
    subbedOff: [],
  };
}

export function buildFootballState(
  context: FootballContext,
  events: FootballEvent[],
): FootballMatchState {
  const home = emptyTeamState(context.homeTeamId);
  const away = emptyTeamState(context.awayTeamId);
  const incidents: FootballIncident[] = [];

  const standing = materializeFootballEvents(events);

  for (const event of standing) {
    const side = event.teamId === context.homeTeamId ? home : away;

    switch (event.kind) {
      case 'GOAL':
      case 'OWN_GOAL': {
        side.goals += 1;
        if (event.kind === 'GOAL' && event.playerId) {
          side.scorers[event.playerId] = (side.scorers[event.playerId] ?? 0) + 1;
        }
        break;
      }

      case 'SUBSTITUTION': {
        if (event.playerId && event.playerOffId) {
          side.substitutions.push({
            onId: event.playerId,
            offId: event.playerOffId,
            minute: event.minute,
            minuteLabel: formatMinute(event, context.periodMinutes),
          });
          // A player may come off and go back on again, so these read as "at some point",
          // never as "is off the pitch" — resolveOnPitch is the authority on who is playing.
          if (!side.subbedOn.includes(event.playerId)) side.subbedOn.push(event.playerId);
          if (!side.subbedOff.includes(event.playerOffId)) {
            side.subbedOff.push(event.playerOffId);
          }
        }
        break;
      }

      case 'SAVE': {
        side.saves += 1;
        if (event.playerId) {
          side.savesBy[event.playerId] = (side.savesBy[event.playerId] ?? 0) + 1;
        }
        break;
      }

      case 'YELLOW_CARD':
      case 'RED_CARD': {
        const carded = event.teamId === context.homeTeamId ? home : away;
        if (event.kind === 'YELLOW_CARD') carded.yellowCards += 1;
        else carded.redCards += 1;

        if (event.playerId) {
          const tally = carded.cards[event.playerId] ?? { yellow: 0, red: 0 };
          if (event.kind === 'YELLOW_CARD') tally.yellow += 1;
          else tally.red += 1;
          carded.cards[event.playerId] = tally;

          const off = tally.red > 0 || tally.yellow >= 2;
          if (off && !carded.sentOff.includes(event.playerId)) {
            carded.sentOff.push(event.playerId);
          }
        }
        break;
      }
    }

    incidents.push(toIncident(event, context));
  }

  return {
    matchId: context.matchId,
    home,
    away,
    incidents,
    lastEventSeq: events.reduce((max, event) => Math.max(max, event.seq), 0),
  };
}

function toIncident(event: FootballEvent, context: FootballContext): FootballIncident {
  return {
    id: event.id,
    seq: event.seq,
    kind: event.kind,
    teamId: event.teamId,
    playerId: event.playerId,
    playerName: event.playerId ? (context.players[event.playerId]?.name ?? null) : null,
    assistPlayerId: event.assistPlayerId,
    assistPlayerName: event.assistPlayerId
      ? (context.players[event.assistPlayerId]?.name ?? null)
      : null,
    playerOffId: event.playerOffId,
    playerOffName: event.playerOffId ? (context.players[event.playerOffId]?.name ?? null) : null,
    minute: event.minute,
    period: event.period,
    stoppage: event.stoppage,
    minuteLabel: formatMinute(event, context.periodMinutes),
  };
}

export function formatMinute(
  event: Pick<FootballEvent, 'minute' | 'period' | 'stoppage'>,
  periodMinutes: number,
): string {
  if (event.stoppage > 0) {
    return `${event.period * periodMinutes}+${event.stoppage}'`;
  }
  return `${event.minute}'`;
}

export function resolveOnPitch(
  starters: Array<{ playerId: string; slot: number }>,
  team: FootballTeamState,
): Map<number, string> {
  const bySlot = new Map<number, string>();
  for (const starter of starters) bySlot.set(starter.slot, starter.playerId);

  const slotOf = (playerId: string): number | null => {
    for (const [slot, occupant] of bySlot) {
      if (occupant === playerId) return slot;
    }
    return null;
  };

  for (const change of team.substitutions) {
    const slot = slotOf(change.offId);
    if (slot === null) continue;
    bySlot.set(slot, change.onId);
  }

  for (const playerId of team.sentOff) {
    const slot = slotOf(playerId);
    if (slot !== null) bySlot.delete(slot);
  }

  return bySlot;
}

/**
 * The most recent time a player came on and the most recent time they went off.
 * Under rolling substitutions either can happen more than once, so the latest wins.
 */
export function lastChangeFor(
  team: FootballTeamState,
  playerId: string,
): { on: string | null; off: string | null } {
  let on: string | null = null;
  let off: string | null = null;

  for (const change of team.substitutions) {
    if (change.onId === playerId) on = change.minuteLabel;
    if (change.offId === playerId) off = change.minuteLabel;
  }

  return { on, off };
}

/** How many changes a side has left, or `null` when the bench is unlimited. */
export function substitutionsRemaining(
  team: FootballTeamState,
  limit: number | null,
): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - team.substitutions.length);
}

export function isGoalKind(kind: FootballEventKind): boolean {
  return kind === 'GOAL' || kind === 'OWN_GOAL';
}

export const FOOTBALL_EVENT_LABELS: Record<FootballEventKind, string> = {
  GOAL: 'Goal',
  OWN_GOAL: 'Own goal',
  YELLOW_CARD: 'Yellow card',
  RED_CARD: 'Red card',
  SAVE: 'Save',
  SUBSTITUTION: 'Substitution',
};

export function footballResultText(
  home: { name: string; goals: number },
  away: { name: string; goals: number },
): { text: string; winner: 'HOME' | 'AWAY' | null } {
  if (home.goals === away.goals) {
    return { text: `Match drawn ${home.goals}–${away.goals}`, winner: null };
  }

  const [winner, loser, side] =
    home.goals > away.goals ? ([home, away, 'HOME'] as const) : ([away, home, 'AWAY'] as const);

  return {
    text: `${winner.name} won ${winner.goals}–${loser.goals}`,
    winner: side,
  };
}
