import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePlayerInput,
  CreateTeamInput,
  CreateTournamentInput,
  PlayerDto,
  TeamDto,
  TeamWithPlayersDto,
  TournamentDto,
  UserRef,
} from '@howzat/shared';
import { api } from '@/lib/api';

export const keys = {
  tournaments: ['tournaments'] as const,
  tournament: (id: string) => ['tournaments', id] as const,
  teams: (tournamentId: string) => ['tournaments', tournamentId, 'teams'] as const,
  team: (teamId: string) => ['teams', teamId] as const,
  userSearch: (q: string) => ['users', 'search', q] as const,
};

interface ListResponse<T> {
  items: T[];
  total: number;
  eligibleCount?: number;
}

export function useTournaments() {
  return useQuery({
    queryKey: keys.tournaments,
    queryFn: () => api.get<ListResponse<TournamentDto>>('/tournaments'),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: keys.tournament(id),
    queryFn: () => api.get<TournamentDto>(`/tournaments/${id}`),
  });
}

export function useTeams(tournamentId: string) {
  return useQuery({
    queryKey: keys.teams(tournamentId),
    queryFn: () => api.get<ListResponse<TeamDto>>(`/tournaments/${tournamentId}/teams`),
  });
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: keys.team(teamId),
    queryFn: () => api.get<TeamWithPlayersDto>(`/teams/${teamId}`),
  });
}

export function useUserSearch(query: string) {
  const q = query.trim();

  return useQuery({
    queryKey: keys.userSearch(q),
    queryFn: () => api.get<{ items: UserRef[] }>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 15_000,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTournamentInput) => api.post<TournamentDto>('/tournaments', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tournaments }),
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: string) => api.delete<void>(`/tournaments/${tournamentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tournaments }),
  });
}

export function useCreateTeam(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeamInput) =>
      api.post<TeamDto>(`/tournaments/${tournamentId}/teams`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.teams(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: keys.tournament(tournamentId) });
    },
  });
}

export function useDeleteTeam(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => api.delete<void>(`/teams/${teamId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.teams(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: keys.tournament(tournamentId) });
    },
  });
}

export function useAddPlayer(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlayerInput) =>
      api.post<PlayerDto>(`/teams/${teamId}/players`, input),
    onSuccess: () => invalidateSquad(queryClient, teamId, tournamentId),
  });
}

export function useAddPlayersBulk(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (players: CreatePlayerInput[]) =>
      api.post<ListResponse<PlayerDto>>(`/teams/${teamId}/players/bulk`, { players }),
    onSuccess: () => invalidateSquad(queryClient, teamId, tournamentId),
  });
}

export function useDeletePlayer(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (playerId: string) => api.delete<void>(`/players/${playerId}`),
    onSuccess: () => invalidateSquad(queryClient, teamId, tournamentId),
  });
}

function invalidateSquad(
  queryClient: ReturnType<typeof useQueryClient>,
  teamId: string,
  tournamentId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: keys.team(teamId) });
  void queryClient.invalidateQueries({ queryKey: keys.teams(tournamentId) });
  void queryClient.invalidateQueries({ queryKey: keys.tournament(tournamentId) });
}
