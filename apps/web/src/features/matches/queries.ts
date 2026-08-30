import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BallRequestInput,
  DlsInterruptionInput,
  DlsSettingsInput,
  DlsStateDto,
  FixturePreviewDto,
  MatchDto,
  MatchSnapshot,
  MatchWithInningsDto,
  PlayerRole,
  PlayingXiInput,
  ScorerStateDto,
  TossInput,
  UserRef,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { keys as organizerKeys } from '@/features/organizer/queries';

export const matchKeys = {
  fixtures: (tournamentId: string) => ['tournaments', tournamentId, 'matches'] as const,
  match: (matchId: string) => ['matches', matchId] as const,
  squads: (matchId: string) => ['matches', matchId, 'squads'] as const,
  state: (matchId: string) => ['matches', matchId, 'state'] as const,
  dls: (matchId: string) => ['matches', matchId, 'dls'] as const,
};

interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface SquadPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  selected: boolean;
  battingOrder: number | null;
  isCaptain: boolean;
  isKeeper: boolean;
}

export interface SquadSide {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  players: SquadPlayer[];
}

export interface SquadsResponse {
  team1: SquadSide | null;
  team2: SquadSide | null;
}

interface BallResponse {
  snapshot: MatchSnapshot;
  duplicate: boolean;
  inningsCompleted: boolean;
  matchCompleted?: boolean;
}

export function useFixtures(tournamentId: string) {
  return useQuery({
    queryKey: matchKeys.fixtures(tournamentId),
    queryFn: () => api.get<ListResponse<MatchDto>>(`/tournaments/${tournamentId}/matches`),
    enabled: Boolean(tournamentId),
  });
}

export function usePreviewFixtures(tournamentId: string) {
  return useMutation({
    mutationFn: () => api.post<FixturePreviewDto>(`/tournaments/${tournamentId}/fixtures/preview`),
  });
}

export function useGenerateFixtures(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (regenerate: boolean) =>
      api.post<{ created: number; items: MatchDto[]; total: number }>(
        `/tournaments/${tournamentId}/fixtures`,
        { regenerate },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchKeys.fixtures(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: organizerKeys.tournament(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: organizerKeys.tournaments });
    },
  });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: matchKeys.match(matchId),
    queryFn: () => api.get<MatchWithInningsDto>(`/matches/${matchId}`),
    enabled: Boolean(matchId),
  });
}

export function useSquads(matchId: string) {
  return useQuery({
    queryKey: matchKeys.squads(matchId),
    queryFn: () => api.get<SquadsResponse>(`/matches/${matchId}/squads`),
    enabled: Boolean(matchId),
  });
}

export function useRecordToss(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TossInput) => api.post<MatchDto>(`/matches/${matchId}/toss`, input),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useSetPlayingXi(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlayingXiInput) =>
      api.put<unknown>(`/matches/${matchId}/playing-xi`, input),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useStartMatch(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<unknown>(`/matches/${matchId}/start`),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useResumeInnings(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (number: number) =>
      api.post<unknown>(`/matches/${matchId}/innings/${number}/resume`),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useAbandonMatch(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resultText?: string) =>
      api.post<MatchDto>(`/matches/${matchId}/abandon`, resultText ? { resultText } : {}),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useAssignScorer(tournamentId: string, matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) =>
      api.post<{ matchId: string; scorer: UserRef }>(
        `/tournaments/${tournamentId}/matches/${matchId}/scorers`,
        { username: username.trim().toLowerCase() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchKeys.match(matchId) });
      void queryClient.invalidateQueries({ queryKey: matchKeys.fixtures(tournamentId) });
    },
  });
}

export function useRemoveScorer(tournamentId: string, matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scorerId: string) =>
      api.delete<void>(`/tournaments/${tournamentId}/matches/${matchId}/scorers/${scorerId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchKeys.match(matchId) });
      void queryClient.invalidateQueries({ queryKey: matchKeys.fixtures(tournamentId) });
    },
  });
}

export function useScorerState(matchId: string) {
  return useQuery({
    queryKey: matchKeys.state(matchId),
    queryFn: () => api.get<ScorerStateDto>(`/matches/${matchId}/state`),
    enabled: Boolean(matchId),
    staleTime: 0,
  });
}

export function useRecordBall(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BallRequestInput) =>
      api.post<BallResponse>(`/matches/${matchId}/balls`, input),
    onSuccess: async () => {
      // The offline queue removes the item after mutateAsync resolves. Make
      // that resolution mean the scorer state has caught up, not just that the
      // ball POST succeeded, otherwise an older in-flight GET can flash back.
      await queryClient.cancelQueries({ queryKey: matchKeys.state(matchId) });
      await queryClient.refetchQueries({
        queryKey: matchKeys.state(matchId),
        type: 'active',
      });
      invalidateMatch(queryClient, matchId, { skipState: true });
    },
  });
}

export function useUndoBall(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<BallResponse>(`/matches/${matchId}/balls/undo`, {
        clientEventId: crypto.randomUUID(),
      }),
    onSuccess: () => invalidateMatch(queryClient, matchId),
  });
}

export function useDlsState(matchId: string, enabled = true) {
  return useQuery({
    queryKey: matchKeys.dls(matchId),
    queryFn: () => api.get<DlsStateDto>(`/matches/${matchId}/dls`),
    enabled: Boolean(matchId) && enabled,
  });
}

/**
 * Every DLS write returns the whole recomputed state, so each of these seeds
 * the cache with the answer rather than asking for it again — the scorer sees
 * the revised target the instant it lands.
 */
function useDlsMutation<TInput>(
  matchId: string,
  request: (input: TInput) => Promise<DlsStateDto>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: request,
    onSuccess: (state) => {
      queryClient.setQueryData(matchKeys.dls(matchId), state);
      invalidateMatch(queryClient, matchId);
    },
  });
}

export function useUpdateDlsSettings(matchId: string) {
  return useDlsMutation<DlsSettingsInput>(matchId, (input) =>
    api.patch<DlsStateDto>(`/matches/${matchId}/dls`, input),
  );
}

export function useAddDlsInterruption(matchId: string) {
  return useDlsMutation<DlsInterruptionInput>(matchId, (input) =>
    api.post<DlsStateDto>(`/matches/${matchId}/dls/interruptions`, input),
  );
}

export function useRemoveDlsInterruption(matchId: string) {
  return useDlsMutation<string>(matchId, (interruptionId) =>
    api.delete<DlsStateDto>(`/matches/${matchId}/dls/interruptions/${interruptionId}`),
  );
}

export function useConcludeUnderDls(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) =>
      api.post<{ resultText: string; winnerTeamId: string | null; parScore: number | null }>(
        `/matches/${matchId}/dls/conclude`,
        reason ? { reason } : {},
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchKeys.dls(matchId) });
      invalidateMatch(queryClient, matchId);
    },
  });
}

function invalidateMatch(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId: string,
  options: { skipState?: boolean } = {},
): void {
  void queryClient.invalidateQueries({ queryKey: matchKeys.match(matchId) });
  if (!options.skipState) void queryClient.invalidateQueries({ queryKey: matchKeys.state(matchId) });
  void queryClient.invalidateQueries({ queryKey: matchKeys.squads(matchId) });
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'tournaments' && query.queryKey[2] === 'matches',
  });
}
