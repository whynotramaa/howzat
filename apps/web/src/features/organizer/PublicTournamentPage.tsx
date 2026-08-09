import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { StandingsRowDto, TournamentMatchDto, TournamentReportDto } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Skeleton } from '@/components/ui/Feedback';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';

export function PublicTournamentPage() {
  const { tournamentId = '' } = useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'tournament', tournamentId],
    queryFn: () => apiFetch<TournamentReportDto>(`/public/tournaments/${tournamentId}/standings`),
  });

  const isFootball = data?.tournament.sport === 'FOOTBALL';

  const results = data?.matches.filter((match) =>
    ['COMPLETED', 'ABANDONED'].includes(match.status),
  );
  const live = data?.matches.filter((match) => ['LIVE', 'INNINGS_BREAK'].includes(match.status));
  const upcoming = data?.matches.filter((match) => ['SCHEDULED', 'TOSS'].includes(match.status));

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link to="/">
            <Wordmark size="sm" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-10 sm:px-8 sm:py-14">
        {isPending ? (
          <Skeleton className="h-80" />
        ) : error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-5 py-4 text-primary"
          >
            This tournament could not be loaded.
          </p>
        ) : data ? (
          <>
            <div className="flex flex-col gap-8 border-b border-line pb-9">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div className="min-w-0">
                  <p className="eyebrow">
                    Live {isFootball ? 'football' : 'cricket'} ·{' '}
                    {data.tournament.format.replace(/_/g, ' + ').toLowerCase()}
                  </p>
                  <h1 className="serif mt-3 text-[2.5rem] text-primary sm:text-[3.5rem]">
                    {data.tournament.name}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="mono text-[0.75rem] text-muted">
                    {data.tournament.status.replace(/_/g, ' ')}
                  </span>
                  <ShareLink
                    slug={tournamentId}
                    url={`${window.location.origin}/tournament/${tournamentId}`}
                    label="Share tournament"
                    matchLabel={data.tournament.name}
                    variant="quiet"
                  />
                  <PdfButton
                    build={() =>
                      import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))
                    }
                  />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                <Figure label="Sides" value={data.items.length} />
                <Figure label="Played" value={`${data.totals.completed}/${data.totals.total}`} />
                <Figure
                  label="Live now"
                  value={data.totals.live}
                  tone={data.totals.live > 0 ? 'live' : undefined}
                />
                <Figure label="To come" value={data.totals.upcoming} />
              </dl>
            </div>

            <Standings items={data.items} isFootball={Boolean(isFootball)} />

            {live && live.length > 0 ? (
              <MatchBand
                eyebrow="Being played now"
                title="Live"
                matches={live}
                isFootball={Boolean(isFootball)}
              />
            ) : null}

            <MatchBand
              eyebrow="What happened"
              title="Results"
              matches={results ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="Nothing has been played yet."
            />

            <MatchBand
              eyebrow="Still to play"
              title="Fixtures"
              matches={upcoming ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="Every fixture in this tournament has been played."
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: 'live' }) {
  return (
    <div>
      <dd
        className={cn(
          'mono text-[1.5rem] leading-none font-medium',
          tone === 'live' ? 'text-live' : 'text-primary',
        )}
      >
        {value}
      </dd>
      <dt className="eyebrow mt-2.5">{label}</dt>
    </div>
  );
}

