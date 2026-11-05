import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { StandingsRowDto, TournamentMatchDto, TournamentReportDto } from '@howzat/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { TeamMark } from '@/components/ui/Pill';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { MatchCard, type MatchSide } from '@/components/ui/MatchCard';
import { SketchDefs, SportGlyph } from '@/components/ui/Sketch';
import { stageLabel } from '@/lib/pdf/sources';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Skeleton } from '@/components/ui/Feedback';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';

export function PublicTournamentPage() {
  const { tournamentId = '' } = useParams();
  const { data, isPending, error, refetch } = useQuery({
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
      <SketchDefs />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 py-10 sm:px-8 sm:py-14">
        {isPending ? (
          <Skeleton className="h-80" />
        ) : error ? (
          <EmptyState
            scene="trophy"
            title="This tournament could not be loaded"
            description={
              error instanceof ApiError && error.status === 404
                ? 'Check the tournament link.'
                : 'Check your connection and retry.'
            }
            action={
              <button
                type="button"
                onClick={() => void refetch()}
                className="min-h-11 rounded-md border border-line-strong px-5 text-sm font-medium"
              >
                Retry
              </button>
            }
          />
        ) : data ? (
          <>
            <PageHeader
              eyebrow={
                <>
                  <span>{isFootball ? 'Football' : 'Cricket'}</span>
                  <span>{FORMAT_LABELS[data.tournament.format]}</span>
                  <span>{data.items.length} teams</span>
                </>
              }
              title={data.tournament.name}
              art={
                <div className="grid place-items-center">
                  <SportGlyph sport={data.tournament.sport} className="!size-36" />
                </div>
              }
              actions={
                <>
                  <ShareLink
                    slug={tournamentId}
                    url={`${window.location.origin}/tournament/${tournamentId}`}
                    label="Share tournament"
                    matchLabel={data.tournament.name}
                    variant="secondary"
                  />
                  <PdfButton
                    build={() =>
                      import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))
                    }
                  />
                </>
              }
            />

            <StatStrip
              items={[
                { label: 'Teams', value: data.items.length },
                { label: 'Played', value: `${data.totals.completed}/${data.totals.total}` },
                {
                  label: 'Live now',
                  value: data.totals.live,
                  tone: data.totals.live > 0 ? 'live' : 'default',
                },
                { label: 'Still to play', value: data.totals.upcoming },
              ]}
            />

            {live && live.length > 0 ? (
              <MatchBand
                eyebrow="Happening now"
                title="Live"
                matches={live}
                isFootball={Boolean(isFootball)}
              />
            ) : null}

            <Standings items={data.items} isFootball={Boolean(isFootball)} />

            <MatchBand
              eyebrow="Final word"
              title="Results"
              matches={results ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="No results yet. Finished matches land here with the scorecard."
            />

            <MatchBand
              eyebrow="Still to come"
              title="Fixtures"
              matches={upcoming ?? []}
              isFootball={Boolean(isFootball)}
              emptyMessage="Every fixture has been played."
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League and playoffs',
} as const;

function Standings({ items, isFootball }: { items: StandingsRowDto[]; isFootball: boolean }) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeading eyebrow="Standings" title="The table" />
      <div
        role="region"
        aria-label="Standings"
        tabIndex={0}
        className="mt-6 overflow-x-auto rounded-[var(--radius-xl)] border border-line bg-raised"
      >
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="eyebrow px-4 py-2 text-left">
                Team
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-center">
                P
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-center">
                W
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-center">
                {isFootball ? 'D' : 'L'}
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-center">
                {isFootball ? 'L' : 'T'}
              </th>
              {isFootball ? null : (
                <th scope="col" className="eyebrow px-3 py-2 text-center">
                  NR
                </th>
              )}
              <th scope="col" className="eyebrow px-4 py-2 text-right">
                Pts
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                {isFootball ? 'GD' : 'NRR'}
              </th>
              <th scope="col" className="eyebrow hidden px-3 py-2 text-right lg:table-cell">
                {isFootball ? 'GF' : 'For'}
              </th>
              <th scope="col" className="eyebrow hidden px-3 py-2 text-right lg:table-cell">
                {isFootball ? 'GA' : 'Against'}
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((row) => {
              const margin = isFootball ? row.goalDifference : row.nrr;

              return (
                <tr key={row.team.id} className="border-b border-line last:border-0 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'score-figure tabular grid size-7 shrink-0 place-items-center rounded-full text-sm',
                          row.position === 1
                            ? 'bg-[var(--ink-amber)] text-[#191917]'
                            : 'bg-sunken text-secondary',
                        )}
                      >
                        {row.position}
                      </span>
                      <TeamMark
                        shortName={row.team.shortName}
                        color={row.team.primaryColor}
                        size="md"
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
                  <td className="mono px-4 py-2 text-right font-semibold text-primary">
                    {row.points}
                  </td>
                  <td
                    className={cn(
                      'mono px-3 py-2 text-right',
                      margin > 0 ? 'text-success' : margin < 0 ? 'text-alert' : 'text-secondary',
                    )}
                  >
                    {isFootball ? row.goalDifferenceText : row.nrrText}
                  </td>
                  <td className="mono hidden px-3 py-2 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsFor : `${row.runsScored}/${row.oversFaced}`}
                  </td>
                  <td className="mono hidden px-3 py-2 text-right text-[0.8125rem] text-muted lg:table-cell">
                    {isFootball ? row.goalsAgainst : `${row.runsConceded}/${row.oversBowled}`}
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
    <section>
      <SectionHeading eyebrow={`${eyebrow} · ${matches.length}`} title={title} />

      {matches.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-xl)] border border-dashed border-line-strong px-4 py-8 text-center text-xs text-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {matches.map((match, index) => (
            <PublicMatchCard key={match.id} match={match} index={index} isFootball={isFootball} />
          ))}
        </div>
      )}
    </section>
  );
}

function PublicMatchCard({
  match,
  index,
  isFootball,
}: {
  match: TournamentMatchDto;
  index: number;
  isFootball: boolean;
}) {
  const isCompleted = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const to = `/live/${match.publicSlug}${isCompleted && !isFootball ? '?view=scorecard' : ''}`;
  const side = (
    team: TournamentMatchDto['team1'],
    score: string | null | undefined,
  ): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          score: score ?? undefined,
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;

  return (
    <MatchCard
      className="reveal"
      style={{ '--delay': `${index * 50}ms` } as CSSProperties}
      eyebrow={stageLabel(match.stage, match.round)}
      status={match.status}
      home={side(match.team1, match.score?.team1)}
      away={side(match.team2, match.score?.team2)}
      result={match.resultText}
      to={to}
      meta={
        match.scheduledAt
          ? [
              new Date(match.scheduledAt).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              match.venue,
            ]
              .filter(Boolean)
              .join(' · ')
          : (match.venue ?? 'Date to be set')
      }
      actions={
        isCompleted ? (
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
        ) : null
      }
    />
  );
}
