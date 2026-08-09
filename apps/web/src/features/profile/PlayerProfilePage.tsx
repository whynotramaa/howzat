import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CareerStatsDto, PlayerProfileDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { Card, CardBody, CardHeader, EmptyState, SectionHeading } from '@/components/ui/Card';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { LeaderRow } from '@/components/ui/Score';
import { Reveal } from '@/components/ui/Reveal';
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
      <header className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
          <div className="flex items-center gap-5">
            <span
              aria-hidden
              className="serif grid size-16 shrink-0 place-items-center rounded-full border border-[var(--accent-line)] text-2xl text-primary"
            >
              {data.user.name.slice(0, 1).toUpperCase()}
            </span>

            <div className="min-w-0">
              <p className="eyebrow">{isSelf ? 'Your record' : 'Player record'}</p>
              <h1 className="serif mt-2.5 text-[2.25rem] text-primary sm:text-[2.75rem]">
                {data.user.name}
              </h1>
              <p className="mono mt-1.5 text-[0.8125rem] text-muted">@{data.user.username}</p>
            </div>
          </div>

          <dl className="flex gap-10">
            <Tally label="Matches" value={career.matches} />
            <Tally label="Organized" value={data.tournamentsOrganized} />
            <Tally label="Scored" value={data.matchesScored} />
          </dl>
        </div>

        <div className="rule" />
      </header>

      {hasPlayed ? (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Reveal index={0}>
              <BattingCard batting={career.batting} />
            </Reveal>
            <Reveal index={1}>
              <BowlingCard bowling={career.bowling} />
            </Reveal>
            <Reveal index={2}>
              <FieldingCard fielding={career.fielding} />
            </Reveal>
          </div>

          <RecentMatches matches={data.recentMatches} />
        </>
      ) : (
        <EmptyState
          title="No innings on the record yet"
          description={
            isSelf
              ? 'Once an organizer adds you to a squad by your username, every match you play lands here.'
              : `${data.user.name} hasn't played a completed match on Howzat yet.`
          }
        />
      )}
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="mono text-[1.75rem] leading-none font-medium text-primary">{value}</dd>
      <dt className="eyebrow mt-2.5">{label}</dt>
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
    <Card className="h-full">
      <CardHeader className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="score-figure mt-3 text-[2.5rem] text-primary">{headline}</p>
          <p className="mt-1 text-[0.8125rem] text-muted">{headlineLabel}</p>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-3">{children}</CardBody>
    </Card>
  );
}

function RecentMatches({ matches }: { matches: PlayerProfileDto['recentMatches'] }) {
  if (matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-7">
      <SectionHeading eyebrow="Match log" title="Recent matches" />

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow px-6 py-3.5 text-left font-medium">
                Match
              </th>
              <th scope="col" className="eyebrow px-5 py-3.5 text-right font-medium">
                Batting
              </th>
              <th scope="col" className="eyebrow px-5 py-3.5 text-right font-medium">
                Bowling
              </th>
              <th scope="col" className="eyebrow px-6 py-3.5 text-right font-medium">
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
                  className="border-b border-line transition-colors last:border-0 hover:bg-hover/50"
                >
                  <td className="px-6 py-4">
                    <p className="text-primary">
                      {match.teamName}
                      {match.opponentName ? (
                        <span className="text-muted"> v {match.opponentName}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] tracking-[0.06em] text-muted uppercase">
                      {match.tournamentName}
                    </p>
                  </td>

                  <td className="mono px-5 py-4 text-right text-primary">
                    {match.batted
                      ? `${match.runs}${match.isOut ? '' : '*'} (${match.ballsFaced})`
                      : '—'}
                  </td>

                  <td className="mono px-5 py-4 text-right text-primary">
                    {match.bowled
                      ? `${match.wickets}/${match.runsConceded} (${match.oversBowled})`
                      : '—'}
                  </td>

                  <td className="mono px-6 py-4 text-right text-primary">
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
