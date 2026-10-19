import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYERS_PER_TEAM, type MatchWithInningsDto, type TossDecision } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Card';
import { MatchHero, type MatchSide } from '@/components/ui/MatchCard';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { stageLabel } from '@/lib/pdf/sources';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
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
    <div className="flex flex-col gap-8">
      <MatchHeader match={data} />

      {data.status === 'LIVE' ? (
        <Banner
          title="Live"
          body={`Innings ${data.currentInnings ?? 1} is under way`}
          action={
            <Link to={`/matches/${matchId}/score`}>
              <Button size="sm">Open scorer</Button>
            </Link>
          }
        />
      ) : null}

      {data.status === 'INNINGS_BREAK' ? (
        <Banner
          title="Innings break"
          body="The target is set. Start the chase when the teams are back out."
          action={
            <Button size="sm" isLoading={resume.isPending} onClick={() => void handleResume()}>
              Start innings {pendingInnings?.number ?? 2}
            </Button>
          }
        />
      ) : null}

      {resume.error ? <ErrorText error={resume.error} /> : null}

      {setupOpen ? (
        <div className="flex flex-col gap-4">
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
            <EmptyState
              compact
              scene="fixtures"
              title="Waiting on earlier rounds"
              description="Both sides fill in once the matches feeding this one have a result."
            />
          )}

          <StepCard
            number={3}
            title="Walk out"
            state={!tossDone || !xiReady ? 'blocked' : 'ready'}
            description={
              !tossDone
                ? 'Record the toss first'
                : !xiReady
                  ? `${xiCount} of ${PLAYERS_PER_TEAM * 2} players picked`
                  : 'Both XIs are in. Start when the umpires are ready.'
            }
          >
            <Button
              className="self-start"
              disabled={!tossDone || !xiReady}
              isLoading={start.isPending}
              onClick={() => void handleStart()}
            >
              Start match
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
        }.`
      : match.status === 'SCHEDULED'
        ? 'Toss, pick the XIs, then start. The scorer takes it from there.'
        : null;
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const side = (team: MatchWithInningsDto['team1']): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <BackLink to={`/tournaments/${match.tournamentId}/fixtures`}>Fixtures</BackLink>
      <MatchHero
        eyebrow={
          <>
            <span>{stageLabel(match.stage, match.round)}</span>
            <span aria-hidden>·</span>
            <span>{match.oversPerInnings} overs a side</span>
            {match.venue ? (
              <>
                <span aria-hidden>·</span>
                <span>{match.venue}</span>
              </>
            ) : null}
          </>
        }
        status={match.status}
        home={side(match.team1)}
        away={side(match.team2)}
        result={finished ? (match.resultText ?? 'No result') : undefined}
        detail={toss}
        actions={
          <>
            {finished ? (
              <>
                <a href={`/live/${match.publicSlug}?view=scorecard`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary">
                    Scorecard
                  </Button>
                </a>
                <PdfButton
                  label="PDF"
                  build={() =>
                    import('@/lib/pdf').then((pdf) =>
                      match.sport === 'FOOTBALL'
                        ? pdf.buildFootballMatchPdf(match.publicSlug)
                        : pdf.buildCricketMatchPdf(match.publicSlug),
                    )
                  }
                />
              </>
            ) : (
              <a href={`/live/${match.publicSlug}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary">
                  Public page
                </Button>
              </a>
            )}
            <ShareLink
              slug={match.publicSlug}
              matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
            />
          </>
        }
      />
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[color-mix(in_oklab,var(--live)_40%,var(--line))] bg-raised px-5 py-4">
      <p className="flex items-center gap-3">
        <span className="live-dot" />
        <span className="serif text-[1.5rem]">{title}</span>
        <span className="text-sm text-secondary">{body}</span>
      </p>
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
  number: number;
  title: string;
  description: string;
  state: 'ready' | 'blocked' | 'done';
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-xl)] border bg-raised',
        state === 'ready' ? 'border-line-strong' : 'border-line',
        state === 'blocked' && 'opacity-60',
      )}
    >
      <header className="flex items-center gap-4 px-5 pt-5">
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full border font-serif text-[1.25rem] leading-none',
            state === 'done'
              ? 'border-success bg-success text-[var(--surface-raised)]'
              : state === 'ready'
                ? 'border-primary text-primary'
                : 'border-line-strong text-muted',
          )}
        >
          {state === 'done' ? (
            <svg
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          ) : (
            number
          )}
        </span>
        <div className="min-w-0">
          <h2 className="serif text-[1.625rem]">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </header>
      <div className="flex flex-col gap-5 p-5">{children}</div>
    </section>
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
      number={1}
      title="Toss"
      state={done ? 'done' : 'ready'}
      description={done ? 'Recorded. You can still change it before the start.' : 'Who called it right, and what did they choose?'}
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5">
          <p className="eyebrow">Won by</p>
          <div className="grid grid-cols-2 gap-2.5">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                aria-pressed={winnerId === team.id}
                onClick={() => setWinnerId(team.id)}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-[var(--radius-xl)] border p-3 text-left transition-colors',
                  winnerId === team.id
                    ? 'border-primary bg-surface'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <TeamMark shortName={team.shortName} color={team.primaryColor} size="lg" />
                <span className="min-w-0 truncate text-sm font-semibold">{team.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="eyebrow">Chose to</p>
          <div className="grid grid-cols-2 gap-2.5">
            {(['BAT', 'BOWL'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={decision === option}
                onClick={() => setDecision(option)}
                className={cn(
                  'grid h-[4.5rem] place-items-center rounded-[var(--radius-xl)] border font-serif text-[1.5rem] leading-none transition-colors',
                  decision === option
                    ? 'border-primary bg-surface text-primary'
                    : 'border-line text-muted hover:border-line-strong hover:text-primary',
                )}
              >
                {option === 'BAT' ? 'Bat' : 'Bowl'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {recordToss.error ? <ErrorText error={recordToss.error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={!winnerId}
          isLoading={recordToss.isPending}
          onClick={() => recordToss.mutate({ tossWinnerId: winnerId, decision })}
        >
          {match.tossWinnerId ? 'Update' : 'Save toss'}
        </Button>
        {recordToss.isSuccess ? <span className="text-xs text-success">Saved</span> : null}
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
        number={2}
        title="Playing XI"
        state={disabled ? 'blocked' : complete ? 'done' : 'ready'}
        description={disabled ? 'Record the toss first' : 'Tap players in batting order, then mark a captain and keeper'}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {sides.map((side) => {
            const selection = selections[side.id] ?? { order: [], captainId: null, keeperId: null };
            const full = selection.order.length === PLAYERS_PER_TEAM;

            return (
              <div key={side.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TeamMark shortName={side.shortName} color={side.primaryColor} size="md" />
                    <p className="text-sm font-semibold">{side.name}</p>
                  </div>
                  <span className={cn('tabular text-xs', full ? 'text-success' : 'text-muted')}>
                    {selection.order.length}/{PLAYERS_PER_TEAM}
                  </span>
                </div>

                <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line">
                  {side.players.map((player) => {
                    const position = selection.order.indexOf(player.id);
                    const picked = position >= 0;

                    return (
                      <li
                        key={player.id}
                        className={cn(
                          'flex items-center gap-1.5 border-b border-line px-3 py-2 last:border-0',
                          'transition-colors duration-[var(--dur-fast)]',
                          picked ? 'bg-accent-soft' : 'hover:bg-hover',
                        )}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggle(side.id, player.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          aria-pressed={picked}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'tabular grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] leading-none font-semibold',
                              picked
                                ? 'bg-accent-fill text-on-accent'
                                : 'border border-line-strong',
                            )}
                          >
                            {picked ? position + 1 : ''}
                          </span>

                          <PlayerAvatar seed={player.id} name={player.name} size="xs" color={side.primaryColor} />

                          <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                            {player.name}
                          </span>

                          <span className="shrink-0 text-xs text-muted capitalize">
                            {player.role.replace('_', ' ').toLowerCase()}
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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={disabled || !complete}
            isLoading={setXi.isPending}
          >
            Save XIs
          </Button>

          {setXi.isSuccess ? (
            <span className="text-xs text-success">Saved</span>
          ) : !complete ? (
            <span className="text-xs text-muted">11 and a captain each</span>
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
        'grid h-7 min-w-8 shrink-0 place-items-center rounded-full px-2 text-[0.6875rem] leading-none font-semibold transition-colors',
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
      <section className="rounded-[var(--radius-xl)] border border-line bg-raised">
        <header className="px-5 pt-5">
          <h2 className="serif text-[1.625rem]">Scorers</h2>
          <p className="mt-0.5 text-xs text-muted">
            Anyone you add here can score this match from their phone.
          </p>
        </header>

        <div className="flex flex-col gap-5 p-5">
          {match.scorers.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {match.scorers.map((scorer) => (
                <li
                  key={scorer.id}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line px-3 py-2.5"
                >
                  <PlayerAvatar seed={scorer.username} name={scorer.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{scorer.name}</p>
                    <p className="truncate text-xs text-muted">@{scorer.username}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove.mutate(scorer.id)}
                    aria-label={`Remove ${scorer.name}`}
                    className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-alert"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                      <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-4 py-4 text-center text-xs text-muted">
              Nobody assigned yet. As organiser you can score it yourself.
            </p>
          )}

          <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Input
                label="Username"
                placeholder="whynotramaa"
                value={username}
                error={fieldError}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={username.trim().length < 3}
              isLoading={assign.isPending}
            >
              Assign
            </Button>
          </form>

          {remove.error ? <ErrorText error={remove.error} /> : null}

          {canAbandon ? (
            <div className="flex justify-end border-t border-line pt-3">
              <Button variant="danger" size="sm" onClick={() => setConfirmAbandon(true)}>
                Abandon
              </Button>
            </div>
          ) : null}

          {abandon.error ? <ErrorText error={abandon.error} /> : null}
        </div>
      </section>

      <Sheet
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandon match?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAbandon(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={abandon.isPending}
              onClick={() => {
                abandon.mutate(undefined);
                setConfirmAbandon(false);
              }}
            >
              Abandon
            </Button>
          </>
        }
      >
        <p className="text-[0.8125rem] text-secondary">Records no result. Scored balls are kept.</p>
      </Sheet>
    </>
  );
}
