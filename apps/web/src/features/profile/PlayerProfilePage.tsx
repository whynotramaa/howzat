import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CareerStatsDto, PlayerProfileDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/Card';
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full bg-inverse text-base font-semibold text-on-inverse"
          >
            {data.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-[-0.02em]">{data.user.name}</h1>
            <p className="text-xs text-muted">@{data.user.username}</p>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
        <Tally label="Matches" value={career.matches} />
        <Tally label="Organized" value={data.tournamentsOrganized} />
        <Tally label="Scored" value={data.matchesScored} />
      </dl>

      {hasPlayed ? (
        <>
          <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised lg:grid-cols-3">
            <BattingCard batting={career.batting} />
            <BowlingCard bowling={career.bowling} />
            <FieldingCard fielding={career.fielding} />
          </div>

          <RecentMatches matches={data.recentMatches} />
        </>
      ) : (
        <EmptyState
          title="No matches yet"
          description={isSelf ? 'Matches you play in a squad show up here.' : 'Nothing played yet.'}
        />
      )}
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 border-line px-4 py-3 not-first:border-l">
      <dt className="eyebrow">{label}</dt>
      <dd className="tabular text-xl font-semibold tracking-[-0.03em]">{value}</dd>
    </div>
  );
}

function BattingCard({ batting }: { batting: CareerStatsDto['batting'] }) {
  return (
    <StatCard title="Batting" headline={batting.runs} headlineLabel="runs">
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
    <StatCard title="Bowling" headline={bowling.wickets} headlineLabel="wickets">
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
    <StatCard title="Fielding" headline={fielding.dismissals} headlineLabel="dismissals">
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
  children,
}: {
  title: string;
  headline: number;
  headlineLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-line p-4 not-last:border-b lg:not-last:border-r lg:not-last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.8125rem] font-semibold">{title}</h2>
        <p className="tabular text-2xl font-semibold tracking-[-0.04em]">
          {headline}{' '}
          <span className="text-xs font-normal tracking-normal text-muted">{headlineLabel}</span>
        </p>
      </div>
      <div className="flex flex-col gap-1.5 [&_span]:text-[0.8125rem]">{children}</div>
    </section>
  );
}

function RecentMatches({ matches }: { matches: PlayerProfileDto['recentMatches'] }) {
  if (matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.8125rem] font-semibold">Recent</h2>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
        <table className="w-full min-w-[34rem] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line bg-sunken">
              <th scope="col" className="eyebrow px-4 py-2 text-left font-medium">
                Match
              </th>
              <th scope="col" className="eyebrow px-5 py-2 text-right font-medium">
                Batting
              </th>
              <th scope="col" className="eyebrow px-5 py-2 text-right font-medium">
                Bowling
              </th>
              <th scope="col" className="eyebrow px-4 py-2 text-right font-medium">
                Fielding
              </th>
            </tr>
          </thead>

          <tbody>
            {matches.map((match) => {
              const dismissals = match.catches + match.runOuts + match.stumpings;

              return (
                <tr
                  key={match.matchId}
                  className="border-b border-line transition-colors last:border-0 hover:bg-hover"
                >
                  <td className="px-4 py-2">
                    <p className="font-medium">
                      {match.teamName}
                      {match.opponentName ? (
                        <span className="text-muted"> v {match.opponentName}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">{match.tournamentName}</p>
                  </td>

                  <td className="tabular px-5 py-2 text-right text-primary">
                    {match.batted
                      ? `${match.runs}${match.isOut ? '' : '*'} (${match.ballsFaced})`
                      : '—'}
                  </td>

                  <td className="tabular px-5 py-2 text-right text-primary">
                    {match.bowled
                      ? `${match.wickets}/${match.runsConceded} (${match.oversBowled})`
                      : '—'}
                  </td>

                  <td className="tabular px-4 py-2 text-right text-primary">
                    {dismissals > 0 ? dismissals : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
