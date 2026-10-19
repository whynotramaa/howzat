import { useQuery } from '@tanstack/react-query';
import type { AnyTournamentStatsDto, TournamentStatsDto } from '@howzat/shared';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Table, Td, Th } from '@/components/ui/Table';
import { FootballStatsPanel } from '@/features/football/FootballStatsPanel';
import { api } from '@/lib/api';

export function TournamentStatsPanel({ tournamentId }: { tournamentId: string }) {
  const query = useQuery({
    queryKey: ['tournaments', tournamentId, 'stats'],
    queryFn: () => api.get<AnyTournamentStatsDto>(`/tournaments/${tournamentId}/stats`),
    enabled: Boolean(tournamentId),
    staleTime: 60_000,
  });

  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.error) return <ErrorText error={query.error} />;
  if (!query.data || query.data.players.length === 0) return null;

  if (query.data.sport === 'FOOTBALL') return <FootballStatsPanel stats={query.data} />;

  return <CricketStatsPanel stats={query.data} />;
}

function CricketStatsPanel({ stats }: { stats: TournamentStatsDto }) {
  const { orangeCap, purpleCap, players } = stats;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.8125rem] font-semibold">Leaders</h2>

      <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised sm:grid-cols-2">
        <CapCard label="Most runs" player={orangeCap} value={orangeCap?.runs} accent />
        <CapCard label="Most wickets" player={purpleCap} value={purpleCap?.wickets} />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
        <Table className="min-w-[44rem]">
          <thead>
            <tr className="border-b border-line bg-sunken">
              <Th align="left">Player</Th>
              <Th>Mat</Th>
              <Th>Runs</Th>
              <Th>Avg</Th>
              <Th>SR</Th>
              <Th>4s</Th>
              <Th>6s</Th>
              <Th>Wkts</Th>
              <Th>Econ</Th>
              <Th>Fielding</Th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.playerId}
                className="border-b border-line last:border-0 hover:bg-hover"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <TeamMark
                      shortName={player.team.shortName}
                      color={player.team.primaryColor}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-primary">{player.playerName}</p>
                      <p className="text-[0.6875rem] text-muted">{player.team.name}</p>
                    </div>
                  </div>
                </td>
                <Td>{player.matches}</Td>
                <Td emphasis>{player.runs}</Td>
                <Td>{player.average ?? '—'}</Td>
                <Td>{player.strikeRate ?? '—'}</Td>
                <Td>{player.fours}</Td>
                <Td>{player.sixes}</Td>
                <Td emphasis>{player.wickets}</Td>
                <Td>{player.economy ?? '—'}</Td>
                <Td>{player.catches + player.runOuts + player.stumpings || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  );
}

function CapCard({
  label,
  player,
  value,
  accent = false,
}: {
  label: string;
  player: TournamentStatsDto['orangeCap'];
  value: number | undefined;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-line px-4 py-3 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0">
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-0.5 truncate text-[0.8125rem] font-medium">
          {player ? player.playerName : 'None yet'}
        </p>
        {player ? <p className="truncate text-xs text-muted">{player.team.name}</p> : null}
      </div>
      {player ? (
        <p
          className={`tabular text-2xl font-semibold tracking-[-0.04em] ${accent ? 'text-accent' : ''}`}
        >
          {value}
        </p>
      ) : null}
    </div>
  );
}
