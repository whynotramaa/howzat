import { useQuery } from '@tanstack/react-query';
import type { Sport, StandingsRowDto } from '@howzat/shared';
import { api } from '@/lib/api';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Table, Td, Th } from '@/components/ui/Table';
import { cn } from '@/lib/cn';

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
      <Table className="min-w-[30rem]">
        <thead>
          <tr className="border-b border-line-strong">
            <Th className="w-8">#</Th>
            <Th align="left">Team</Th>
            <Th>P</Th>
            <Th>W</Th>
            <Th>{isFootball ? 'D' : 'L'}</Th>
            <Th>{isFootball ? 'L' : 'T'}</Th>
            {isFootball ? null : <Th>NR</Th>}
            <Th align="right">Pts</Th>
            <Th align="right">{isFootball ? 'GD' : 'NRR'}</Th>
            <Th align="right" className="hidden xl:table-cell">
              {isFootball ? 'GF' : 'For'}
            </Th>
            <Th align="right" className="hidden xl:table-cell">
              {isFootball ? 'GA' : 'Against'}
            </Th>
          </tr>
        </thead>

        <tbody>
          {data.items.map((row) => {
            const margin = isFootball ? row.goalDifference : row.nrr;

            return (
              <tr
                key={row.team.id}
                className="border-b border-line transition-colors last:border-0 hover:bg-hover"
              >
                <td className="mono px-3 py-2 text-center text-xs text-muted">{row.position}</td>

                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
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
                <Td>{isFootball ? row.tied : row.lost}</Td>
                <Td>{isFootball ? row.lost : row.tied}</Td>
                {isFootball ? null : <Td>{row.noResult}</Td>}

                <Td align="right" emphasis>
                  {row.points}
                </Td>

                <td
                  className={cn(
                    'mono px-3 py-2 text-right',
                    margin > 0 ? 'text-success' : margin < 0 ? 'text-alert' : 'text-secondary',
                  )}
                >
                  {isFootball ? row.goalDifferenceText : row.nrrText}
                </td>

                <td className="mono hidden px-3 py-2 text-right text-xs text-muted xl:table-cell">
                  {isFootball ? row.goalsFor : `${row.runsScored}/${row.oversFaced}`}
                </td>
                <td className="mono hidden px-3 py-2 text-right text-xs text-muted xl:table-cell">
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
