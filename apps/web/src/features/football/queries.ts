import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClockCommand,
  FootballEventRequestInput,
  FootballLineupInput,
  FootballScorerStateDto,
  FootballSnapshot,
  KickOffInput,
  MatchClockDto,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { matchKeys } from '@/features/matches/queries';

/**
 * The football console's data layer. Split from the cricket queries for the
 * same reason those were split from the organizer ones: they are invalidated on
 * a different rhythm, and a key that is refetched on every goal has no business
 * sharing a file with one refetched twice a season.
 */

export const footballKeys = {
  squads: (matchId: string) => ['matches', matchId, 'football', 'squads'] as const,
  state: (matchId: string) => ['matches', matchId, 'football', 'state'] as const,
};

export interface FootballSquadPlayer {
  id: string;
  name: string;
  // No role: football players are just players, and the one position that is
  // named — the goalkeeper — is chosen on the team sheet by who takes slot 0.
  selected: boolean;
  slot: number | null;
  shirtNumber: number | null;
  isCaptain: boolean;
}

export interface FootballSquadSide {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  formation: string | null;
  players: FootballSquadPlayer[];
}

export interface FootballSquadsResponse {
  /** The starting side. The squad may be larger; the extras are the bench. */
  playersPerTeam: number;
  /** What this fixture will actually run on — its override, or the default. */
  periods: number;
  periodMinutes: number;
  home: FootballSquadSide;
  away: FootballSquadSide;
}

interface EventResponse {
  snapshot: FootballSnapshot;
  duplicate: boolean;
  seq: number;
}

export function useFootballSquads(matchId: string) {
  return useQuery({
    queryKey: footballKeys.squads(matchId),
    queryFn: () => api.get<FootballSquadsResponse>(`/matches/${matchId}/football/squads`),
    enabled: Boolean(matchId),
  });
}

export function useFootballState(matchId: string) {
  return useQuery({
    queryKey: footballKeys.state(matchId),
    queryFn: () => api.get<FootballScorerStateDto>(`/matches/${matchId}/football/state`),
    enabled: Boolean(matchId),
    // The console is the writer, so it already knows when this changed; a
    // background refetch would only fight the one each incident triggers.
    staleTime: 0,
  });
}

export function useSetFootballLineups(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: FootballLineupInput) =>
      api.put<unknown>(`/matches/${matchId}/football/lineups`, input),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

export function useKickOff(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // The clock is settled here rather than read from the tournament: this is
    // the last moment anyone can change how long the match is, and the person
    // pressing the button is the one who knows.
    mutationFn: (input: KickOffInput = {}) =>
      api.post<MatchClockDto>(`/matches/${matchId}/football/kickoff`, input),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

/**
 * Every movement of the watch goes through one mutation rather than one per
 * verb. The server decides what is legal from the clock's own state, so a
 * command is genuinely one shape of request — splitting it into six hooks
 * would be six ways to spell the same POST.
 */
export function useClockCommand(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command: ClockCommand) =>
      api.post<MatchClockDto>(`/matches/${matchId}/football/clock`, { command }),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

export function useRecordFootballEvent(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: FootballEventRequestInput) =>
      api.post<EventResponse>(`/matches/${matchId}/football/events`, input),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

export function useUndoFootballEvent(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetEventId?: string) =>
      api.post<EventResponse>(`/matches/${matchId}/football/events/undo`, {
        clientEventId: crypto.randomUUID(),
        ...(targetEventId ? { targetEventId } : {}),
      }),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

/**
 * Any write moves both the console's state and the match header, and the two
 * are rendered on different screens — so they are invalidated together rather
 * than case by case.
 */
function invalidateFootball(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: footballKeys.state(matchId) });
  void queryClient.invalidateQueries({ queryKey: footballKeys.squads(matchId) });
  void queryClient.invalidateQueries({ queryKey: matchKeys.match(matchId) });
  // The fixture list shows each match's status; it is keyed by tournament, so
  // match the prefix rather than plumbing the tournament id through every call.
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'tournaments' && query.queryKey[2] === 'matches',
  });
}
