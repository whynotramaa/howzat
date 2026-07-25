import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { StandingsRowDto } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { Skeleton } from '@/components/ui/Feedback';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';

interface PublicTournamentResponse {
  tournament: { id: string; name: string; format: string; status: string };
  items: StandingsRowDto[];
  matches: Array<{
    id: string;
    publicSlug: string;
    round: number;
    stage: string;
    status: string;
    scheduledAt: string | null;
    resultText: string | null;
    team1: { id: string; name: string; shortName: string; primaryColor: string };
    team2: { id: string; name: string; shortName: string; primaryColor: string };
  }>;
}

export function PublicTournamentPage() {
  const { tournamentId = '' } = useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'tournament', tournamentId],
    queryFn: () => apiFetch<PublicTournamentResponse>(`/public/tournaments/${tournamentId}/standings`),
  });

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link to="/"><Wordmark size="sm" /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        {isPending ? <Skeleton className="h-80" /> : error ? (
          <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-5 py-4 text-primary">This tournament could not be loaded.</p>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-8">
              <div>
                <p className="eyebrow">Live tournament · {data.tournament.format.replace(/_/g, ' + ').toLowerCase()}</p>
                <h1 className="serif mt-3 text-[2.5rem] text-primary sm:text-[3.5rem]">{data.tournament.name}</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono text-[0.75rem] text-muted">{data.tournament.status.replace(/_/g, ' ')}</span>
                <ShareLink
                  slug={tournamentId}
                  url={`${window.location.origin}/tournament/${tournamentId}`}
                  label="Share tournament"
                  matchLabel={data.tournament.name}
                  variant="quiet"
                />
              </div>
            </div>
            <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
              <div className="border-b border-line px-5 py-4 sm:px-7"><p className="eyebrow">Standings</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead><tr className="border-b border-line">
                    <th className="eyebrow px-5 py-3 text-left">Team</th><th className="eyebrow px-3 py-3 text-center">P</th><th className="eyebrow px-3 py-3 text-center">W</th><th className="eyebrow px-3 py-3 text-center">L</th><th className="eyebrow px-5 py-3 text-right">Pts</th>
                  </tr></thead>
                  <tbody>{data.items.map((row) => <tr key={row.team.id} className="border-b border-line last:border-0">
                    <td className="flex items-center gap-3 px-5 py-4"><span className="mono w-5 text-muted">{row.position}</span><TeamMark shortName={row.team.shortName} color={row.team.primaryColor} size="sm" /><span className="font-medium text-primary">{row.team.name}</span></td>
                    <td className="mono px-3 py-4 text-center text-secondary">{row.played}</td><td className="mono px-3 py-4 text-center text-secondary">{row.won}</td><td className="mono px-3 py-4 text-center text-secondary">{row.lost}</td><td className="mono px-5 py-4 text-right font-medium text-primary">{row.points}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow mb-2">The board</p>
                  <h2 className="serif text-2xl text-primary">Matches</h2>
                </div>
                <p className="mono text-[0.6875rem] text-muted">{data.matches.length} featured</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.matches.map((match) => <PublicMatchCard key={match.id} match={match} />)}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function PublicMatchCard({ match }: { match: PublicTournamentResponse['matches'][number] }) {
  const isLive = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const isCompleted = match.status === 'COMPLETED';
  const statusLabel = isLive ? 'Live now' : isCompleted ? 'Completed' : 'Upcoming';

  return (
    <article className="rounded-[var(--radius-lg)] border border-line bg-raised p-5 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <p className={`eyebrow ${isLive ? 'text-live' : ''}`}>{statusLabel}</p>
        <span className="mono text-[0.6875rem] text-muted">
          {match.stage === 'LEAGUE' ? `Round ${match.round}` : match.stage.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <PublicSide team={match.team1} />
        <span className="mono text-[0.6875rem] text-muted">v</span>
        <PublicSide team={match.team2} align="right" />
      </div>
      {match.resultText ? <p className="serif mt-4 text-lg text-primary">{match.resultText}</p> : null}
      {!match.resultText && match.scheduledAt ? (
        <p className="mono mt-4 text-[0.6875rem] text-muted">
          {new Date(match.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Link
          to={`/live/${match.publicSlug}${isLive ? '' : '?view=scorecard'}`}
          className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-line-strong px-3 text-[0.6875rem] font-medium tracking-[0.08em] text-secondary uppercase transition-colors hover:border-[var(--accent-line)] hover:text-primary"
        >
          {isLive ? 'Open live match' : isCompleted ? 'Open result' : 'Open match'}
        </Link>
      </div>
    </article>
  );
}

function PublicSide({ team, align = 'left' }: { team: PublicTournamentResponse['matches'][number]['team1']; align?: 'left' | 'right' }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
      <span className="truncate text-sm font-medium text-primary">{team.name}</span>
    </span>
  );
}
