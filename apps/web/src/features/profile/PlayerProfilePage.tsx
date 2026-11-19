import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CareerStatsDto, PlayerProfileDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { LeaderRow } from '@/components/ui/Score';
import { useAuth } from '@/features/auth/AuthProvider';

export function PlayerProfilePage() {
  const { username = '' } = useParams();
  const { user, logout } = useAuth();

  const { data, isPending, error } = useQuery({
    queryKey: ['players', username],
    queryFn: () => api.get<PlayerProfileDto>(`/users/${username}`),
    enabled: username.length > 0,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={5} />
      </div>
    );
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const { career } = data;
  const isSelf = user?.username === data.user.username;
  const hasPlayed = career.matches > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PlayerAvatar seed={data.user.username} name={data.user.name} size="lg" />
        <PageHeader
          className="min-w-0 flex-1"
          eyebrow={
            <>
              <span>@{data.user.username}</span>
              {isSelf ? <Pill tone="neutral">You</Pill> : null}
            </>
          }
          title={data.user.name}
          actions={
            isSelf ? (
              <Button size="sm" variant="danger" onClick={() => void logout()}>
                Sign out
              </Button>
            ) : undefined
          }
        />
      </div>

      <StatStrip
        items={[
          { label: 'Matches', value: career.matches },
          {
            label: 'Runs',
            value: career.batting.runs,
            hint: career.batting.average ? `Avg ${career.batting.average}` : undefined,
          },
          {
            label: 'Wickets',
            value: career.bowling.wickets,
            hint: career.bowling.bestFigures ? `Best ${career.bowling.bestFigures}` : undefined,
          },
          {
            label: 'Scored',
            value: data.matchesScored,
            hint: `${data.tournamentsOrganized} organised`,
          },
        ]}
      />

      {hasPlayed ? (
        <>
          <section>
            <SectionHeading title="Career" />
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <BattingCard batting={career.batting} />
              <BowlingCard bowling={career.bowling} />
              <FieldingCard fielding={career.fielding} />
            </div>
          </section>

          <RecentMatches matches={data.recentMatches} />
        </>
      ) : (
        <EmptyState compact title="No matches played yet" />
      )}
    </div>
  );
}

function BattingCard({ batting }: { batting: CareerStatsDto['batting'] }) {
  return (
    <StatCard title="Batting" headline={batting.runs} headlineLabel="runs" ink="var(--ink-blue)">
      <LeaderRow label="Innings" value={batting.innings} />
      <LeaderRow label="Not out" value={batting.notOuts} />
      <LeaderRow label="Average" value={batting.average ?? '—'} emphasis />
      <LeaderRow label="Strike rate" value={batting.strikeRate ?? '—'} />
      <LeaderRow
        label="High score"
        value={
          batting.innings > 0 ? `${batting.highScore}${batting.highScoreNotOut ? '*' : ''}` : '—'
        }
        emphasis
      />
      <LeaderRow label="Balls faced" value={batting.ballsFaced} />
      <LeaderRow label="50s / 100s" value={`${batting.fifties} / ${batting.hundreds}`} />
      <LeaderRow label="4s / 6s" value={`${batting.fours} / ${batting.sixes}`} />
      <LeaderRow label="Ducks" value={batting.ducks} />
    </StatCard>
  );
}

function BowlingCard({ bowling }: { bowling: CareerStatsDto['bowling'] }) {
  return (
    <StatCard
      title="Bowling"
      headline={bowling.wickets}
      headlineLabel="wickets"
      ink="var(--ink-red)"
    >
      <LeaderRow label="Innings" value={bowling.innings} />
      <LeaderRow label="Overs" value={bowling.oversBowled} />
      <LeaderRow label="Runs conceded" value={bowling.runsConceded} />
      <LeaderRow label="Average" value={bowling.average ?? '—'} emphasis />
      <LeaderRow label="Economy" value={bowling.economy ?? '—'} emphasis />
      <LeaderRow label="Strike rate" value={bowling.strikeRate ?? '—'} />
      <LeaderRow label="Best figures" value={bowling.bestFigures ?? '—'} emphasis />
      <LeaderRow label="Maidens" value={bowling.maidens} />
      <LeaderRow label="Five-fors" value={bowling.fiveWicketHauls} />
    </StatCard>
  );
}

function FieldingCard({ fielding }: { fielding: CareerStatsDto['fielding'] }) {
  return (
    <StatCard
      title="Fielding"
      headline={fielding.dismissals}
      headlineLabel="dismissals"
      ink="var(--ink-green)"
    >
      <LeaderRow label="Catches" value={fielding.catches} />
      <LeaderRow label="Run outs" value={fielding.runOuts} />
      <LeaderRow label="Stumpings" value={fielding.stumpings} />
    </StatCard>
  );
}

function StatCard({
  title,
  headline,
  headlineLabel,
  ink,
  children,
}: {
  title: string;
  headline: number;
  headlineLabel: string;
  ink: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-raised p-4" data-ink={ink}>
      <div>
        <h3 className="text-[0.8125rem] font-medium text-muted">{title}</h3>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="score-figure tabular text-[2rem] leading-none">{headline}</span>
          <span className="text-xs text-muted">{headlineLabel}</span>
        </p>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line pt-3 [&_span]:text-[0.8125rem]">
        {children}
      </div>
    </section>
  );
}

function RecentMatches({ matches }: { matches: PlayerProfileDto['recentMatches'] }) {
  if (matches.length === 0) return null;

  return (
    <section>
      <SectionHeading eyebrow="Form guide" title="Recent matches" />
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {matches.map((match, index) => {
          const dismissals = match.catches + match.runOuts + match.stumpings;

          return (
            <li
              key={match.matchId}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-raised p-4"
              style={{ '--delay': `${index * 50}ms` } as CSSProperties}
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-muted">{match.tournamentName}</p>
                <p className="mt-1 truncate text-[0.9375rem] font-semibold">
                  {match.teamName}
                  {match.opponentName ? (
                    <span className="text-muted"> v {match.opponentName}</span>
                  ) : null}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3">
                <Figure
                  label="Bat"
                  value={match.batted ? `${match.runs}${match.isOut ? '' : '*'}` : '—'}
                  note={match.batted ? `${match.ballsFaced} balls` : 'Did not bat'}
                />
                <Figure
                  label="Bowl"
                  value={match.bowled ? `${match.wickets}/${match.runsConceded}` : '—'}
                  note={match.bowled ? `${match.oversBowled} overs` : 'Did not bowl'}
                />
                <Figure
                  label="Field"
                  value={dismissals > 0 ? String(dismissals) : '—'}
                  note="Dismissals"
                />
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="score-figure tabular mt-1 text-xl leading-none">{value}</dd>
      <dd className="mt-1 truncate text-[0.6875rem] text-muted">{note}</dd>
    </div>
  );
}
