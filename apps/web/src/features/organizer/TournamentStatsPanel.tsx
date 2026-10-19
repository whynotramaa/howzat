import { useQuery } from '@tanstack/react-query';
import type { AnyTournamentStatsDto, TournamentStatsDto } from '@howzat/shared';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { SectionHeading } from '@/components/ui/Card';
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
    <section className="flex flex-col gap-5">
      <SectionHeading
        eyebrow="Leaders"
        title="Caps and ledgers"
        description="The orange cap goes to the top run scorer, the purple cap to the leading wicket taker."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <CapCard label="Orange cap" unit="runs" player={orangeCap} value={orangeCap?.runs} ink="var(--ink-amber)" />
        <CapCard label="Purple cap" unit="wickets" player={purpleCap} value={purpleCap?.wickets} ink="var(--ink-violet)" />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-line bg-raised">
        <Table className="min-w-[44rem]">
          <thead>
            <tr className="border-b border-line-strong">
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
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="relative shrink-0">
                      <PlayerAvatar seed={player.playerId} name={player.playerName} size="sm" color={player.team.primaryColor} />
                      <TeamMark
                        shortName={player.team.shortName}
                        color={player.team.primaryColor}
                        size="sm"
                        className="absolute -right-2 -bottom-1.5 !size-5 !text-[0.4rem]"
                      />
                    </span>
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
  unit,
  player,
  value,
  ink,
}: {
  label: string;
  unit: string;
  player: TournamentStatsDto['orangeCap'];
  value: number | undefined;
  ink: string;
}) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-xl)] border border-line bg-raised p-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: ink }} />
      {player ? (
        <PlayerAvatar seed={player.playerId} name={player.playerName} size="lg" color={player.team.primaryColor} />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-full border border-dashed border-line-strong font-serif text-xl text-muted">
          ?
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="eyebrow" style={{ color: ink }}>
          {label}
        </p>
        <p className="mt-1.5 truncate text-[0.9375rem] font-semibold">{player ? player.playerName : 'Up for grabs'}</p>
        <p className="truncate text-xs text-muted">{player ? player.team.name : 'Nobody has scored yet'}</p>
      </div>
      {player ? (
        <p className="shrink-0 text-right">
          <span className="score-figure tabular block text-[2.75rem] leading-none">{value}</span>
          <span className="text-xs text-muted">{unit}</span>
        </p>
      ) : null}
    </div>
  );
}
