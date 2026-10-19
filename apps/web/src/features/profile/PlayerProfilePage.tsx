import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CareerStatsDto, PlayerProfileDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { LeaderRow } from '@/components/ui/Score';
import { useAuth } from '@/features/auth/AuthProvider';

export function PlayerProfilePage() {
  const { username = '' } = useParams();
  const { user } = useAuth();

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
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <>
            <span>@{data.user.username}</span>
            {isSelf ? <Pill tone="accent">You</Pill> : null}
          </>
        }
        title={data.user.name}
        description={describe(data)}
        art={
          <div className="grid place-items-center">
            <PlayerAvatar seed={data.user.username} name={data.user.name} size="xl" className="!size-36" />
          </div>
        }
      />

      <StatStrip
        items={[
          { label: 'Matches', value: career.matches, hint: 'In any squad' },
          { label: 'Runs', value: career.batting.runs, hint: career.batting.average ? `Average ${career.batting.average}` : 'No average yet' },
          { label: 'Wickets', value: career.bowling.wickets, hint: career.bowling.bestFigures ? `Best ${career.bowling.bestFigures}` : 'No figures yet' },
          { label: 'Scored', value: data.matchesScored, hint: `${data.tournamentsOrganized} organised`, tone: 'accent' },
        ]}
      />

      {hasPlayed ? (
        <>
          <section>
            <SectionHeading eyebrow="Career" title="The numbers" description="Every ball faced, bowled and caught across all tournaments." />
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <BattingCard batting={career.batting} />
              <BowlingCard bowling={career.bowling} />
              <FieldingCard fielding={career.fielding} />
            </div>
          </section>

          <RecentMatches matches={data.recentMatches} />
        </>
      ) : (
        <EmptyState
          scene="stumps"
          title="No matches yet"
          description={isSelf ? 'Matches you play in a squad show up here.' : 'Nothing played yet.'}
        />
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
    <StatCard title="Bowling" headline={bowling.wickets} headlineLabel="wickets" ink="var(--ink-red)">
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
    <StatCard title="Fielding" headline={fielding.dismissals} headlineLabel="dismissals" ink="var(--ink-green)">
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
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-[var(--radius-xl)] border border-line bg-raised p-5 pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: ink }} />
      <div>
        <h3 className="serif text-[1.625rem]">{title}</h3>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="score-figure tabular text-[2.75rem] leading-none">{headline}</span>
          <span className="text-xs text-muted">{headlineLabel}</span>
        </p>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-dashed border-line pt-4 [&_span]:text-[0.8125rem]">{children}</div>
    </section>
  );
}

function RecentMatches({ matches }: { matches: PlayerProfileDto['recentMatches'] }) {
  if (matches.length === 0) return null;

  return (
    <section>
      <SectionHeading eyebrow="Form guide" title="Recent matches" />
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {matches.map((match, index) => {
          const dismissals = match.catches + match.runOuts + match.stumpings;

          return (
            <li
              key={match.matchId}
              className="reveal flex flex-col gap-4 rounded-[var(--radius-xl)] border border-line bg-raised p-5"
              style={{ '--delay': `${index * 50}ms` } as CSSProperties}
            >
              <div className="min-w-0">
                <p className="eyebrow truncate">{match.tournamentName}</p>
                <p className="serif mt-2 truncate text-[1.375rem]">
                  {match.teamName}
                  {match.opponentName ? <span className="text-muted"> v {match.opponentName}</span> : null}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-dashed border-line pt-4">
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
                <Figure label="Field" value={dismissals > 0 ? String(dismissals) : '—'} note="Dismissals" />
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
      <dd className="score-figure tabular mt-1.5 text-[1.625rem] leading-none">{value}</dd>
      <dd className="mt-1 truncate text-[0.6875rem] text-muted">{note}</dd>
    </div>
  );
}

function describe(data: PlayerProfileDto): string {
  const { career } = data;
  if (career.matches === 0) return 'Yet to walk out. Matches played in any squad build this page automatically.';
  const parts = [`${career.matches} ${career.matches === 1 ? 'match' : 'matches'} played`];
  if (career.batting.runs > 0) parts.push(`${career.batting.runs} runs`);
  if (career.bowling.wickets > 0) parts.push(`${career.bowling.wickets} wickets`);
  if (career.fielding.dismissals > 0) parts.push(`${career.fielding.dismissals} dismissals in the field`);
  return `${parts.join(', ')}.`;
}
