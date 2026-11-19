import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYER_ROLES, type PlayerDto, type PlayerRole, type Sport } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import {
  useAddPlayer,
  useAddPlayersBulk,
  useDeletePlayer,
  useDeleteTeam,
  useUpdatePlayer,
  useTeam,
  useTournament,
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
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const navigate = useNavigate();
  const deleteTeam = useDeleteTeam(team.data?.tournamentId ?? '');
  const tournament = useTournament(team.data?.tournamentId ?? '');
  const editable = tournament.data
    ? !['IN_PROGRESS', 'COMPLETED'].includes(tournament.data.status)
    : false;

  if (team.isPending) return <SkeletonCard rows={4} />;
  if (team.error) return <ErrorText error={team.error} onRetry={() => void team.refetch()} />;
  if (!team.data) return null;

  const squad = team.data;
  const remaining = squad.maxSquadSize - squad.players.length;
  const shortOfStarting = Math.max(0, squad.squadSize - squad.players.length);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={<BackLink to={`/tournaments/${squad.tournamentId}?tab=teams`}>Teams</BackLink>}
        eyebrow={
          <>
            <TeamMark shortName={squad.shortName} color={squad.primaryColor} size="sm" />
            <span className="mono">
              {squad.players.length}/{squad.squadSize}
            </span>
            {squad.isEligible ? (
              <Pill tone="success">Ready</Pill>
            ) : (
              <Pill tone="warning">{shortOfStarting} short</Pill>
            )}
          </>
        }
        title={squad.name}
        actions={
          editable ? (
            <>
              <Button size="sm" variant="quiet" onClick={() => setRemoving(true)}>
                Remove team
              </Button>
              {remaining > 0 ? (
                <Button size="sm" onClick={() => setAdding(true)}>
                  Add players
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      <Sheet
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove ${squad.name}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteTeam.isPending}
              onClick={() =>
                deleteTeam.mutate(squad.id, {
                  onSuccess: () => navigate(`/tournaments/${squad.tournamentId}?tab=teams`),
                })
              }
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">Deletes the team and its players.</p>
        {deleteTeam.error ? <ErrorText error={deleteTeam.error} /> : null}
      </Sheet>

      <div>
        <section className="min-w-0">
          {squad.players.length === 0 ? (
            <EmptyState
              compact
              title="No players yet"
              action={
                editable ? (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    Add players
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
              {squad.players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  index={index}
                  player={player}
                  sport={squad.sport}
                  color={squad.primaryColor}
                  editable={editable}
                  teamId={teamId}
                  tournamentId={squad.tournamentId}
                />
              ))}
            </ul>
          )}
        </section>

        {remaining > 0 ? (
          <Sheet open={adding} onClose={() => setAdding(false)} title="Add players">
            <AddPlayerCard
              teamId={teamId}
              tournamentId={squad.tournamentId}
              sport={squad.sport}
              remaining={remaining}
              shortOfStarting={shortOfStarting}
            />
          </Sheet>
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
  editable,
  teamId,
  tournamentId,
}: {
  player: PlayerDto;
  sport: Sport;
  color: string;
  index: number;
  editable: boolean;
  teamId: string;
  tournamentId: string;
}) {
  const deletePlayer = useDeletePlayer(teamId, tournamentId);
  const updatePlayer = useUpdatePlayer(teamId, tournamentId);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [name, setName] = useState(player.name);
  const [role, setRole] = useState(player.role);

  return (
    <li className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4">
      <span className="mono w-5 shrink-0 text-xs text-muted">{index + 1}</span>
      <PlayerAvatar
        seed={player.id}
        name={player.name}
        size="sm"
        color={sport === 'FOOTBALL' ? color : undefined}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{player.name}</span>
        {player.isRegistered ? (
          <Link to={`/players/${player.username}`} className="text-xs text-muted hover:text-accent">
            @{player.username}
          </Link>
        ) : (
          <span className="text-xs text-muted">Guest</span>
        )}
      </span>

      {sport === 'CRICKET' ? <Pill>{ROLE_LABELS[player.role]}</Pill> : null}

      {editable ? (
        <button
          type="button"
          onClick={() => {
            setName(player.name);
            setRole(player.role);
            setRemoving(false);
            setEditing(true);
          }}
          disabled={deletePlayer.isPending}
          aria-label={`Edit ${player.name}`}
          className="h-8 shrink-0 rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-primary"
        >
          Edit
        </button>
      ) : null}
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title={removing ? `Remove ${player.name}?` : 'Edit player'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => (removing ? setRemoving(false) : setEditing(false))}
            >
              Cancel
            </Button>
            {removing ? (
              <Button
                variant="danger"
                isLoading={deletePlayer.isPending}
                onClick={() =>
                  deletePlayer.mutate(player.id, { onSuccess: () => setEditing(false) })
                }
              >
                Remove player
              </Button>
            ) : (
              <Button
                isLoading={updatePlayer.isPending}
                disabled={!name.trim()}
                onClick={() =>
                  updatePlayer.mutate(
                    { id: player.id, name: name.trim(), role },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              >
                Save
              </Button>
            )}
          </>
        }
      >
        {removing ? (
          <p className="text-sm text-secondary">Removes this player from the squad.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            {sport === 'CRICKET' ? (
              <Select
                label="Role"
                value={role}
                onChange={(event) => setRole(event.target.value as PlayerRole)}
              >
                {PLAYER_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            ) : null}
            <button
              type="button"
              onClick={() => setRemoving(true)}
              className="min-h-11 self-start text-sm font-medium text-alert"
            >
              Remove from squad
            </button>
          </div>
        )}
        {updatePlayer.error || deletePlayer.error ? (
          <div className="mt-4">
            <ErrorText error={updatePlayer.error ?? deletePlayer.error} />
          </div>
        ) : null}
      </Sheet>
    </li>
  );
}

function AddPlayerCard({
  teamId,
  tournamentId,
  sport,
  remaining,
  shortOfStarting,
}: {
  teamId: string;
  tournamentId: string;
  sport: Sport;
  remaining: number;
  shortOfStarting: number;
}) {
  const addPlayer = useAddPlayer(teamId, tournamentId);
  const [mode, setMode] = useState<'name' | 'list' | 'account'>('list');
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
    <div className="flex flex-col gap-4">
      <Tabs
        items={[
          { value: 'list', label: 'Paste list' },
          { value: 'name', label: 'One by one' },
          { value: 'account', label: 'By username' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'list' ? (
        <BulkAddCard
          teamId={teamId}
          tournamentId={tournamentId}
          remaining={remaining}
          shortOfStarting={shortOfStarting}
          sport={sport}
        />
      ) : mode === 'name' ? (
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
          <Button type="submit" isLoading={addPlayer.isPending} className="self-start">
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
        placeholder="username"
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
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line px-3 py-2"
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
    <section>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Textarea
          label="One name per line"
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
