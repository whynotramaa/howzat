import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PLAYER_ROLES, type PlayerDto, type PlayerRole, type Sport } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import {
  useAddPlayer,
  useAddPlayersBulk,
  useDeletePlayer,
  useTeam,
  useUserSearch,
} from './queries';

const ROLE_LABELS: Record<PlayerRole, string> = {
  BATSMAN: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  KEEPER: 'Keeper',
};

export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const team = useTeam(teamId);

  if (team.isPending) return <SkeletonCard rows={4} />;
  if (team.error) return <ErrorText error={team.error} />;
  if (!team.data) return null;

  const squad = team.data;
  const remaining = squad.maxSquadSize - squad.players.length;
  const shortOfStarting = Math.max(0, squad.squadSize - squad.players.length);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        back={<BackLink to={`/tournaments/${squad.tournamentId}`}>Tournament</BackLink>}
        eyebrow={
          <>
            <span>{squad.sport === 'FOOTBALL' ? 'Football squad' : 'Cricket squad'}</span>
            {squad.isEligible ? (
              <Pill tone="success">Ready</Pill>
            ) : (
              <Pill tone="warning">{shortOfStarting} short</Pill>
            )}
          </>
        }
        title={squad.name}
        description={
          squad.isEligible
            ? `${squad.players.length} players named. ${remaining > 0 ? `Room for ${remaining} more on the bench.` : 'The squad is full.'}`
            : `${squad.players.length} of ${squad.squadSize} named. Add ${shortOfStarting} more before this side can take the field.`
        }
        art={
          <div className="grid place-items-center">
            <TeamMark shortName={squad.shortName} color={squad.primaryColor} size="xl" className="!size-36 !text-[2.25rem]" />
          </div>
        }
      />

      <div className={cn('grid gap-10', remaining > 0 && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
        <section className="min-w-0">
          <SectionHeading
            eyebrow={`${squad.players.length} named`}
            title="The squad"
            description={
              squad.sport === 'FOOTBALL'
                ? `${squad.squadSize} start, the rest wait on the bench.`
                : 'Registered players link to their career page.'
            }
          />
          {squad.players.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                compact
                scene="squad"
                title="No players yet"
                description="Add them one by one, or paste the whole list at once."
              />
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {squad.players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  index={index}
                  player={player}
                  sport={squad.sport}
                  color={squad.primaryColor}
                  teamId={teamId}
                  tournamentId={squad.tournamentId}
                />
              ))}
            </ul>
          )}
        </section>

        {remaining > 0 ? (
          <aside className="flex min-w-0 flex-col gap-4">
            <AddPlayerCard teamId={teamId} tournamentId={squad.tournamentId} sport={squad.sport} />
            <BulkAddCard
              teamId={teamId}
              tournamentId={squad.tournamentId}
              remaining={remaining}
              shortOfStarting={shortOfStarting}
              sport={squad.sport}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  sport,
  color,
  index,
  teamId,
  tournamentId,
}: {
  player: PlayerDto;
  sport: Sport;
  color: string;
  index: number;
  teamId: string;
  tournamentId: string;
}) {
  const deletePlayer = useDeletePlayer(teamId, tournamentId);

  return (
    <li
      className="reveal card-lift relative flex items-center gap-3.5 rounded-[var(--radius-xl)] border border-line bg-raised p-3.5"
      style={{ '--delay': `${index * 40}ms` } as CSSProperties}
    >
      <span className="relative shrink-0">
        <PlayerAvatar seed={player.id} name={player.name} size="md" color={sport === 'FOOTBALL' ? color : undefined} />
        <span className="tabular absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border border-line bg-surface text-[0.625rem] font-semibold text-secondary">
          {index + 1}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{player.name}</span>
        {player.isRegistered ? (
          <Link to={`/players/${player.username}`} className="text-xs text-muted hover:text-accent">
            @{player.username}
          </Link>
        ) : (
          <span className="text-xs text-muted">Guest</span>
        )}
      </span>

      {sport === 'CRICKET' ? <Pill>{ROLE_LABELS[player.role]}</Pill> : null}

      <button
        type="button"
        onClick={() => deletePlayer.mutate(player.id)}
        disabled={deletePlayer.isPending}
        aria-label={`Remove ${player.name}`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-alert"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
          <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function AddPlayerCard({
  teamId,
  tournamentId,
  sport,
}: {
  teamId: string;
  tournamentId: string;
  sport: Sport;
}) {
  const addPlayer = useAddPlayer(teamId, tournamentId);
  const [mode, setMode] = useState<'name' | 'account'>('name');
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('BATSMAN');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await addPlayer.mutateAsync({ name, role, battingStyle: null, bowlingStyle: null });
    setName('');
  }

  const roleField =
    sport === 'CRICKET' ? (
      <Select
        label="Role"
        value={role}
        onChange={(event) => setRole(event.target.value as PlayerRole)}
      >
        {PLAYER_ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </Select>
    ) : null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-raised">
      <div className="px-5 pt-5 pb-2">
        <h2 className="serif text-[1.625rem]">Add a player</h2>
        <p className="mt-1 text-xs text-muted">Players with an account get their own career page.</p>
      </div>
      <Tabs
        className="px-2"
        items={[
          { value: 'name', label: 'By name' },
          { value: 'account', label: 'By username' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="flex flex-col gap-4 p-5">
        {mode === 'name' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Name"
              required
              placeholder="P. Kabra"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {roleField}
            {addPlayer.error ? <ErrorText error={addPlayer.error} /> : null}
            <Button type="submit" size="sm" isLoading={addPlayer.isPending} className="self-start">
              Add player
            </Button>
          </form>
        ) : (
          <>
            {roleField}
            <UserSearchField
              onPick={(username) =>
                addPlayer.mutateAsync({
                  username,
                  role,
                  battingStyle: null,
                  bowlingStyle: null,
                })
              }
              isPending={addPlayer.isPending}
            />
            {addPlayer.error ? <ErrorText error={addPlayer.error} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

function UserSearchField({
  onPick,
  isPending,
}: {
  onPick: (username: string) => void | Promise<unknown>;
  isPending: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const results = useUserSearch(debounced);
  const items = results.data?.items ?? [];
  const searched = debounced.trim().length >= 2;

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Username"
        placeholder="whynotramaa"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />

      {searched && !results.isPending && items.length === 0 ? (
        <p className="text-xs text-muted">No match. Add by name instead.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line px-3 py-2"
            >
              <PlayerAvatar seed={user.username} name={user.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium">{user.name}</span>
                <span className="text-xs text-muted">@{user.username}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => void onPick(user.username)}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BulkAddCard({
  teamId,
  tournamentId,
  remaining,
  shortOfStarting,
  sport,
}: {
  teamId: string;
  tournamentId: string;
  remaining: number;
  shortOfStarting: number;
  sport: Sport;
}) {
  const addPlayers = useAddPlayersBulk(teamId, tournamentId);
  const [text, setText] = useState('');

  const names = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const overflow = names.length > remaining;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await addPlayers.mutateAsync(
      names.map((name) => ({
        name,
        role: 'BATSMAN' as PlayerRole,
        battingStyle: null,
        bowlingStyle: null,
      })),
    );
    setText('');
  }

  return (
    <section className="rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface p-5">
      <h2 className="serif text-[1.625rem]">Paste a list</h2>
      <p className="mt-1 mb-4 text-xs text-muted">Faster for a whole team. Roles can be changed later.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Textarea
          label="Paste names, one per line"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          placeholder={'P. Srivastava\nV. Kohli\nK. Kabra'}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn('tabular text-xs', overflow ? 'text-alert' : 'text-muted')}>
            {sport === 'FOOTBALL' && shortOfStarting === 0
              ? `${names.length} to the bench`
              : `${names.length} of ${remaining} left`}
          </p>
          <Button
            type="submit"
            size="sm"
            isLoading={addPlayers.isPending}
            disabled={names.length === 0 || overflow}
          >
            {overflow ? `Remove ${names.length - remaining}` : `Add ${names.length || ''}`.trim()}
          </Button>
        </div>

        {addPlayers.error ? <ErrorText error={addPlayers.error} /> : null}
      </form>
    </section>
  );
}
