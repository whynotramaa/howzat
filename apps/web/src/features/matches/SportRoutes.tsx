import { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { ErrorText, Skeleton, SkeletonCard } from '@/components/ui/Feedback';
import { useMatch } from './queries';

// Each sport's screens are their own chunk. The dispatch below already knows
// which one it needs before it renders, so the other never leaves the server.
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
const ScoringPage = lazy(() =>
  import('./ScoringPage').then((m) => ({ default: m.ScoringPage })),
);

/*
 * Which sport's screen to draw.
 *
 * Every route that opens a match needs this answer before it can render
 * anything, and it cannot come from the URL: a match is addressed by id or by
 * slug, and neither says what game is being played. So the sport travels on the
 * match itself — MatchDto.sport for the signed-in routes, and the public match
 * header for the share link.
 *
 * Dispatching in its own component rather than with a branch inside each page
 * is what keeps the two consoles genuinely separate. A cricket page that starts
 * with `if (football)` ends up with football's concerns threaded through all
 * nine hundred of its lines; a page that is only ever mounted for one sport
 * never learns the other exists.
 */

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

/**
 * The share link, which is one URL for both codes.
 *
 * This is the only place where a wrong guess would be visible to someone who
 * never signed in, so it waits for the header rather than rendering a cricket
 * scoreboard optimistically and swapping it a moment later.
 */
export function LiveRoute() {
  const { slug = '' } = useParams();

  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'match', slug],
    queryFn: () => apiFetch<PublicMatchHeader>(`/public/matches/${slug}`),
    enabled: Boolean(slug),
    // The sport of a match never changes, so this is fetched once per visit.
    staleTime: Infinity,
  });

  if (isPending) return <RouteSkeleton />;

  return (
    <Suspense fallback={<RouteSkeleton />}>
      {/* A slug that does not resolve is still the cricket page's job to
          explain — it renders the same "could not load the score" message. */}
      {!error && data?.sport === 'FOOTBALL' ? (
        <LiveFootballPage slug={slug} />
      ) : (
        <LiveMatchPage />
      )}
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
