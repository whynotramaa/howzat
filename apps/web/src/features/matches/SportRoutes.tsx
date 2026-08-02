import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { ErrorText, Skeleton, SkeletonCard } from '@/components/ui/Feedback';
import { FootballMatchPage } from '@/features/football/FootballMatchPage';
import { FootballScoringPage } from '@/features/football/FootballScoringPage';
import { LiveFootballPage } from '@/features/football/LiveFootballPage';
import { LiveMatchPage } from '@/features/live/LiveMatchPage';
import { MatchPage } from './MatchPage';
import { ScoringPage } from './ScoringPage';
import { useMatch } from './queries';

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

  return data.sport === 'FOOTBALL' ? <FootballMatchPage match={data} /> : <MatchPage />;
}

export function ScoringRoute() {
  const { matchId = '' } = useParams();
  const { data, isPending, error } = useMatch(matchId);

  if (isPending) return <SkeletonCard rows={6} />;
  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return data.sport === 'FOOTBALL' ? <FootballScoringPage /> : <ScoringPage />;
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

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-8">
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  // A slug that does not resolve is still a cricket page's job to explain —
  // it renders the same "could not load the score" message either way.
  if (error) return <LiveMatchPage />;

  return data?.sport === 'FOOTBALL' ? <LiveFootballPage slug={slug} /> : <LiveMatchPage />;
}
