import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYERS_PER_TEAM, type MatchWithInningsDto, type TossDecision } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ChoiceChip, Input } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { Pill, StatusPill, TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { useTournament } from '@/features/organizer/queries';
import { cn } from '@/lib/cn';
import {
  useAbandonMatch,
  useAssignScorer,
  useMatch,
  useRecordToss,
  useRemoveScorer,
  useResumeInnings,
  useSetPlayingXi,
  useSquads,
  useStartMatch,
  type SquadSide,
} from './queries';

export function MatchPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();

  const match = useMatch(matchId);
  const squads = useSquads(matchId);
  const start = useStartMatch(matchId);
  const resume = useResumeInnings(matchId);

  if (match.isPending) return <SkeletonCard rows={4} />;
  if (match.error) return <ErrorText error={match.error} />;
  if (!match.data) return null;

  const data = match.data;
  const setupOpen = data.status === 'SCHEDULED' || data.status === 'TOSS';
  const xiCount = countSelected(squads.data?.team1) + countSelected(squads.data?.team2);
  const xiReady = xiCount === PLAYERS_PER_TEAM * 2;
  const tossDone = Boolean(data.tossWinnerId && data.tossDecision);

  const pendingInnings = data.innings.find((entry) => entry.status === 'IN_PROGRESS');

  async function handleStart() {
    await start.mutateAsync();
    void navigate(`/matches/${matchId}/score`);
  }

  async function handleResume() {
    if (!pendingInnings) return;
    await resume.mutateAsync(pendingInnings.number);
    void navigate(`/matches/${matchId}/score`);
  }

  return (
    <div className="flex flex-col gap-10">
      <MatchHeader match={data} />

      {data.status === 'LIVE' ? (
        <Banner
          title="This match is live"
          body={`Innings ${data.currentInnings ?? 1} in progress.`}
          action={
            <Link to={`/matches/${matchId}/score`}>
              <Button>Open the scoring console</Button>
            </Link>
          }
        />
      ) : null}

      {data.status === 'INNINGS_BREAK' ? (
        <Banner
          title="Innings break"
          body="The chase is set up and ready — start it when the sides are back out."
          action={
            <Button isLoading={resume.isPending} onClick={() => void handleResume()}>
              Start innings {pendingInnings?.number ?? 2}
            </Button>
          }
        />
      ) : null}

      {resume.error ? <ErrorText error={resume.error} /> : null}

      {setupOpen ? (
        <div className="flex flex-col gap-5">
          <TossCard match={data} />

          {squads.isPending ? (
            <SkeletonCard rows={5} />
          ) : squads.error ? (
            <ErrorText error={squads.error} />
          ) : squads.data?.team1 && squads.data.team2 ? (
            <PlayingXiCard
              matchId={matchId}
              sides={[squads.data.team1, squads.data.team2]}
              disabled={!tossDone}
            />
          ) : (
            <Card>
              <CardBody className="text-secondary">
                This bracket slot has no sides yet — its feeder matches must finish first.
              </CardBody>
            </Card>
          )}

          <StepCard
            number="03"
            title="Start the match"
            state={!tossDone || !xiReady ? 'blocked' : 'ready'}
            description={
              !tossDone
                ? 'Record the toss first.'
                : !xiReady
                  ? `Both XIs must be named — ${xiCount} of ${PLAYERS_PER_TEAM * 2} players selected.`
                  : 'Everything is set. This opens the first innings and takes the match live.'
            }
          >
            <Button
              size="lg"
              disabled={!tossDone || !xiReady}
              isLoading={start.isPending}
              onClick={() => void handleStart()}
            >
              Start the match
            </Button>

            {start.error ? <ErrorText error={start.error} /> : null}
          </StepCard>
        </div>
      ) : null}

      <ScorersCard match={data} />
    </div>
  );
}

function countSelected(side: SquadSide | null | undefined): number {
  return side?.players.filter((player) => player.selected).length ?? 0;
}

