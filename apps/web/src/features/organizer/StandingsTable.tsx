import { useQuery } from '@tanstack/react-query';
import type { StandingsRowDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';

/**
 * The points table.
 *
 * Set as a ruled ledger rather than a striped grid: hairlines between rows, no
 * fills, figures in mono so the columns line up down the page. Net run rate keeps
 * its sign, because a −0.42 and a 0.42 are the difference between qualifying and
 * going home.
 *
 * The NRR inputs are shown on the wide layout on purpose. Every disputed table in
 * club cricket is a disputed net run rate, and the argument ends the moment the
 * runs and overs behind the number are on the same screen.
 */
export function StandingsTable({ tournamentId }: { tournamentId: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['tournaments', tournamentId, 'standings'],
    queryFn: () => api.get<{ items: StandingsRowDto[] }>(`/tournaments/${tournamentId}/standings`),
    enabled: Boolean(tournamentId),
  });

  if (isPending) return <Skeleton className="h-64" />;
  if (error) return <ErrorText error={error} />;
  if (!data || data.items.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th className="w-12 text-center">#</Th>
            <Th className="text-left">Side</Th>
            <Th>P</Th>
            <Th>W</Th>
            <Th>L</Th>
            <Th>T</Th>
            <Th>NR</Th>
            <Th className="text-right">Pts</Th>
            <Th className="text-right">NRR</Th>
            <Th className="hidden text-right lg:table-cell">For</Th>
            <Th className="hidden text-right lg:table-cell">Against</Th>
          </tr>
        </thead>

        <tbody>
          {data.items.map((row) => (
            <tr
              key={row.team.id}
              className="border-b border-line transition-colors last:border-0 hover:bg-hover/50"
            >
              <td className="mono px-4 py-4 text-center text-[0.8125rem] text-muted">
                {row.position}
              </td>

              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <TeamMark
                    shortName={row.team.shortName}
                    color={row.team.primaryColor}
                    size="sm"
                  />
                  <span className="font-medium text-primary">{row.team.name}</span>
                </div>
              </td>

              <Td>{row.played}</Td>
              <Td>{row.won}</Td>
              <Td>{row.lost}</Td>
              <Td>{row.tied}</Td>
              <Td>{row.noResult}</Td>

              <td className="mono px-4 py-4 text-right font-medium text-primary">{row.points}</td>

              <td
                className={cn(
                  'mono px-4 py-4 text-right',
                  row.nrr > 0 ? 'text-success' : row.nrr < 0 ? 'text-alert' : 'text-secondary',
                )}
              >
                {row.nrrText}
              </td>

              <td className="mono hidden px-4 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                {row.runsScored}/{row.oversFaced}
              </td>
              <td className="mono hidden px-4 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                {row.runsConceded}/{row.oversBowled}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'eyebrow px-4 py-3.5 text-center font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="mono px-4 py-4 text-center text-secondary">{children}</td>;
}
