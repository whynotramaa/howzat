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
      <header className="app-topbar border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link to="/">
            <Wordmark size="sm" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8">
        {isPending ? (
          <Skeleton className="h-80" />
        ) : error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-alert-soft px-4 py-2 text-[0.8125rem] text-alert"
          >
            This tournament could not be loaded.
          </p>
        ) : data ? (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="serif text-[2.5rem] leading-[1.05]">
                    {data.tournament.name}
                  </h1>
                  <p className="text-xs text-muted capitalize">
                    {isFootball ? 'Football' : 'Cricket'} ·{' '}
                    {data.tournament.format.replace(/_/g, ' + ').toLowerCase()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
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

              <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised sm:grid-cols-4">
                <Figure label="Teams" value={data.items.length} />
                <Figure label="Played" value={`${data.totals.completed}/${data.totals.total}`} />
                <Figure
                  label="Live"
                  value={data.totals.live}
                  tone={data.totals.live > 0 ? 'live' : undefined}
                />
                <Figure label="Upcoming" value={data.totals.upcoming} />
              </dl>
            </div>

            <Standings items={data.items} isFootball={Boolean(isFootball)} />

            {live && live.length > 0 ? (
              <MatchBand title="Live" matches={live} isFootball={Boolean(isFootball)} />
            ) : null}

            <MatchBand
              title="Results"
              matches={results ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="No results yet"
            />

            <MatchBand
              title="Fixtures"
              matches={upcoming ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="No fixtures left"
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: 'live' }) {
  return (
    <div className="flex flex-col gap-0.5 border-line px-4 py-3 not-first:border-l max-sm:nth-3:border-l-0 max-sm:nth-[n+3]:border-t">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          'tabular text-xl font-semibold tracking-[-0.03em]',
          tone === 'live' && 'text-accent',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Standings({ items, isFootball }: { items: StandingsRowDto[]; isFootball: boolean }) {
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <h2 className="text-[0.8125rem] font-semibold">Table</h2>
        <p className="text-xs text-muted">
          {isFootball ? '3 for a win, 1 for a draw' : '2 for a win, 1 for a tie'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line-strong">
              <th className="eyebrow px-4 py-2 text-left">Team</th>
              <th className="eyebrow px-3 py-2 text-center">P</th>
              <th className="eyebrow px-3 py-2 text-center">W</th>
              <th className="eyebrow px-3 py-2 text-center">{isFootball ? 'D' : 'L'}</th>
              <th className="eyebrow px-3 py-2 text-center">{isFootball ? 'L' : 'T'}</th>
              {isFootball ? null : <th className="eyebrow px-3 py-2 text-center">NR</th>}
              <th className="eyebrow hidden px-3 py-2 text-right lg:table-cell">
                {isFootball ? 'GF' : 'For'}
              </th>
              <th className="eyebrow hidden px-3 py-2 text-right lg:table-cell">
                {isFootball ? 'GA' : 'Against'}
              </th>
              <th className="eyebrow px-3 py-2 text-right">{isFootball ? 'GD' : 'NRR'}</th>
              <th className="eyebrow px-4 py-2 text-right">Pts</th>
            </tr>
          </thead>

          <tbody>
            {items.map((row) => {
              const margin = isFootball ? row.goalDifference : row.nrr;

              return (
                <tr key={row.team.id} className="border-b border-line last:border-0 hover:bg-hover">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular w-4 text-xs text-muted">{row.position}</span>
                      <TeamMark
                        shortName={row.team.shortName}
                        color={row.team.primaryColor}
                        size="sm"
                      />
                      <span className="font-medium text-primary">{row.team.name}</span>
                    </div>
                  </td>
                  <td className="mono px-3 py-2 text-center text-secondary">{row.played}</td>
                  <td className="mono px-3 py-2 text-center text-secondary">{row.won}</td>
                  <td className="mono px-3 py-2 text-center text-secondary">
                    {isFootball ? row.tied : row.lost}
                  </td>
                  <td className="mono px-3 py-2 text-center text-secondary">
                    {isFootball ? row.lost : row.tied}
                  </td>
                  {isFootball ? null : (
                    <td className="mono px-3 py-2 text-center text-secondary">{row.noResult}</td>
                  )}
                  <td className="mono hidden px-3 py-2 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsFor : `${row.runsScored}/${row.oversFaced}`}
                  </td>
                  <td className="mono hidden px-3 py-2 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsAgainst : `${row.runsConceded}/${row.oversBowled}`}
                  </td>
                  <td
                    className={cn(
                      'mono px-3 py-2 text-right',
                      margin > 0 ? 'text-success' : margin < 0 ? 'text-alert' : 'text-secondary',
                    )}
                  >
                    {isFootball ? row.goalDifferenceText : row.nrrText}
                  </td>
                  <td className="mono px-4 py-2 text-right font-semibold text-primary">
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
  title,
  matches,
  isFootball,
  emptyMessage,
}: {
  title: string;
  matches: TournamentMatchDto[];
  isFootball: boolean;
  emptyMessage?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.8125rem] font-semibold">{title}</h2>
        <span className="tabular text-xs text-muted">{matches.length}</span>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
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
      : 'Live'
    : isCompleted
      ? match.status === 'ABANDONED'
        ? 'Abandoned'
        : 'Result'
      : 'Upcoming';

  return (
    <article className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-raised p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('eyebrow flex items-center gap-1.5', isLive && 'text-accent')}>
          {isLive ? <span className="live-dot" /> : null}
          {statusLabel}
        </p>
        <span className="tabular text-xs text-muted">
          {match.stage === 'LEAGUE' ? `Round ${match.round}` : match.stage.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
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

      {match.resultText ? <p className="mt-3 text-xs text-secondary">{match.resultText}</p> : null}

      {!match.resultText && match.scheduledAt ? (
        <p className="tabular mt-3 text-xs text-muted">
          {new Date(match.scheduledAt).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          {match.venue ? ` · ${match.venue}` : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        <Link
          to={`/live/${match.publicSlug}${isCompleted && !isFootball ? '?view=scorecard' : ''}`}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-line px-3 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary"
        >
          {isLive ? 'Watch' : isCompleted ? 'Scorecard' : 'Open'}
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
          className="size-6 rounded-[var(--radius-sm)] border border-dashed border-line-strong"
        />
      )}

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[0.8125rem] font-medium',
          dimmed ? 'text-secondary' : 'text-primary',
        )}
      >
        {team?.name ?? 'TBD'}
        {isWinner ? <span className="ml-2 text-[0.6875rem] text-success">won</span> : null}
      </span>

      <span
        className={cn(
          'tabular shrink-0',
          isFootball ? 'text-base font-semibold' : 'text-[0.8125rem] font-medium',
          score === null ? 'text-muted' : dimmed ? 'text-secondary' : 'text-primary',
        )}
      >
        {score ?? '—'}
      </span>
    </div>
  );
}
