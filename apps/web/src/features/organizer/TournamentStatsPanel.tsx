import { useQuery } from '@tanstack/react-query';
import type { TournamentStatsDto } from '@howzat/shared';
import { Card, CardBody, CardHeader, SectionHeading } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { api } from '@/lib/api';

export function TournamentStatsPanel({ tournamentId }: { tournamentId: string }) {
  const query = useQuery({
    queryKey: ['tournaments', tournamentId, 'stats'],
    queryFn: () => api.get<TournamentStatsDto>(`/tournaments/${tournamentId}/stats`),
    enabled: Boolean(tournamentId),
    staleTime: 60_000,
  });

  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.error) return <ErrorText error={query.error} />;
  if (!query.data || query.data.players.length === 0) return null;

  const { orangeCap, purpleCap, players } = query.data;

  return (
    <section className="flex flex-col gap-7">
      <SectionHeading
        eyebrow="Tournament record"
        title="The leaders board"
        description="Aggregated from completed ball events, with a short cache so the page stays quick during a busy match day."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <CapCard label="Orange cap · most runs" player={orangeCap} tone="text-accent" />
        <CapCard label="Purple cap · most wickets" player={purpleCap} tone="text-[#9b8cff]" />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
        <table className="w-full min-w-[58rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <Th className="text-left">Player</Th>
              <Th>Mat</Th><Th>Runs</Th><Th>Avg</Th><Th>SR</Th><Th>4s</Th><Th>6s</Th>
              <Th>Wkts</Th><Th>Econ</Th><Th>Fielding</Th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.playerId} className="border-b border-line last:border-0 hover:bg-hover/50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <TeamMark shortName={player.team.shortName} color={player.team.primaryColor} size="sm" />
                    <div>
                      <p className="font-medium text-primary">{player.playerName}</p>
                      <p className="text-[0.6875rem] text-muted">{player.team.name}</p>
                    </div>
                  </div>
                </td>
                <Td>{player.matches}</Td><Td emphasis>{player.runs}</Td>
                <Td>{player.average ?? '—'}</Td><Td>{player.strikeRate ?? '—'}</Td>
                <Td>{player.fours}</Td><Td>{player.sixes}</Td><Td emphasis>{player.wickets}</Td>
                <Td>{player.economy ?? '—'}</Td>
                <Td>{player.catches + player.runOuts + player.stumpings || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CapCard({
  label,
  player,
  tone,
}: {
  label: string;
  player: TournamentStatsDto['orangeCap'];
  tone: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-4">
        <p className="eyebrow">{label}</p>
        <span className={`size-2 rounded-full bg-current ${tone}`} />
      </CardHeader>
      <CardBody>
        {player ? (
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="serif text-2xl text-primary">{player.playerName}</p>
              <p className="mt-1 text-sm text-secondary">{player.team.name}</p>
            </div>
            <p className={`mono text-3xl font-medium ${tone}`}>
              {label.includes('runs') ? player.runs : player.wickets}
            </p>
          </div>
        ) : <p className="text-secondary">No completed performances yet.</p>}
      </CardBody>
    </Card>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`eyebrow whitespace-nowrap px-4 py-3.5 text-center font-medium ${className}`}>{children}</th>;
}

function Td({ children, emphasis = false }: { children: React.ReactNode; emphasis?: boolean }) {
  return <td className={`mono px-4 py-4 text-center ${emphasis ? 'font-medium text-primary' : 'text-secondary'}`}>{children}</td>;
}
