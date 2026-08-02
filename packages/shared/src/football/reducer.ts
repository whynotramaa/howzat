import type { FootballEventKind } from '../types/enums';
import type {
  FootballEvent,
  FootballIncident,
  FootballMatchState,
  FootballTeamState,
} from '../types/football';
import type { PlayerRef } from '../types/scoring';

/**
 * Folding the football log into a score.
 *
 * Same contract as the cricket reducer, and the same reason for it: the log is
 * the truth, the score is a projection, and the projection is recomputed rather
 * than incremented so a correction cannot leave a stale total behind. Pure, so
 * the server and every viewer's browser arrive at the same 2-1.
 */

export interface FootballContext {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Names for the timeline. Missing ids simply render without a name. */
  players: Record<string, PlayerRef>;
  /** Regulation minutes per period — used to write "45+2" rather than "47". */
  periodMinutes: number;
}

/**
 * Drops undone events and returns what actually stands, in sequence order.
 *
 * An UNDO row names the event it removes; both stay in the log forever. This
 * is the football twin of materializeEvents, and it exists for the same reason:
 * everything downstream — the score, the timeline, the points table — has to
 * agree on which events count, and that agreement has to live in one function.
 */
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
    scorers: {},
    cards: {},
    sentOff: [],
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
        // An own goal is credited to the side that benefits but must never
        // appear in that side's scorer list — the player belongs to the other
        // team, and a scorers column that quietly gains an opponent is worse
        // than one that omits an own goal.
        if (event.kind === 'GOAL' && event.playerId) {
          side.scorers[event.playerId] = (side.scorers[event.playerId] ?? 0) + 1;
        }
        break;
      }

      case 'YELLOW_CARD':
      case 'RED_CARD': {
        // A card is recorded against the player's own side. `teamId` on a card
        // is that side already — only goals have the own-goal inversion.
        const carded = event.teamId === context.homeTeamId ? home : away;
        if (event.kind === 'YELLOW_CARD') carded.yellowCards += 1;
        else carded.redCards += 1;

        if (event.playerId) {
          const tally = carded.cards[event.playerId] ?? { yellow: 0, red: 0 };
          if (event.kind === 'YELLOW_CARD') tally.yellow += 1;
          else tally.red += 1;
          carded.cards[event.playerId] = tally;

          // Off for a straight red, or for a second yellow — the rule that
          // decides how many players are left on the pitch.
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
    // The high-water mark of the *whole* log, undos included: it is a staleness
    // marker for the wire, not a count of what stands.
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
    minute: event.minute,
    period: event.period,
    stoppage: event.stoppage,
    minuteLabel: formatMinute(event, context.periodMinutes),
  };
}

/**
 * "45+2'" or "67'". The stoppage form is not cosmetic: a goal on 45+2 and a
 * goal on 47 are different facts, and only one of them ever gets said aloud.
 */
export function formatMinute(
  event: Pick<FootballEvent, 'minute' | 'period' | 'stoppage'>,
  periodMinutes: number,
): string {
  if (event.stoppage > 0) {
    return `${event.period * periodMinutes}+${event.stoppage}'`;
  }
  return `${event.minute}'`;
}

/** Whether an event kind is a goal in either direction. */
export function isGoalKind(kind: FootballEventKind): boolean {
  return kind === 'GOAL' || kind === 'OWN_GOAL';
}

export const FOOTBALL_EVENT_LABELS: Record<FootballEventKind, string> = {
  GOAL: 'Goal',
  OWN_GOAL: 'Own goal',
  YELLOW_CARD: 'Yellow card',
  RED_CARD: 'Red card',
};

/**
 * The wording every scorecard uses. A draw names no winner, which is the whole
 * reason football needed its own result writer rather than reusing cricket's.
 */
export function footballResultText(
  home: { name: string; goals: number },
  away: { name: string; goals: number },
): { text: string; winner: 'HOME' | 'AWAY' | null } {
  if (home.goals === away.goals) {
    return { text: `Match drawn ${home.goals}–${away.goals}`, winner: null };
  }

  const [winner, loser, side] =
    home.goals > away.goals
      ? ([home, away, 'HOME'] as const)
      : ([away, home, 'AWAY'] as const);

  return {
    text: `${winner.name} won ${winner.goals}–${loser.goals}`,
    winner: side,
  };
}
