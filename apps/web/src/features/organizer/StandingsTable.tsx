import { useQuery } from '@tanstack/react-query';
import type { Sport, StandingsRowDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Table, Td, Th } from '@/components/ui/Table';
import { cn } from '@/lib/cn';

/**
 * The points table, for either code.
 *
 * Set as a ruled ledger rather than a striped grid: hairlines between rows, no
 * fills, figures in mono so the columns line up down the page. The tie-breaker
 * keeps its sign — net run rate in cricket, goal difference in football —
 * because a −0.42 and a 0.42, or a −3 and a +3, are the difference between
 * qualifying and going home.
 *
 * The inputs behind that number are shown on the wide layout on purpose. Every
 * disputed table in club sport is a disputed tie-breaker, and the argument ends
 * the moment the runs and overs, or the goals for and against, are on the same
 * screen as the number they produced.
 *
 * One table rather than two: eight of the eleven columns are identical in both
 * codes, and the three that are not are the last three.
 */
export function StandingsTable({
  tournamentId,
  sport = 'CRICKET',
}: {
  tournamentId: string;
  sport?: Sport;
}) {
  const { data, isPending, error } = useQuery({
    queryKey: ['tournaments', tournamentId, 'standings'],
    queryFn: () => api.get<{ items: StandingsRowDto[] }>(`/tournaments/${tournamentId}/standings`),
    enabled: Boolean(tournamentId),
  });

  if (isPending) return <Skeleton className="h-64" />;
  if (error) return <ErrorText error={error} />;
  if (!data || data.items.length === 0) return null;

  const isFootball = sport === 'FOOTBALL';

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
      <Table className="min-w-[46rem]">
        <thead>
          <tr className="border-b border-line">
            <Th className="w-12">#</Th>
            <Th align="left">Side</Th>
            <Th>P</Th>
            <Th>W</Th>
            <Th>{isFootball ? 'D' : 'L'}</Th>
            <Th>{isFootball ? 'L' : 'T'}</Th>
            {isFootball ? null : <Th>NR</Th>}
            <Th align="right">Pts</Th>
            <Th align="right">{isFootball ? 'GD' : 'NRR'}</Th>
            <Th align="right" className="hidden lg:table-cell">
              {isFootball ? 'GF' : 'For'}
            </Th>
            <Th align="right" className="hidden lg:table-cell">
              {isFootball ? 'GA' : 'Against'}
            </Th>
          </tr>
        </thead>

        <tbody>
          {data.items.map((row) => {
            // The signed figure that decides the order, whichever code it is.
            const margin = isFootball ? row.goalDifference : row.nrr;

            return (
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
                {/* Football reads W-D-L; cricket reads W-L-T-NR. Same two
                    columns, swapped, because that is the order each sport's
                    readers expect to find them in. */}
                <Td>{isFootball ? row.tied : row.lost}</Td>
                <Td>{isFootball ? row.lost : row.tied}</Td>
                {isFootball ? null : <Td>{row.noResult}</Td>}

                <Td align="right" emphasis>
                  {row.points}
                </Td>

                <td
                  className={cn(
                    'mono px-4 py-4 text-right',
                    margin > 0 ? 'text-success' : margin < 0 ? 'text-alert' : 'text-secondary',
                  )}
                >
                  {isFootball ? row.goalDifferenceText : row.nrrText}
                </td>

                <td className="mono hidden px-4 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                  {isFootball ? row.goalsFor : `${row.runsScored}/${row.oversFaced}`}
                </td>
                <td className="mono hidden px-4 py-4 text-right text-[0.8125rem] text-muted lg:table-cell">
                  {isFootball ? row.goalsAgainst : `${row.runsConceded}/${row.oversBowled}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