function MatchHeader({ match }: { match: MatchWithInningsDto }) {
  const toss =
    match.tossWinnerId && match.tossDecision
      ? `${nameOfTeam(match, match.tossWinnerId)} won the toss and chose to ${
          match.tossDecision === 'BAT' ? 'bat' : 'bowl'
        }`
      : null;

  return (
    <div className="flex flex-col gap-8">
      <BackLink to={`/tournaments/${match.tournamentId}/fixtures`}>All fixtures</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={match.status} />
            <Pill>
              {match.stage === 'LEAGUE' ? `Round ${match.round}` : match.stage.replace(/_/g, ' ')}
            </Pill>
            <span className="mono text-[0.6875rem] text-muted">{match.oversPerInnings} overs</span>
          </div>

          <h1 className="serif mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[2.25rem] text-primary sm:text-[2.75rem]">
            {match.team1?.name ?? 'TBD'}
            <span className="text-2xl text-muted italic">v</span>
            {match.team2?.name ?? 'TBD'}
          </h1>

          {toss ? <p className="mt-3 text-secondary">{toss}</p> : null}
          {match.resultText ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-[1.0625rem] text-success">{match.resultText}</p>
              <a href={`/live/${match.publicSlug}?view=scorecard`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary">
                  View scorecard
                </Button>
              </a>
              <PdfButton
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
                }
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a href={`/live/${match.publicSlug}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary">
              Live card ↗
            </Button>
          </a>
          <ShareLink
            slug={match.publicSlug}
            matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
          />
        </div>
      </div>

      <div className="rule" />
    </div>
  );
}

function nameOfTeam(match: MatchWithInningsDto, teamId: string): string {
  if (match.team1?.id === teamId) return match.team1.name;
  if (match.team2?.id === teamId) return match.team2.name;
  return 'The winner';
}

function Banner({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-lg)] border border-[var(--accent-line)] bg-accent-soft px-6 py-5 sm:px-8">
      <div>
        <p className="serif text-xl text-primary">{title}</p>
        <p className="mt-1 text-[0.9375rem] text-secondary">{body}</p>
      </div>
      {action}
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  state,
  children,
}: {
  number: string;
  title: string;
  description: string;
  state: 'ready' | 'blocked' | 'done';
  children: ReactNode;
}) {
  return (
    <Card className={cn(state === 'blocked' && 'opacity-60')}>
      <CardHeader className="flex items-start gap-5">
        <span
          aria-hidden
          className={cn(
            'mono mt-0.5 shrink-0 text-[0.8125rem]',
            state === 'done' ? 'text-success' : state === 'ready' ? 'text-accent' : 'text-muted',
          )}
        >
          {state === 'done' ? '✓' : number}
        </span>

        <div className="min-w-0">
          <h2 className="serif text-xl text-primary">{title}</h2>
          <p className="mt-1.5 text-[0.9375rem] text-secondary">{description}</p>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">{children}</CardBody>
    </Card>
  );
}

function TossCard({ match }: { match: MatchWithInningsDto }) {
  const recordToss = useRecordToss(match.id);

  const [winnerId, setWinnerId] = useState(match.tossWinnerId ?? '');
  const [decision, setDecision] = useState<TossDecision>(match.tossDecision ?? 'BAT');

  const teams = [match.team1, match.team2].filter((team): team is NonNullable<typeof team> =>
    Boolean(team),
  );

  if (teams.length < 2) return null;

  const done = Boolean(match.tossWinnerId && match.tossDecision);

  return (
    <StepCard
      number="01"
      title="The toss"
      state={done ? 'done' : 'ready'}
      description="Who won it, and what did they choose?"
    >
      <div className="grid gap-7 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Toss winner</p>
          <div className="flex flex-wrap gap-2.5">
            {teams.map((team) => (
              <ChoiceChip
                key={team.id}
                selected={winnerId === team.id}
                onClick={() => setWinnerId(team.id)}
              >
                <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
                <span className="ml-2.5">{team.name}</span>
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Elected to</p>
          <div className="flex flex-wrap gap-2.5">
            {(['BAT', 'BOWL'] as const).map((option) => (
              <ChoiceChip
                key={option}
                selected={decision === option}
                onClick={() => setDecision(option)}
              >
                {option === 'BAT' ? 'Bat first' : 'Bowl first'}
              </ChoiceChip>
            ))}
          </div>
        </div>
      </div>

      {recordToss.error ? <ErrorText error={recordToss.error} /> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          disabled={!winnerId}
          isLoading={recordToss.isPending}
          onClick={() => recordToss.mutate({ tossWinnerId: winnerId, decision })}
        >
          {match.tossWinnerId ? 'Update the toss' : 'Record the toss'}
        </Button>
        {recordToss.isSuccess ? <span className="text-sm text-success">Recorded</span> : null}
      </div>
    </StepCard>
  );
}

interface XiSelection {
  order: string[];
  captainId: string | null;
  keeperId: string | null;
}

function PlayingXiCard({
  matchId,
  sides,
  disabled,
}: {
  matchId: string;
  sides: [SquadSide, SquadSide];
  disabled: boolean;
}) {
  const setXi = useSetPlayingXi(matchId);

  const [selections, setSelections] = useState<Record<string, XiSelection>>(() =>
    Object.fromEntries(sides.map((side) => [side.id, initialSelection(side)])),
  );

  const complete = sides.every((side) => {
    const selection = selections[side.id];
    return (
      selection !== undefined &&
      selection.order.length === PLAYERS_PER_TEAM &&
      selection.captainId !== null
    );
  });

  function toggle(sideId: string, playerId: string) {
    setSelections((current) => {
      const selection = current[sideId] ?? { order: [], captainId: null, keeperId: null };
      const picked = selection.order.includes(playerId);

      if (picked) {
        return {
          ...current,
          [sideId]: {
            order: selection.order.filter((id) => id !== playerId),
            captainId: selection.captainId === playerId ? null : selection.captainId,
            keeperId: selection.keeperId === playerId ? null : selection.keeperId,
          },
        };
      }

      if (selection.order.length >= PLAYERS_PER_TEAM) return current;

      return { ...current, [sideId]: { ...selection, order: [...selection.order, playerId] } };
    });
  }

  function setRole(sideId: string, playerId: string, role: 'captainId' | 'keeperId') {
    setSelections((current) => {
      const selection = current[sideId];
      if (!selection || !selection.order.includes(playerId)) return current;

      return {
        ...current,
        [sideId]: { ...selection, [role]: selection[role] === playerId ? null : playerId },
      };
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setXi.mutate({
      teams: sides.map((side) => {
        const selection = selections[side.id]!;

        return {
          teamId: side.id,
          players: selection.order.map((playerId, index) => ({
            playerId,
            battingOrder: index + 1,
            isCaptain: selection.captainId === playerId,
            isKeeper: selection.keeperId === playerId,
          })),
        };
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <StepCard
        number="02"
        title="Playing XI"
        state={disabled ? 'blocked' : complete ? 'done' : 'ready'}
        description={
          disabled
            ? 'Record the toss first.'
            : 'Tap eleven names per side in batting order, then mark a captain and a keeper.'
        }
      >
        <div className="grid gap-8 lg:grid-cols-2">
          {sides.map((side) => {
            const selection = selections[side.id] ?? { order: [], captainId: null, keeperId: null };
            const full = selection.order.length === PLAYERS_PER_TEAM;

            return (
              <div key={side.id} className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                  <div className="flex items-center gap-3">
                    <TeamMark shortName={side.shortName} color={side.primaryColor} size="sm" />
                    <p className="font-medium text-primary">{side.name}</p>
                  </div>
                  <span
                    className={cn('mono text-[0.8125rem]', full ? 'text-success' : 'text-muted')}
                  >
                    {selection.order.length}/{PLAYERS_PER_TEAM}
                  </span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {side.players.map((player) => {
                    const position = selection.order.indexOf(player.id);
                    const picked = position >= 0;

                    return (
                      <li
                        key={player.id}
                        className={cn(
                          'flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2',
                          'transition-colors duration-[var(--dur-fast)]',
                          picked
                            ? 'border-[var(--accent-line)] bg-accent-soft'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggle(side.id, player.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          aria-pressed={picked}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'mono grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem]',
                              picked
                                ? 'bg-[var(--accent-strong)] text-white'
                                : 'border border-line text-muted',
                            )}
                          >
                            {picked ? position + 1 : ''}
                          </span>

                          <span className="min-w-0 flex-1 truncate text-sm text-primary">
                            {player.name}
                          </span>

                          <span className="shrink-0 text-[0.6875rem] tracking-[0.06em] text-muted uppercase">
                            {player.role.replace('_', ' ')}
                          </span>
                        </button>

                        <RoleToggle
                          label="C"
                          active={selection.captainId === player.id}
                          disabled={disabled || !picked}
                          onClick={() => setRole(side.id, player.id, 'captainId')}
                        />
                        <RoleToggle
                          label="WK"
                          active={selection.keeperId === player.id}
                          disabled={disabled || !picked}
                          onClick={() => setRole(side.id, player.id, 'keeperId')}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {setXi.error ? <ErrorText error={setXi.error} /> : null}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={disabled || !complete} isLoading={setXi.isPending}>
            Save both XIs
          </Button>

          {setXi.isSuccess ? (
            <span className="text-sm text-success">Saved</span>
          ) : !complete ? (
            <span className="text-sm text-muted">Eleven players and one captain per side.</span>
          ) : null}
        </div>
      </StepCard>
    </form>
  );
}

function initialSelection(side: SquadSide): XiSelection {
  const picked = side.players
    .filter((player) => player.selected)
    .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));

  return {
    order: picked.map((player) => player.id),
    captainId: picked.find((player) => player.isCaptain)?.id ?? null,
    keeperId: picked.find((player) => player.isKeeper)?.id ?? null,
  };
}

function RoleToggle({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label === 'C' ? 'Captain' : 'Wicketkeeper'}
      className={cn(
        'mono h-7 min-w-8 shrink-0 rounded-[var(--radius-xs)] px-1.5 text-[0.6875rem] transition-colors',
        active
          ? 'bg-inverse text-on-inverse'
          : 'border border-line text-muted hover:text-secondary',
        disabled && 'opacity-30',
      )}
    >
      {label}
    </button>
  );
}

function ScorersCard({ match }: { match: MatchWithInningsDto }) {
  const tournament = useTournament(match.tournamentId);
  const assign = useAssignScorer(match.tournamentId, match.id);
  const remove = useRemoveScorer(match.tournamentId, match.id);
  const abandon = useAbandonMatch(match.id);

  const [username, setUsername] = useState('');
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const isOrganizer = Boolean(tournament.data);
  const canAbandon = match.status !== 'COMPLETED' && match.status !== 'ABANDONED';

  const fieldError = useMemo(
    () => (assign.error instanceof Error ? assign.error.message : null),
    [assign.error],
  );

  if (!isOrganizer) return null;

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    await assign.mutateAsync(username);
    setUsername('');
  }

  return (
    <>
      <Card>
        <CardHeader>
          <p className="eyebrow">Permissions</p>
          <h2 className="serif mt-2.5 text-xl text-primary">Scorers</h2>
          <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-secondary">
            Anyone with an account can score this match once you assign them. They do not need to be
            in a squad or own the tournament.
          </p>
        </CardHeader>

        <CardBody className="flex flex-col gap-7">
          {match.scorers.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {match.scorers.map((scorer) => (
                <li
                  key={scorer.id}
                  className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-line px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{scorer.name}</p>
                    <p className="mono truncate text-[0.6875rem] text-muted">@{scorer.username}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove.mutate(scorer.id)}
                    aria-label={`Remove ${scorer.name}`}
                    className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-alert"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                      <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.9375rem] text-muted">
              Nobody is assigned yet. As the organizer you can always score it yourself.
            </p>
          )}

          <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[15rem] flex-1">
              <Input
                label="Assign by handle"
                placeholder="whynotramaa"
                value={username}
                error={fieldError}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={username.trim().length < 3}
              isLoading={assign.isPending}
            >
              Assign
            </Button>
          </form>

          {remove.error ? <ErrorText error={remove.error} /> : null}

          {canAbandon ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
              <p className="max-w-xl text-[0.9375rem] text-secondary">
                Rain, or a side that never showed? Abandoning ends the match without a result and
                awards a point to each side.
              </p>
              <Button variant="danger" size="sm" onClick={() => setConfirmAbandon(true)}>
                Abandon the match
              </Button>
            </div>
          ) : null}

          {abandon.error ? <ErrorText error={abandon.error} /> : null}
        </CardBody>
      </Card>

      <Sheet
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandon this match?"
        description="It cannot be scored afterwards, and the points table will record it as no result."
        footer={
          <>
            <Button
              variant="danger"
              isLoading={abandon.isPending}
              onClick={() => {
                abandon.mutate(undefined);
                setConfirmAbandon(false);
              }}
            >
              Abandon the match
            </Button>
            <Button variant="quiet" onClick={() => setConfirmAbandon(false)}>
              Go back
            </Button>
          </>
        }
      >
        <p className="text-secondary">
          Balls already scored stay in the log — nothing is deleted. The match simply ends without a
          winner.
        </p>
      </Sheet>
    </>
  );
}
