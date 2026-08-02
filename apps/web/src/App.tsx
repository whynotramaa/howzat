import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { HomePage } from '@/features/home/HomePage';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { Skeleton } from '@/components/ui/Feedback';
import { ApiError } from '@/lib/api';

/*
 * Routes are code-split, and the split is drawn where the audiences are.
 *
 * The whole app was one 1MB bundle, which meant somebody opening a shared score
 * on a phone at a ground downloaded both scoring consoles, the organizer tools,
 * the fixture generator and the stats tables before the first goal appeared.
 * That is the "feels slow" — not rendering, but a megabyte of parse before
 * anything paints, on the exact connection least able to afford it.
 *
 * HomePage stays eagerly imported because it is the one thing that must not
 * flash a fallback: it is the first paint for a cold visitor.
 */

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

// The sport routes split again inside themselves — a football scorer never
// downloads the cricket console, and vice versa.
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
      // Retrying a 4xx just delays showing the user the reason it failed.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
    },
  },
});

/**
 * What a route shows while its chunk arrives.
 *
 * Deliberately the same skeleton the pages themselves use while loading data,
 * so a slow network produces one continuous loading state rather than a spinner
 * that hands over to a skeleton that hands over to content.
 */
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
              {/* Public: the front page, and the link people actually share. */}
              <Route path="/" element={<HomePage />} />
              {/* One share URL for both codes; the route picks the scoreboard. */}
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
                {/* Where a signed-in player lands, and where every squad-addition
                    notification points. */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
                <Route path="/tournaments/:tournamentId/fixtures" element={<FixturesPage />} />
                <Route path="/teams/:teamId" element={<TeamDetailPage />} />

                {/* Match setup and scoring are addressed by id, not by slug: the slug
                    is the public read-only link and confers no access. */}
                <Route path="/matches/:matchId" element={<MatchRoute />} />
                <Route path="/matches/:matchId/score" element={<ScoringRoute />} />
                {/* Public brief terminology: keep the shorter scorer-console URL as
                    an alias while preserving the existing match-scoped route. */}
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
