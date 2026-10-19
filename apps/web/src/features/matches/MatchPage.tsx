import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYERS_PER_TEAM, type MatchWithInningsDto, type TossDecision } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
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
    <div className="flex flex-col gap-6">
      <MatchHeader match={data} />

      {data.status === 'LIVE' ? (
        <Banner
          title="Live"
          body={`Innings ${data.currentInnings ?? 1}`}
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
          body="Chase ready"
          action={
            <Button size="sm" isLoading={resume.isPending} onClick={() => void handleResume()}>
              Start innings {pendingInnings?.number ?? 2}
            </Button>
          }
        />
      ) : null}

      {resume.error ? <ErrorText error={resume.error} /> : null}

      {setupOpen ? (
        <div className="flex flex-col gap-3">
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
            <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-4 py-6 text-center text-[0.8125rem] text-muted">
              Waiting on earlier rounds
            </p>
          )}

          <StepCard
            number={3}
            title="Start"
            state={!tossDone || !xiReady ? 'blocked' : 'ready'}
            description={
              !tossDone
                ? 'Toss first'
                : !xiReady
                  ? `${xiCount} of ${PLAYERS_PER_TEAM * 2} selected`
                  : 'Ready'
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
      ? `${nameOfTeam(match, match.tossWinnerId)} chose to ${
          match.tossDecision === 'BAT' ? 'bat' : 'bowl'
        }`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <BackLink to={`/tournaments/${match.tournamentId}/fixtures`}>Fixtures</BackLink>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xl font-semibold tracking-[-0.02em]">
            {match.team1 ? (
              <TeamMark
                shortName={match.team1.shortName}
                color={match.team1.primaryColor}
                size="sm"
              />
            ) : null}
            {match.team1?.name ?? 'TBD'}
            <span className="font-normal text-muted">v</span>
            {match.team2 ? (
              <TeamMark
                shortName={match.team2.shortName}
                color={match.team2.primaryColor}
                size="sm"
              />
            ) : null}
            {match.team2?.name ?? 'TBD'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill status={match.status} />
            <Pill>
              {match.stage === 'LEAGUE' ? `Round ${match.round}` : match.stage.replace(/_/g, ' ')}
            </Pill>
            <span className="tabular text-xs text-muted">{match.oversPerInnings} ov</span>
            {toss ? <span className="text-xs text-muted">· {toss}</span> : null}
          </div>
          {match.status === 'COMPLETED' || match.status === 'ABANDONED' ? (
            <p className="mt-2 text-[0.8125rem] font-medium">{match.resultText ?? 'No result'}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {match.status === 'COMPLETED' || match.status === 'ABANDONED' ? (
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
        </div>
      </header>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--accent-line)] bg-accent-soft px-4 py-2.5">
      <p className="flex items-center gap-2 text-[0.8125rem]">
        <span className="live-dot" />
        <span className="font-semibold">{title}</span>
        <span className="text-secondary">{body}</span>
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
        'overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised',
        state === 'blocked' && 'opacity-60',
      )}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span
          aria-hidden
          className={cn(
            'tabular grid size-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold',
            state === 'done'
              ? 'bg-success text-white'
              : state === 'ready'
                ? 'bg-accent-fill text-on-accent'
                : 'bg-sunken text-muted',
          )}
        >
          {state === 'done' ? (
            <svg
              viewBox="0 0 12 12"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m2.5 6.2 2.3 2.3 4.7-5" />
            </svg>
          ) : (
            number
          )}
        </span>
        <h2 className="text-[0.8125rem] font-semibold">{title}</h2>
        <p className="truncate text-xs text-muted">{description}</p>
      </header>
      <div className="flex flex-col gap-4 p-4">{children}</div>
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
      description={done ? 'Recorded' : 'Winner and choice'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Won by</p>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((team) => (
              <ChoiceChip
                key={team.id}
                selected={winnerId === team.id}
                onClick={() => setWinnerId(team.id)}
              >
                <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
                <span className="ml-2">{team.name}</span>
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Chose to</p>
          <div className="flex flex-wrap gap-1.5">
            {(['BAT', 'BOWL'] as const).map((option) => (
              <ChoiceChip
                key={option}
                selected={decision === option}
                onClick={() => setDecision(option)}
              >
                {option === 'BAT' ? 'Bat' : 'Bowl'}
              </ChoiceChip>
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
        description={disabled ? 'Toss first' : 'Tap in batting order'}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {sides.map((side) => {
            const selection = selections[side.id] ?? { order: [], captainId: null, keeperId: null };
            const full = selection.order.length === PLAYERS_PER_TEAM;

            return (
              <div key={side.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TeamMark shortName={side.shortName} color={side.primaryColor} size="sm" />
                    <p className="text-[0.8125rem] font-semibold">{side.name}</p>
                  </div>
                  <span className={cn('tabular text-xs', full ? 'text-success' : 'text-muted')}>
                    {selection.order.length}/{PLAYERS_PER_TEAM}
                  </span>
                </div>

                <ul className="overflow-hidden rounded-[var(--radius-md)] border border-line">
                  {side.players.map((player) => {
                    const position = selection.order.indexOf(player.id);
                    const picked = position >= 0;

                    return (
                      <li
                        key={player.id}
                        className={cn(
                          'flex items-center gap-1.5 border-b border-line px-2.5 py-1.5 last:border-0',
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
                              'tabular grid size-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold',
                              picked
                                ? 'bg-accent-fill text-on-accent'
                                : 'border border-line-strong',
                            )}
                          >
                            {picked ? position + 1 : ''}
                          </span>

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
        'h-6 min-w-7 shrink-0 rounded-[var(--radius-sm)] px-1.5 text-[0.6875rem] font-medium transition-colors',
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
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-[0.8125rem] font-semibold">Scorers</h2>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {match.scorers.length > 0 ? (
            <ul className="overflow-hidden rounded-[var(--radius-md)] border border-line">
              {match.scorers.map((scorer) => (
                <li
                  key={scorer.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{scorer.name}</p>
                    <p className="truncate text-xs text-muted">@{scorer.username}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove.mutate(scorer.id)}
                    aria-label={`Remove ${scorer.name}`}
                    className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-sunken hover:text-alert"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                      <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">None assigned. You can score it yourself.</p>
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
