import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { HomePage } from '@/features/home/HomePage';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { Skeleton } from '@/components/ui/Feedback';
import { ApiError } from '@/lib/api';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const PublicTournamentPage = lazy(() =>
  import('@/features/organizer/PublicTournamentPage').then((m) => ({
    default: m.PublicTournamentPage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TournamentsPage = lazy(() =>
  import('@/features/organizer/TournamentsPage').then((m) => ({ default: m.TournamentsPage })),
);
const TournamentDetailPage = lazy(() =>
  import('@/features/organizer/TournamentDetailPage').then((m) => ({
    default: m.TournamentDetailPage,
  })),
);
const TeamDetailPage = lazy(() =>
  import('@/features/organizer/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })),
);
const FixturesPage = lazy(() =>
  import('@/features/matches/FixturesPage').then((m) => ({ default: m.FixturesPage })),
);
const PlayerProfilePage = lazy(() =>
  import('@/features/profile/PlayerProfilePage').then((m) => ({ default: m.PlayerProfilePage })),
);

const LiveRoute = lazy(() =>
  import('@/features/matches/SportRoutes').then((m) => ({ default: m.LiveRoute })),
);
const MatchRoute = lazy(() =>
  import('@/features/matches/SportRoutes').then((m) => ({ default: m.MatchRoute })),
);
const ScoringRoute = lazy(() =>
  import('@/features/matches/SportRoutes').then((m) => ({ default: m.ScoringRoute })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
    },
  },
});

function RouteFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-8">
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/live/:slug" element={<LiveRoute />} />
              <Route path="/tournament/:tournamentId" element={<PublicTournamentPage />} />

              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
                <Route path="/tournaments/:tournamentId/fixtures" element={<FixturesPage />} />
                <Route path="/teams/:teamId" element={<TeamDetailPage />} />

                <Route path="/matches/:matchId" element={<MatchRoute />} />
                <Route path="/matches/:matchId/score" element={<ScoringRoute />} />
                <Route path="/score/:matchId" element={<ScoringRoute />} />
                <Route path="/players/:username" element={<PlayerProfilePage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
