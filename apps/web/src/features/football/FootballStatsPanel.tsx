import type { FootballPlayerStatsDto, FootballTournamentStatsDto } from '@howzat/shared';
import { Card, CardBody, CardHeader, SectionHeading, StatTile } from '@/components/ui/Card';
import { FootballAvatar } from '@/components/ui/FootballAvatar';
import { Table, Td, Th } from '@/components/ui/Table';
import { cn } from '@/lib/cn';

export function FootballStatsPanel({ stats }: { stats: FootballTournamentStatsDto }) {
  const { goldenBoot, playmaker, mostBooked, goldenGlove, players, totals } = stats;

  if (players.length === 0) return null;

  return (
    <section className="flex flex-col gap-7">
      <SectionHeading
        eyebrow="Tournament record"
        title="The leaders board"
        description="Folded from the goals and cards of completed matches, so an undone incident leaves the table on its own."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AwardCard
          label="Golden boot · most goals"
          player={goldenBoot}
          value={(player) => player.goals}
          tone="text-accent"
        />
        <AwardCard
          label="Playmaker · most assists"
          player={playmaker}
          value={(player) => player.assists}
          tone="text-[#9b8cff]"
        />
        <AwardCard
          label="Golden glove · clean sheets"
          player={goldenGlove}
          value={(player) => player.cleanSheets}
          tone="text-success"
        />
        <AwardCard
          label="Most booked"
          player={mostBooked}
          value={(player) =>
            player.redCards > 0
              ? `${player.yellowCards}Y ${player.redCards}R`
              : `${player.yellowCards}Y`
          }
          tone="text-warning"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Matches played" value={totals.matchesPlayed} />
        <StatTile label="Goals scored" value={totals.goals} tone="accent" />
        <StatTile label="Saves made" value={totals.saves} tone="success" />
        <StatTile
          label="Goals a match"
          value={totals.goalsPerMatch ?? '—'}
          hint={
            totals.ownGoals > 0
              ? `${totals.ownGoals} own goal${totals.ownGoals === 1 ? '' : 's'}`
              : undefined
          }
        />
        <StatTile
          label="Cards shown"
          value={totals.yellowCards + totals.redCards}
          hint={`${totals.yellowCards} yellow · ${totals.redCards} red`}
        />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-raised">
        <Table className="min-w-[58rem]">
          <thead>
            <tr className="border-b border-line">
              <Th align="left">Player</Th>
              <Th>Apps</Th>
              <Th>Goals</Th>
              <Th>Assists</Th>
              <Th>G/match</Th>
              <Th>OG</Th>
              <Th>Saves</Th>
              <Th>Conceded</Th>
              <Th>CS</Th>
              <Th>Yellow</Th>
              <Th>Red</Th>
            </tr>
          </thead>

          <tbody>
            {players.map((player) => (
              <tr
                key={player.playerId}
                className="border-b border-line last:border-0 hover:bg-hover/50"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FootballAvatar
                      seed={player.playerId}
                      name={player.playerName}
                      color={player.team.primaryColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-primary">{player.playerName}</p>
                      <p className="truncate text-[0.6875rem] text-muted">{player.team.name}</p>
                    </div>
                  </div>
                </td>

                <Td>{player.matches}</Td>
                <Td emphasis>{player.goals}</Td>
                <Td>{player.assists || '—'}</Td>
                <Td>{player.goalsPerMatch ?? '—'}</Td>
                <Td>{player.ownGoals || '—'}</Td>
                <Td>{player.saves || '—'}</Td>
                <Td>{player.isGoalkeeper ? player.goalsConceded : '—'}</Td>
                <Td>{player.isGoalkeeper ? player.cleanSheets : '—'}</Td>

                <td className="px-4 py-4 text-center">
                  <CardCount tone="yellow" count={player.yellowCards} />
                </td>
                <td className="px-4 py-4 text-center">
                  <CardCount tone="red" count={player.redCards} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  );
}

function AwardCard({
  label,
  player,
  value,
  tone,
}: {
  label: string;
  player: FootballPlayerStatsDto | null;
  value: (player: FootballPlayerStatsDto) => string | number;
  tone: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-4">
        <p className="eyebrow">{label}</p>
        <span className={cn('size-2 rounded-full bg-current', tone)} />
      </CardHeader>

      <CardBody>
        {player ? (
          <div className="flex items-end justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <FootballAvatar
                seed={player.playerId}
                name={player.playerName}
                color={player.team.primaryColor}
                size="md"
              />
              <div className="min-w-0">
                <p className="serif truncate text-2xl text-primary">{player.playerName}</p>
                <p className="mt-1 truncate text-sm text-secondary">{player.team.name}</p>
              </div>
            </div>
            <p className={cn('mono shrink-0 text-3xl font-medium', tone)}>{value(player)}</p>
          </div>
        ) : (
          <p className="text-secondary">Nobody has one yet.</p>
        )}
      </CardBody>
    </Card>
  );
}

function CardCount({ tone, count }: { tone: 'yellow' | 'red'; count: number }) {
  if (count === 0) return <span className="mono text-[0.8125rem] text-muted">—</span>;

  return (
    <span className="mono inline-flex items-center gap-1.5 text-[0.8125rem] text-primary">
      <span
        aria-hidden
        className={cn(
          'h-3.5 w-2.5 rounded-[1px] ring-1 ring-black/25',
          tone === 'red' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
        )}
      />
      {count}
    </span>
  );
}