function Standings({ items, isFootball }: { items: StandingsRowDto[]; isFootball: boolean }) {
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
      <div className="flex items-end justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
        <div>
          <p className="eyebrow">Standings</p>
          <h2 className="serif mt-1.5 text-xl text-primary">Points table</h2>
        </div>
        <p className="mono text-[0.6875rem] text-muted">
          {isFootball ? '3 for a win, 1 for a draw' : '2 for a win, 1 for a tie'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-5 py-3 text-left">Team</th>
              <th className="eyebrow px-3 py-3 text-center">P</th>
              <th className="eyebrow px-3 py-3 text-center">W</th>
              <th className="eyebrow px-3 py-3 text-center">{isFootball ? 'D' : 'L'}</th>
              <th className="eyebrow px-3 py-3 text-center">{isFootball ? 'L' : 'T'}</th>
              {isFootball ? null : <th className="eyebrow px-3 py-3 text-center">NR</th>}
              <th className="eyebrow hidden px-3 py-3 text-right lg:table-cell">
                {isFootball ? 'GF' : 'For'}
              </th>
              <th className="eyebrow hidden px-3 py-3 text-right lg:table-cell">
                {isFootball ? 'GA' : 'Against'}
              </th>
              <th className="eyebrow px-3 py-3 text-right">{isFootball ? 'GD' : 'NRR'}</th>
              <th className="eyebrow px-5 py-3 text-right">Pts</th>
            </tr>
          </thead>

          <tbody>
            {items.map((row) => {
              const margin = isFootball ? row.goalDifference : row.nrr;

              return (
                <tr key={row.team.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="mono w-5 text-muted">{row.position}</span>
                      <TeamMark
                        shortName={row.team.shortName}
                        color={row.team.primaryColor}
                        size="sm"
                      />
                      <span className="font-medium text-primary">{row.team.name}</span>
                    </div>
                  </td>
                  <td className="mono px-3 py-4 text-center text-secondary">{row.played}</td>
                  <td className="mono px-3 py-4 text-center text-secondary">{row.won}</td>
                  <td className="mono px-3 py-4 text-center text-secondary">
                    {isFootball ? row.tied : row.lost}
                  </td>
                  <td className="mono px-3 py-4 text-center text-secondary">
                    {isFootball ? row.lost : row.tied}
                  </td>
                  {isFootball ? null : (
                    <td className="mono px-3 py-4 text-center text-secondary">{row.noResult}</td>
                  )}
                  <td className="mono hidden px-3 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsFor : `${row.runsScored}/${row.oversFaced}`}
                  </td>
                  <td className="mono hidden px-3 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsAgainst : `${row.runsConceded}/${row.oversBowled}`}
                  </td>
                  <td
                    className={cn(
                      'mono px-3 py-4 text-right',
                      margin > 0 ? 'text-success' : margin < 0 ? 'text-alert' : 'text-secondary',
                    )}
                  >
                    {isFootball ? row.goalDifferenceText : row.nrrText}
                  </td>
                  <td className="mono px-5 py-4 text-right font-medium text-primary">
                    {row.points}
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

function MatchBand({
  eyebrow,
  title,
  matches,
  isFootball,
  emptyMessage,
}: {
  eyebrow: string;
  title: string;
  matches: TournamentMatchDto[];
  isFootball: boolean;
  emptyMessage?: string;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h2 className="serif text-2xl text-primary">{title}</h2>
        </div>
        <p className="mono text-[0.6875rem] text-muted">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="text-[0.9375rem] text-muted">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {matches.map((match) => (
            <PublicMatchCard key={match.id} match={match} isFootball={isFootball} />
          ))}
        </div>
      )}
    </section>
  );
}

function PublicMatchCard({
  match,
  isFootball,
}: {
  match: TournamentMatchDto;
  isFootball: boolean;
}) {
  const isLive = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const isCompleted = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const statusLabel = isLive
    ? match.status === 'INNINGS_BREAK'
      ? 'Interval'
      : 'Live now'
    : isCompleted
      ? match.status === 'ABANDONED'
        ? 'Abandoned'
        : 'Completed'
      : 'Upcoming';

  return (
    <article className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-raised p-5 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('eyebrow', isLive && 'text-live')}>{statusLabel}</p>
        <span className="mono text-[0.6875rem] text-muted">
          {match.stage === 'LEAGUE' ? `Round ${match.round}` : match.stage.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <SideRow
          team={match.team1}
          score={match.score?.team1 ?? null}
          isWinner={match.winnerTeamId !== null && match.winnerTeamId === match.team1?.id}
          dimmed={match.winnerTeamId !== null && match.winnerTeamId !== match.team1?.id}
          isFootball={isFootball}
        />
        <SideRow
          team={match.team2}
          score={match.score?.team2 ?? null}
          isWinner={match.winnerTeamId !== null && match.winnerTeamId === match.team2?.id}
          dimmed={match.winnerTeamId !== null && match.winnerTeamId !== match.team2?.id}
          isFootball={isFootball}
        />
      </div>

      {match.resultText ? (
        <p className="mt-4 text-[0.9375rem] text-success">{match.resultText}</p>
      ) : null}

      {!match.resultText && match.scheduledAt ? (
        <p className="mono mt-4 text-[0.6875rem] text-muted">
          {new Date(match.scheduledAt).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          {match.venue ? ` · ${match.venue}` : ''}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Link
          to={`/live/${match.publicSlug}${isCompleted && !isFootball ? '?view=scorecard' : ''}`}
          className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-line-strong px-3 text-[0.6875rem] font-medium tracking-[0.08em] text-secondary uppercase transition-colors hover:border-[var(--accent-line)] hover:text-primary"
        >
          {isLive ? 'Open live match' : isCompleted ? 'Open result' : 'Open match'}
        </Link>

        {isCompleted ? (
          <PdfButton
            variant="quiet"
            build={() =>
              import('@/lib/pdf').then((pdf) =>
                isFootball
                  ? pdf.buildFootballMatchPdf(match.publicSlug)
                  : pdf.buildCricketMatchPdf(match.publicSlug),
              )
            }
          />
        ) : null}
      </div>
    </article>
  );
}

function SideRow({
  team,
  score,
  isWinner,
  dimmed,
  isFootball,
}: {
  team: TournamentMatchDto['team1'];
  score: string | null;
  isWinner: boolean;
  dimmed: boolean;
  isFootball: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {team ? (
        <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
      ) : (
        <span
          aria-hidden
          className="size-7 rounded-[var(--radius-xs)] border border-dashed border-line-strong"
        />
      )}

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-medium',
          dimmed ? 'text-secondary' : 'text-primary',
        )}
      >
        {team?.name ?? 'To be decided'}
        {isWinner ? <span className="ml-2 text-[0.6875rem] text-success">won</span> : null}
      </span>

      <span
        className={cn(
          'mono shrink-0 tabular-nums',
          isFootball ? 'text-lg font-medium' : 'text-[0.8125rem]',
          score === null ? 'text-muted' : dimmed ? 'text-secondary' : 'text-primary',
        )}
      >
        {score ?? '—'}
      </span>
    </div>
  );
}
