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

export const footballKeys = {
  squads: (matchId: string) => ['matches', matchId, 'football', 'squads'] as const,
  state: (matchId: string) => ['matches', matchId, 'football', 'state'] as const,
};

export interface FootballSquadPlayer {
  id: string;
  name: string;
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
  playersPerTeam: number;
  periods: number;
  periodMinutes: number;
  substitutionLimit: number | null;
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
    mutationFn: (input: KickOffInput = {}) =>
      api.post<MatchClockDto>(`/matches/${matchId}/football/kickoff`, input),
    onSuccess: () => invalidateFootball(queryClient, matchId),
  });
}

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

function invalidateFootball(queryClient: ReturnType<typeof useQueryClient>, matchId: string): void {
  void queryClient.invalidateQueries({ queryKey: footballKeys.state(matchId) });
  void queryClient.invalidateQueries({ queryKey: footballKeys.squads(matchId) });
  void queryClient.invalidateQueries({ queryKey: matchKeys.match(matchId) });
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'tournaments' && query.queryKey[2] === 'matches',
  });
}
