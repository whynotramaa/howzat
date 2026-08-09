import { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { ErrorText, Skeleton, SkeletonCard } from '@/components/ui/Feedback';
import { useMatch } from './queries';

const FootballMatchPage = lazy(() =>
  import('@/features/football/FootballMatchPage').then((m) => ({ default: m.FootballMatchPage })),
);
const FootballScoringPage = lazy(() =>
  import('@/features/football/FootballScoringPage').then((m) => ({
    default: m.FootballScoringPage,
  })),
);
const LiveFootballPage = lazy(() =>
  import('@/features/football/LiveFootballPage').then((m) => ({ default: m.LiveFootballPage })),
);
const LiveMatchPage = lazy(() =>
  import('@/features/live/LiveMatchPage').then((m) => ({ default: m.LiveMatchPage })),
);
const MatchPage = lazy(() => import('./MatchPage').then((m) => ({ default: m.MatchPage })));
const ScoringPage = lazy(() => import('./ScoringPage').then((m) => ({ default: m.ScoringPage })));

export function MatchRoute() {
  const { matchId = '' } = useParams();
  const { data, isPending, error } = useMatch(matchId);

  if (isPending) return <SkeletonCard rows={4} />;
  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return (
    <Suspense fallback={<SkeletonCard rows={4} />}>
      {data.sport === 'FOOTBALL' ? <FootballMatchPage match={data} /> : <MatchPage />}
    </Suspense>
  );
}

export function ScoringRoute() {
  const { matchId = '' } = useParams();
  const { data, isPending, error } = useMatch(matchId);

  if (isPending) return <SkeletonCard rows={6} />;
  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return (
    <Suspense fallback={<SkeletonCard rows={6} />}>
      {data.sport === 'FOOTBALL' ? <FootballScoringPage /> : <ScoringPage />}
    </Suspense>
  );
}

interface PublicMatchHeader {
  sport: Sport;
}

export function LiveRoute() {
  const { slug = '' } = useParams();

  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'match', slug],
    queryFn: () => apiFetch<PublicMatchHeader>(`/public/matches/${slug}`),
    enabled: Boolean(slug),
    staleTime: Infinity,
  });

  if (isPending) return <RouteSkeleton />;

  return (
    <Suspense fallback={<RouteSkeleton />}>
      {!error && data?.sport === 'FOOTBALL' ? <LiveFootballPage slug={slug} /> : <LiveMatchPage />}
    </Suspense>
  );
}

function RouteSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-8">
      <Skeleton className="h-72" />
      <Skeleton className="h-40" />
    </div>
  );
}
