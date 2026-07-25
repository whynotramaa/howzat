import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { LiveMatchPage } from '@/features/live/LiveMatchPage';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TournamentsPage } from '@/features/organizer/TournamentsPage';
import { TournamentDetailPage } from '@/features/organizer/TournamentDetailPage';
import { TeamDetailPage } from '@/features/organizer/TeamDetailPage';
import { FixturesPage } from '@/features/matches/FixturesPage';
import { MatchPage } from '@/features/matches/MatchPage';
import { ScoringPage } from '@/features/matches/ScoringPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PlayerProfilePage } from '@/features/profile/PlayerProfilePage';
import { PublicTournamentPage } from '@/features/organizer/PublicTournamentPage';
import { ApiError } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 4xx just delays showing the user the reason it failed.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public: the front page, and the link people actually share. */}
            <Route path="/" element={<HomePage />} />
            <Route path="/live/:slug" element={<LiveMatchPage />} />
            <Route path="/tournament/:tournamentId" element={<PublicTournamentPage />} />

            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              {/* Where a signed-in player lands, and where every squad-addition
                  notification points. */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
              <Route path="/tournaments/:tournamentId/fixtures" element={<FixturesPage />} />
              <Route path="/teams/:teamId" element={<TeamDetailPage />} />

              {/* Match setup and scoring are addressed by id, not by slug: the slug
                  is the public read-only link and confers no access. */}
              <Route path="/matches/:matchId" element={<MatchPage />} />
              <Route path="/matches/:matchId/score" element={<ScoringPage />} />
              {/* Public brief terminology: keep the shorter scorer-console URL as
                  an alias while preserving the existing match-scoped route. */}
              <Route path="/score/:matchId" element={<ScoringPage />} />
              <Route path="/players/:username" element={<PlayerProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
