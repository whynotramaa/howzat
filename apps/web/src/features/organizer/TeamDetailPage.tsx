import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PLAYER_ROLES, PLAYERS_PER_TEAM, type PlayerDto, type PlayerRole } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, SectionHeading } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { Reveal } from '@/components/ui/Reveal';
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
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  KEEPER: 'Keeper',
};

/**
 * One squad. Eleven slots, filled either from a Howzat account or as a guest.
 *
 * The entry forms disappear once the XI is complete rather than sitting there
 * greyed out — a full squad is a finished job, and the page should look finished.
 */
export function TeamDetailPage() {
  const { teamId = '' } = useParams();
  const team = useTeam(teamId);

  if (team.isPending) return <SkeletonCard rows={4} />;
  if (team.error) return <ErrorText error={team.error} />;
  if (!team.data) return null;

  const squad = team.data;
  const remaining = PLAYERS_PER_TEAM - squad.players.length;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <BackLink to={`/tournaments/${squad.tournamentId}`}>Back to tournament</BackLink>

        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
          <div className="flex items-center gap-5">
            <TeamMark shortName={squad.shortName} color={squad.primaryColor} size="lg" />

            <div className="min-w-0">
              <p className="eyebrow">Squad</p>
              <h1 className="serif mt-2.5 text-[2.25rem] text-primary sm:text-[2.75rem]">
                {squad.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <p className="mono text-[0.75rem] font-medium text-secondary">{squad.players.length} on {PLAYERS_PER_TEAM}</p>
            <p className="max-w-[15rem] text-[0.9375rem] text-secondary">
              {squad.isEligible ? (
                <span className="text-success">
                  Full XI. This side can be scheduled and take the field.
                </span>
              ) : (
                `${remaining} more player${remaining === 1 ? '' : 's'} before this side can be scheduled.`
              )}
            </p>
          </div>
        </div>

        <div className="rule" />
      </div>

      {remaining > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal index={0}>
            <AddPlayerCard teamId={teamId} tournamentId={squad.tournamentId} />
          </Reveal>
          <Reveal index={1}>
            <BulkAddCard
              teamId={teamId}
              tournamentId={squad.tournamentId}
              remaining={remaining}
            />
          </Reveal>
        </div>
      ) : null}

      <section className="flex flex-col gap-7">
        <SectionHeading
          eyebrow={`${squad.players.length} registered`}
          title="The squad"
          description="Batting order is chosen at the toss, not here — this is the pool the XI comes from."
        />

        <Card>
          {squad.players.length === 0 ? (
            <CardBody>
              <p className="py-8 text-center text-secondary">
                Nobody registered yet. Add them one at a time, or paste the whole list.
              </p>
            </CardBody>
          ) : (
            <ul>
              {squad.players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  index={index}
                  player={player}
                  teamId={teamId}
                  tournamentId={squad.tournamentId}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function PlayerRow({
  player,
  index,
  teamId,
  tournamentId,
}: {
  player: PlayerDto;
  index: number;
  teamId: string;
  tournamentId: string;
}) {
  const deletePlayer = useDeletePlayer(teamId, tournamentId);

  return (
    <li className="flex items-center gap-4 border-b border-line px-6 py-4 last:border-0 sm:px-8">
      <span className="mono w-6 shrink-0 text-[0.8125rem] text-muted">
        {String(index + 1).padStart(2, '0')}
      </span>

      <PlayerAvatar seed={player.id} name={player.name} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-primary">{player.name}</span>
        {/* A linked account gets its handle, and the handle links to the profile
            the runs are landing on. A guest slot says so plainly rather than
            showing a placeholder that looks like a real handle. */}
        {player.isRegistered ? (
          <Link
            to={`/players/${player.username}`}
            className="mono text-[0.6875rem] text-accent underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
          >
            @{player.username}
          </Link>
        ) : (
          <span className="text-[0.6875rem] tracking-[0.08em] text-muted uppercase">
            Guest — no account
          </span>
        )}
      </span>

      <Pill>{ROLE_LABELS[player.role]}</Pill>

      <button
        type="button"
        onClick={() => deletePlayer.mutate(player.id)}
        disabled={deletePlayer.isPending}
        aria-label={`Remove ${player.name}`}
        className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-alert"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
          <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Two ways to name a player, because there are two kinds of player.
 *
 * Someone with a Howzat account is found by handle, and their runs go on their
 * profile. Someone who just turned up is typed in as a name and gets a guest slot.
 * Making the account path the default would be wrong — most club players will
 * never sign up — so it sits alongside, not in front.
 */
function AddPlayerCard({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const addPlayer = useAddPlayer(teamId, tournamentId);
  const [mode, setMode] = useState<'name' | 'account'>('name');
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('BATSMAN');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await addPlayer.mutateAsync({ name, role, battingStyle: null, bowlingStyle: null });
    // Keep the role — squads are usually entered in position order.
    setName('');
  }

  const roleField = (
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
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="serif text-xl text-primary">Register a player</h3>
        <p className="mt-1.5 text-[0.8125rem] text-secondary">
          By name for a guest, or by handle to link their record.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        <Tabs
          items={[
            { value: 'name', label: 'By name' },
            { value: 'account', label: 'By Howzat handle' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'name' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Player name"
              required
              placeholder="P. Kabra"
              hint="They play as a guest — no profile, but fully scoreable."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            {roleField}

            {addPlayer.error ? <ErrorText error={addPlayer.error} /> : null}

            <Button type="submit" isLoading={addPlayer.isPending} className="self-start">
              Register player
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Debounced handle lookup. Picking a result registers them to the squad. */
function UserSearchField({
  onPick,
  isPending,
}: {
  onPick: (username: string) => void | Promise<unknown>;
  isPending: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  // A request per keystroke would be one per character of a username nobody has
  // finished typing yet.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const results = useUserSearch(debounced);
  const items = results.data?.items ?? [];
  const searched = debounced.trim().length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Find by username"
        placeholder="whynotramaa"
        hint="Their runs and wickets land on their profile."
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />

      {searched && !results.isPending && items.length === 0 ? (
        <p className="text-[0.8125rem] text-muted">
          Nobody found. Register them by name instead — they can still play.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="overflow-hidden rounded-[var(--radius-md)] border border-line">
          {items.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-primary">{user.name}</span>
                <span className="mono text-[0.6875rem] text-muted">@{user.username}</span>
              </span>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => void onPick(user.username)}
              >
                Register
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Eleven separate form submissions is the wrong shape for entering a squad — one
 * paste of eleven names is what an organizer actually has to hand.
 */
function BulkAddCard({
  teamId,
  tournamentId,
  remaining,
}: {
  teamId: string;
  tournamentId: string;
  remaining: number;
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
    <Card className="h-full">
      <CardHeader>
        <h3 className="serif text-xl text-primary">Paste the whole squad</h3>
        <p className="mt-1.5 text-[0.8125rem] text-secondary">
          One name per line. Roles default to batsman and can be changed after.
        </p>
      </CardHeader>

      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Textarea
            label="Names"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            placeholder={'P. Srivastava \nV. Kohli\nK. Kabra\n…'}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p
              className={cn(
                'mono text-[0.8125rem]',
                overflow ? 'text-alert' : 'text-muted',
              )}
            >
              {names.length} name{names.length === 1 ? '' : 's'} · {remaining} slot
              {remaining === 1 ? '' : 's'} left
            </p>

            <Button
              type="submit"
              isLoading={addPlayers.isPending}
              disabled={names.length === 0 || overflow}
            >
              {overflow
                ? `Remove ${names.length - remaining} to fit`
                : `Register ${names.length || ''}`.trim()}
            </Button>
          </div>

          {addPlayers.error ? <ErrorText error={addPlayers.error} /> : null}
        </form>
      </CardBody>
    </Card>
  );
}
